class FacultyRequest < ApplicationRecord
  belongs_to :user
  has_one :gig, dependent: :destroy

  enum :status, { pending: 0, matched: 1, archived: 2 }
  
  # New enum: Is the class Nude (1) or Clothed (0)?
  enum :model_mode, { clothed: 0, nude: 1 }

  validates :starts_at, :ends_at, :class_name, :model_mode, presence: true
  validate :end_after_start
  validate :must_be_faculty_role
  validate :must_be_within_business_hours

  private

  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end

  def must_be_faculty_role
    errors.add(:user, "must be faculty") unless user&.role_faculty?
  end

  def must_be_within_business_hours
    return unless starts_at && ends_at

    # Create the boundaries for the specific day of the request
    # usage: date_of_event at 8:00 AM
    day_start = starts_at.beginning_of_day + 8.hours
    # usage: date_of_event at 10:00 PM
    day_end = starts_at.beginning_of_day + 22.hours

    if starts_at < day_start
      errors.add(:starts_at, "cannot be before 8:00 AM")
    end

    if ends_at > day_end
      errors.add(:ends_at, "cannot be after 10:00 PM")
    end
  end
end