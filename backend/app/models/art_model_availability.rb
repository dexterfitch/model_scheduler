class ArtModelAvailability < ApplicationRecord
  belongs_to :user
  has_many :gigs
  before_destroy :release_future_gigs

  enum :status, { active: 0, cancelled: 1 }

  validates :starts_at, :ends_at, presence: true
  validate :end_after_start
  validate :must_be_within_business_hours
  validate :must_be_future_time, on: :create

  private

  def release_future_gigs
    gigs.each do |gig|
      if gig.faculty_request.starts_at > Time.current
        result = gig.faculty_request.update_column(:status, 0)
        gig.destroy
      end
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