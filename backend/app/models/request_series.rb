class RequestSeries < ApplicationRecord
  belongs_to :user
  has_many :faculty_requests, dependent: :destroy
  has_many :model_slots, -> { order(:position) }, dependent: :destroy

  enum :status, { pending: 0, matched: 1, archived: 2 }

  # Attributes that live on the series and get copied onto each dated request
  SHARED_ATTRIBUTES = %w[
    class_name department building model_mode
    pref_skin_tone pref_gender pref_body_type pref_genitalia
    models_needed notes room_number
  ].freeze

  before_validation :normalize_preferences

  validates :class_name, presence: true
  validates :department, presence: true
  validates :building, presence: true, inclusion: { in: FacultyRequest::BUILDINGS }
  validates :model_mode, presence: true, inclusion: { in: %w[clothed nude] }
  validates :pref_gender, inclusion: { in: User::GENDER_IDENTITIES + ["Any"] }, allow_nil: true
  validates :pref_skin_tone, inclusion: { in: User::SKIN_TONES + ["Any"] }, allow_nil: true
  validates :pref_body_type, inclusion: { in: User::BODY_TYPES + ["Any"] }, allow_nil: true
  validates :pref_genitalia, inclusion: { in: User::GENITALIA + ["Any"] }, allow_nil: true
  validates :models_needed, numericality: {
    only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: FacultyRequest::MAX_MODELS_PER_REQUEST
  }
  validates :user, presence: true

  scope :with_pending_requests, -> {
    joins(:faculty_requests).where(faculty_requests: { status: :pending }).distinct
  }

  scope :visible_to_model, ->(model_user) {
    with_pending_requests.where(
      "request_series.model_mode = 'clothed' OR ?", model_user.willing_to_model_nude
    )
  }
  
  # Replace the per-model preferences, in order. An empty list means the same
  # preferences for every model (the series' own).
  def assign_model_slots!(list)
    model_slots.destroy_all
    list.each_with_index { |prefs, i| model_slots.create!(prefs.merge(position: i + 1)) }
    release_slot_positions_beyond!(list.length)
  end

  # When the number of models changes, keep one slot per model: drop extras,
  # and add new ones that accept anyone
  def resize_model_slots!
    return if model_slots.empty?

    model_slots.where("position > ?", models_needed).destroy_all
    ((model_slots.count + 1)..models_needed).each { |position| model_slots.create!(position: position) }
    release_slot_positions_beyond!(models_needed)
  end

  # Bookings in slots that no longer exist stay booked, just not tied to a slot
  def release_slot_positions_beyond!(count)
    Gig.where(faculty_request_id: faculty_requests.select(:id))
       .where("model_slot_position > ?", count)
       .update_all(model_slot_position: nil)
  end

  def update_status!
    active_requests = faculty_requests.where.not(status: :archived)

    new_status = if active_requests.none?
      :archived
    elsif active_requests.all? { |r| r.status == 'matched' }
      :matched
    else
      :pending
    end
    update_columns(status: RequestSeries.statuses[new_status], updated_at: Time.current)
  end

  # Most models already booked on any one remaining date; models_needed can't go below this.
  def max_booked_on_active_request
    faculty_requests.where.not(status: :archived).map(&:booked_count).max || 0
  end
  
  def release_remaining_for_rematch!
    future_requests = faculty_requests
      .where.not(status: :archived)
      .where("starts_at > ?", Time.current)

    ActiveRecord::Base.transaction do
      future_requests.each do |request|
        booked = request.confirmed_gigs.includes(:art_model_availability).to_a
        next if booked.empty?

        booked.each do |gig|
          availability = gig.art_model_availability
          # Same rule as releasing a single date: same-day releases are paid
          gig.update_columns(status: Gig.statuses[:cancelled],
            billable: request.starts_at.to_date == Date.current, updated_at: Time.current)
          availability.update_columns(status: ArtModelAvailability.statuses[:active], updated_at: Time.current)
        end
        request.update_columns(status: FacultyRequest.statuses[:pending], updated_at: Time.current)
      end
    end

    update_status!
  end

  def cancel_entire_series!
    ActiveRecord::Base.transaction do
      faculty_requests.each do |request|
        # Sessions that already started were worked and must stay billable
        next if request.status == 'archived' || request.starts_at <= Time.current
        request.cancel_with_billing!
      end
      update_status!
    end
  end

  private

  def normalize_preferences
    self.pref_body_type = "Any" if pref_body_type.blank?
    self.pref_genitalia = "Any" if pref_genitalia.blank? || model_mode != "nude"
  end
end
