class FacultyRequest < ApplicationRecord
  belongs_to :user
  belongs_to :request_series, optional: true
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

  BUILDINGS = ["Main", "Fox", "Lazarus", "Station"].freeze

  validates :starts_at, :ends_at, :class_name, :model_mode, presence: true
  validate :end_after_start
  validate :must_be_faculty_role, on: :create, unless: -> { request_series_id.present? }
  validate :must_be_within_business_hours
  validates :department, presence: true, inclusion: { in: DEPARTMENTS }
  validates :building, presence: true, inclusion: { in: BUILDINGS }
  validates :pref_gender, inclusion: { in: User::GENDER_IDENTITIES + ["Any"] }, allow_nil: true
  validates :pref_skin_tone, inclusion: { in: User::SKIN_TONES + ["Any"] }, allow_nil: true
  validate :must_be_future_date, on: :create
  validate :must_be_within_four_months, on: :create
  validate :validate_matched_reschedule, on: :update, if: -> { matched? && gig.present? && (starts_at_changed? || ends_at_changed?) }
  after_save :sync_matched_gig_availability, if: -> { matched? && gig.present? && (saved_change_to_starts_at? || saved_change_to_ends_at?) }
  
  private

  def validate_matched_reschedule
    model_user = gig.art_model_availability.user
    conflict = Gig.where(status: 'confirmed')
      .joins(:art_model_availability)
      .where(art_model_availabilities: { user_id: model_user.id })
      .where.not(id: gig.id)
      .any? do |other_gig|
        other_start = other_gig.faculty_request.starts_at
        other_end = other_gig.faculty_request.ends_at
        other_start < ends_at && other_end > starts_at
      end

    if conflict
      errors.add(:base, "This model already has another confirmed gig that overlaps with the new time. Coordinate with the model before rescheduling.")
    end
  end

  def sync_matched_gig_availability
    gig.art_model_availability.update_columns(starts_at: starts_at, ends_at: ends_at)
  end

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