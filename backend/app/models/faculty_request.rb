# One dated session of a class: when, where, and the model preferences copied from
# its series. It can need several models; only confirmed gigs count toward that,
# while cancelled gigs stay for history and billing.
class FacultyRequest < ApplicationRecord
  belongs_to :user
  belongs_to :request_series
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

  # How many models are booked.
  def booked_count
    confirmed_gigs.count
  end

  # How many more models are needed.
  def open_slots
    [models_needed - booked_count, 0].max
  end

  # Whether every requested model is booked.
  def fully_staffed?
    booked_count >= models_needed
  end
  
  # For classes with per-model preferences: the open spot (by position) this model
  # fits best, or nil. Ties go to the lowest-numbered spot.
  def best_open_slot_for(user)
    slots = request_series&.model_slots.to_a
    return nil if slots.empty?

    taken = confirmed_gigs.pluck(:model_slot_position).compact
    open = slots.reject { |slot| taken.include?(slot.position) }
    open.max_by { |slot| [slot.match_score(user, nude: nude?), -slot.position] }&.position
  end

  # For a date needing attention: the name of the model whose booking was cancelled most recently.
  def dropped_out_model_name
    return unless needs_attention?

    user = gigs.cancelled.order(updated_at: :desc).first&.art_model_availability&.user
    user && "#{user.first_name} #{user.last_name}"
  end

  # Marks the date matched when every model is booked, or pending otherwise. Status only, without
  # validation.
  def refresh_match_status!
    return if archived?
    update_columns(status: FacultyRequest.statuses[fully_staffed? ? :matched : :pending], updated_at: Time.current)
  end

  # One-time cleanup: dates made before classes existed get a class of their own,
  # copying their details, so they show up on every page. Saved without validation
  # so old values can't block the move.
  def self.wrap_standalone_requests_in_series!
    where(request_series_id: nil).find_each do |request|
      series = RequestSeries.new(request.attributes.slice(*RequestSeries::SHARED_ATTRIBUTES))
      series.user_id = request.user_id
      %w[pref_skin_tone pref_gender pref_body_type pref_genitalia].each { |pref| series[pref] ||= "Any" }
      series.status = request.archived? ? :archived : (request.matched? ? :matched : :pending)
      series.save!(validate: false)
      request.update_columns(request_series_id: series.id)
    end
  end

  # Cancels the date: booked models are released (paid if it's the same day) and the
  # date is archived, kept so admins can still see what was cancelled. Status changes
  # only, so dates saved under older rules can still be cancelled. Returns whether
  # the cancellation was same-day.
  def cancel_with_billing!
    is_late_cancel = starts_at.to_date == Date.current

    transaction do
      booked = confirmed_gigs.includes(:art_model_availability).to_a

      update_columns(status: FacultyRequest.statuses[:archived], updated_at: Time.current)
      booked.each do |gig|
        gig.update_columns(status: Gig.statuses[:cancelled], billable: is_late_cancel, updated_at: Time.current)
        gig.art_model_availability.update_columns(status: ArtModelAvailability.statuses[:active], updated_at: Time.current)
      end
    end

    is_late_cancel
  end
  
  private
  
  # A date can't switch to nude while a clothed-only model is booked.
  def booked_models_allow_nudity
    clothed_only = confirmed_gigs.includes(art_model_availability: :user)
      .map { |g| g.art_model_availability.user }
      .reject(&:willing_to_model_nude)
    return if clothed_only.empty?

    names = clothed_only.map { |u| "#{u.first_name} #{u.last_name}" }.to_sentence
    errors.add(:base, "Can't switch to nude: #{names} only model clothed. Release them first.")
  end

  # Blank preferences mean Any; genitalia only applies to nude sessions.
  def normalize_preferences
    self.pref_body_type = "Any" if pref_body_type.blank?
    self.pref_genitalia = "Any" if pref_genitalia.blank? || !nude?
  end

  # The number of models can't drop below how many are already booked.
  def models_needed_covers_booked_models
    booked = booked_count
    if models_needed.to_i < booked
      errors.add(:models_needed, "can't be lower than the #{booked} model(s) already booked. Release a model first.")
    end
  end

  # A booked date can't move onto a time when its model has another booked class.
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

  # After a booked date moves, moves its models' free time with it. A block shared
  # with other classes stays put, and the moved date gets a block of its own.
  def sync_booked_gig_availabilities
    confirmed_gigs.includes(:art_model_availability).each do |booked_gig|
      slot = booked_gig.art_model_availability
      shared = slot.gigs.where(status: :confirmed).where.not(id: booked_gig.id).exists?

      if shared
        new_slot = ArtModelAvailability.create!(user_id: slot.user_id, starts_at: starts_at, ends_at: ends_at)
        booked_gig.update_column(:art_model_availability_id, new_slot.id)
      else
        slot.update_columns(starts_at: starts_at, ends_at: ends_at)
      end
    end
  end

  # After the number of models changes, updates whether the date is fully booked.
  def sync_status_with_staffing
    refresh_match_status!
  end

  # New dates must be tomorrow or later.
  def must_be_future_date
    return unless starts_at

    if starts_at.to_date <= Date.current
      errors.add(:starts_at, "must be at least one day in the future")
    end
  end

  # New dates can't be more than four months away.
  def must_be_within_four_months
    return unless starts_at

    if starts_at > 4.months.from_now
      errors.add(:starts_at, "cannot be more than 4 months in the future")
    end
  end

  # Dates made outside a class must belong to a faculty member.
  def must_be_faculty_role
    errors.add(:user, "must be a faculty member") unless user&.role_faculty?
  end

  # The end must come after the start.
  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end

  # Dates must start at 8:00 AM or later and end by 10:00 PM, Eastern time.
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
