class FacultyRequest < ApplicationRecord
  belongs_to :user
  belongs_to :request_series, optional: true
  # A request can now be staffed by several models. Cancelled/completed gigs stay
  # in `gigs` for history and billing; only confirmed ones count toward staffing.
  has_many :gigs
  has_many :confirmed_gigs, -> { where(status: :confirmed) }, class_name: "Gig"

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
  MAX_MODELS_PER_REQUEST = 6

  before_validation :normalize_preferences

  validates :starts_at, :ends_at, :class_name, :model_mode, presence: true
  validate :end_after_start
  validate :must_be_faculty_role, on: :create, unless: -> { request_series_id.present? }
  validate :must_be_within_business_hours
  validates :department, presence: true, inclusion: { in: DEPARTMENTS }
  validates :building, presence: true, inclusion: { in: BUILDINGS }
  validates :pref_gender, inclusion: { in: User::GENDER_IDENTITIES + ["Any"] }, allow_nil: true
  validates :pref_skin_tone, inclusion: { in: User::SKIN_TONES + ["Any"] }, allow_nil: true
  validates :pref_body_type, inclusion: { in: User::BODY_TYPES + ["Any"] }, allow_nil: true
  validates :pref_genitalia, inclusion: { in: User::GENITALIA + ["Any"] }, allow_nil: true
  validates :models_needed, numericality: {
    only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: MAX_MODELS_PER_REQUEST
  }
  validate :models_needed_covers_booked_models, on: :update, if: :models_needed_changed?
  validate :must_be_future_date, on: :create
  validate :must_be_within_four_months, on: :create
  validate :validate_booked_reschedule, on: :update, if: -> { (starts_at_changed? || ends_at_changed?) && confirmed_gigs.exists? }
  validate :booked_models_allow_nudity, on: :update, if: -> { nude? && model_mode_changed? }
  after_save :sync_booked_gig_availabilities, if: -> { saved_change_to_starts_at? || saved_change_to_ends_at? }
  after_save :sync_status_with_staffing, if: :saved_change_to_models_needed?

  def booked_count
    confirmed_gigs.count
  end

  def open_slots
    [models_needed - booked_count, 0].max
  end

  def fully_staffed?
    booked_count >= models_needed
  end

  # matched = every requested model is booked; pending = at least one slot still open
  def refresh_match_status!
    return if archived?
    # Status-only change; skip validations so older records with legacy values
    # don't block a booking/cancellation
    update_columns(status: FacultyRequest.statuses[fully_staffed? ? :matched : :pending], updated_at: Time.current)
  end

  # Cancels every booked model on this date (billable if same-day), then archives
  # or deletes the request. Returns whether the cancellation was late (billable).
  def cancel_with_billing!
    is_late_cancel = starts_at.to_date == Date.current

    transaction do
      booked = confirmed_gigs.includes(:art_model_availability).to_a

      if booked.any?
        update!(status: :archived)
        booked.each do |gig|
          gig.update!(status: :cancelled, billable: is_late_cancel)
          gig.art_model_availability.update!(status: :active)
        end
      elsif gigs.exists?
        update!(status: :archived)
      else
        destroy!
      end
    end

    is_late_cancel
  end
  
  private
  
  def booked_models_allow_nudity
    clothed_only = confirmed_gigs.includes(art_model_availability: :user)
      .map { |g| g.art_model_availability.user }
      .reject(&:willing_to_model_nude)
    return if clothed_only.empty?

    names = clothed_only.map { |u| "#{u.first_name} #{u.last_name}" }.to_sentence
    errors.add(:base, "Can't switch to nude: #{names} only model clothed. Release them first.")
  end

  def normalize_preferences
    self.pref_body_type = "Any" if pref_body_type.blank?
    self.pref_genitalia = "Any" if pref_genitalia.blank? || !nude?
  end

  def models_needed_covers_booked_models
    booked = booked_count
    if models_needed.to_i < booked
      errors.add(:models_needed, "can't be lower than the #{booked} model(s) already booked. Release a model first.")
    end
  end

  def validate_booked_reschedule
    confirmed_gigs.includes(art_model_availability: :user).each do |booked_gig|
      model_user = booked_gig.art_model_availability.user
      conflict = Gig.where(status: :confirmed)
        .joins(:art_model_availability, :faculty_request)
        .where(art_model_availabilities: { user_id: model_user.id })
        .where.not(id: booked_gig.id)
        .where("faculty_requests.starts_at < ? AND faculty_requests.ends_at > ?", ends_at, starts_at)
        .exists?

      if conflict
        errors.add(:base, "#{model_user.first_name} #{model_user.last_name} already has another confirmed gig that overlaps with the new time. Coordinate with the model before rescheduling.")
      end
    end
  end

  def sync_booked_gig_availabilities
    confirmed_gigs.includes(:art_model_availability).each do |booked_gig|
      booked_gig.art_model_availability.update_columns(starts_at: starts_at, ends_at: ends_at)
    end
  end

  def sync_status_with_staffing
    refresh_match_status!
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