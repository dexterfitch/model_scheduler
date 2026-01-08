class ArtModelAvailability < ApplicationRecord
  belongs_to :user
  has_many :gigs, dependent: :destroy

  # 'active' means the model is available during this window
  # 'cancelled' means the model has withdrawn this specific availability block
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

    day_start = starts_at.beginning_of_day + 8.hours
    day_end = starts_at.beginning_of_day + 22.hours

    if starts_at < day_start
      errors.add(:starts_at, "cannot be before 8:00 AM")
    end

    if ends_at > day_end
      errors.add(:ends_at, "cannot be after 10:00 PM")
    end
  end
end