class ArtModelAvailability < ApplicationRecord
  belongs_to :user
  has_many :gigs

  before_destroy :prevent_past_deletion
  before_destroy :prevent_destroy_with_active_gig

  enum :status, { active: 0, cancelled: 1 }

  validates :starts_at, :ends_at, presence: true
  validate :end_after_start
  validate :must_be_within_business_hours
  validate :must_be_future_time, on: :create
  validate :prevent_edit_with_active_gig, on: :update

  def active_gig
    gigs.find { |g| g.status == 'confirmed' }
  end

  def cancel_with_gig!(cancel_remaining_series: false, flag_for_attention: false)
    gig = active_gig
    return false unless gig

    series = gig.faculty_request.request_series

    ActiveRecord::Base.transaction do
      cancel_single_gig!(self, gig, flag_for_attention: flag_for_attention)

      if cancel_remaining_series && series
        # Only release THIS model from later dates; other models booked on
        # those dates (multi-model sessions) keep their gigs.
        future_requests = series.faculty_requests
          .where.not(status: :archived)
          .where("starts_at > ?", Time.current)
          .where.not(id: gig.faculty_request_id)

        future_requests.each do |other_request|
          other_gig = other_request.confirmed_gigs
            .joins(:art_model_availability)
            .find_by(art_model_availabilities: { user_id: user_id })
          next unless other_gig

          cancel_single_gig!(other_gig.art_model_availability, other_gig, flag_for_attention: flag_for_attention)
        end
      end
    end

    series&.update_status!
    true
  end

  private

  def cancel_single_gig!(availability, gig, flag_for_attention: false)
    request = gig.faculty_request
    gig.destroy!
    # Losing any model means the session is short-staffed again
    request.update!(status: :pending, needs_attention: flag_for_attention) unless request.archived?
    availability.gigs.reload
    availability.update!(status: :cancelled)
  end

  def prevent_past_deletion
    if starts_at < Time.current
      errors.add(:base, "Cannot delete a past availability slot")
      throw :abort
    end
  end

  def prevent_destroy_with_active_gig
    if active_gig
      errors.add(:base, "Cannot delete this availability slot because a gig is scheduled. Use 'Cancel Gig' instead.")
      throw :abort
    end
  end

  def prevent_edit_with_active_gig
    if active_gig
      errors.add(:base, "Cannot edit this availability slot because a gig is scheduled. Cancel the gig first if you need to change your availability.")
    end
  end

  def must_be_future_time
    return unless starts_at

    if starts_at < Time.current
      errors.add(:starts_at, "must be in the future")
    end
  end

  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end

  def must_be_within_business_hours
    return unless starts_at && ends_at

    start_local = starts_at.in_time_zone("Eastern Time (US & Canada)")
    end_local   = ends_at.in_time_zone("Eastern Time (US & Canada)")

    if start_local.hour < 8
      errors.add(:starts_at, "cannot be before 8:00 AM ET")
    end

    if end_local.hour > 22 || (end_local.hour == 22 && end_local.min > 0)
      errors.add(:ends_at, "cannot be after 10:00 PM ET")
    end
  end
end