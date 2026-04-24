class FacultyRequest < ApplicationRecord
  belongs_to :user
  has_one :gig

  enum :model_mode, { clothed: 0, nude: 1 }
  enum :status, { pending: 0, matched: 1, archived: 2 }

  DEPARTMENTS = [
    "Painting", 
    "Drawing", 
    "Illustration", 
    "FYE", 
    "Sculpture", 
    "Open Studies"
  ]

  validates :starts_at, :ends_at, :class_name, :model_mode, presence: true
  validate :end_after_start
  validate :must_be_faculty_role, on: :create
  validate :must_be_within_business_hours
  validates :department, presence: true, inclusion: { in: DEPARTMENTS }
  validate :must_be_future_date
  validate :must_be_within_four_months

  private

  def must_be_future_date
    return unless starts_at

    if starts_at.to_date <= Date.current
      errors.add(:starts_at, "must be at least one day in the future")
    end
  end

  def must_be_within_four_months
    return unless starts_at

    if starts_at > 4.months.from_now
      errors.add(:starts_at, "cannot be more than 4 months in the future")
    end
  end

  def must_be_faculty_role
    errors.add(:user, "must be a faculty member") unless user&.role_faculty?
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