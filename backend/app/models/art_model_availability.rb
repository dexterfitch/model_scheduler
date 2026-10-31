# A block of time a model is free to be booked. Gigs book classes into it.
# New time must be in the future and between 8:00 AM and 10:00 PM Eastern. A block
# with a booked gig can't be edited or deleted, only cancelled through the gig.
class ArtModelAvailability < ApplicationRecord
  belongs_to :user
  has_many :gigs

  before_destroy :prevent_past_deletion
  before_destroy :prevent_destroy_with_active_gig

  enum :status, { active: 0, cancelled: 1 }

  attr_accessor :recording_past

  validates :starts_at, :ends_at, presence: true
  validate :end_after_start
  validate :must_be_within_business_hours
  validate :must_be_future_time, on: :create, unless: :recording_past
  validate :prevent_edit_with_active_gig, on: :update

  # Saves time a person added or changed, joined with any free time the same model
  # already has that overlaps it or meets it end to end, so one model never has two
  # free blocks covering the same hours. Blocks with a booked gig are left alone.
  # Returns the block that now holds the time, or false with errors set.
  def save_joining_free_time
    return save && self unless active?
    return false unless valid?

    others = ArtModelAvailability.active.where(user_id: user_id).where.not(id: id)

    if new_record?
      covering = others.where("starts_at <= ? AND ends_at >= ?", starts_at, ends_at).order(:starts_at).first
      return covering if covering
    end

    neighbours = others
      .where("starts_at <= ? AND ends_at >= ?", ends_at, starts_at)
      .where.not(id: Gig.confirmed.select(:art_model_availability_id))
      .order(:starts_at).to_a
    return save && self if neighbours.empty?

    keeper = persisted? ? self : neighbours.shift
    from = [starts_at, keeper.starts_at, *neighbours.map(&:starts_at)].min
    to   = [ends_at, keeper.ends_at, *neighbours.map(&:ends_at)].max

    transaction do
      keeper.starts_at = from
      keeper.ends_at = to
      keeper.save!
      neighbours.each do |other|
        Gig.where(art_model_availability_id: other.id).update_all(art_model_availability_id: keeper.id)
        other.delete
      end
    end
    keeper
  rescue ActiveRecord::RecordInvalid => e
    errors.merge!(e.record.errors) unless e.record.equal?(self)
    false
  end

  # The confirmed gig in this block, if any.
  def active_gig
    gigs.find { |g| g.status == 'confirmed' }
  end

  # Cancels a booked gig in this block (the one given, or the only one). With
  # cancel_remaining_series, also takes the same model off the class's later dates;
  # other models on those dates keep their bookings. Returns false if there's no gig.
  def cancel_with_gig!(cancel_remaining_series: false, flag_for_attention: false, gig_id: nil)
    gig = gig_id.present? ? gigs.find_by(id: gig_id, status: :confirmed) : active_gig
    return false unless gig

    series = gig.faculty_request.request_series

    ActiveRecord::Base.transaction do
      cancel_single_gig!(self, gig, flag_for_attention: flag_for_attention)

      if cancel_remaining_series && series
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

  # Cancels one gig, unpaid (models cancelling aren't paid), puts its date back to
  # needing a model, and cancels the block if nothing else is booked in it.
  def cancel_single_gig!(availability, gig, flag_for_attention: false)
    request = gig.faculty_request
    gig.update_columns(status: Gig.statuses[:cancelled], billable: false, updated_at: Time.current)
    request.update_columns(status: FacultyRequest.statuses[:pending], needs_attention: flag_for_attention, updated_at: Time.current) unless request.archived?
    availability.gigs.reload
    availability.update_columns(status: ArtModelAvailability.statuses[:cancelled], updated_at: Time.current) unless availability.active_gig
  end

  # Blocks that already started can't be deleted.
  def prevent_past_deletion
    if starts_at < Time.current
      errors.add(:base, "Cannot delete a past availability slot")
      throw :abort
    end
  end

  # Blocks with a booked gig can't be deleted; the gig has to be cancelled.
  def prevent_destroy_with_active_gig
    if active_gig
      errors.add(:base, "Cannot delete this availability slot because a gig is scheduled. Use 'Cancel Gig' instead.")
      throw :abort
    end
  end

  # Blocks with a booked gig can't be edited.
  def prevent_edit_with_active_gig
    if active_gig
      errors.add(:base, "Cannot edit this availability slot because a gig is scheduled. Cancel the gig first if you need to change your availability.")
    end
  end

  # New blocks must start in the future (skipped when recording time already worked).
  def must_be_future_time
    return unless starts_at

    if starts_at < Time.current
      errors.add(:starts_at, "must be in the future")
    end
  end

  # The end must come after the start.
  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end

  # Blocks must start at 8:00 AM or later and end by 10:00 PM, Eastern time.
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
