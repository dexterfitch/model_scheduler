class ArtModelAvailability < ApplicationRecord
  belongs_to :user
  has_many :gigs, dependent: :destroy

  enum :status, { active: 0, cancelled: 1 }

  validates :starts_at, :ends_at, presence: true
  validate :end_after_start
  validate :must_be_within_business_hours

  private

  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end

  def must_be_within_business_hours
    return unless starts_at && ends_at

    # FIX: Convert to Eastern Time before checking the hour
    # This ensures 8 PM EST is treated as 20:00, not 01:00 UTC
    start_local = starts_at.in_time_zone("Eastern Time (US & Canada)")
    end_local   = ends_at.in_time_zone("Eastern Time (US & Canada)")

    if start_local.hour < 8
      errors.add(:starts_at, "cannot be before 8:00 AM ET")
    end

    # Check for late night (after 10 PM)
    # We check if hour > 22 OR if it's exactly 10:01+ PM
    if end_local.hour > 22 || (end_local.hour == 22 && end_local.min > 0)
      errors.add(:ends_at, "cannot be after 10:00 PM ET")
    end
  end
end