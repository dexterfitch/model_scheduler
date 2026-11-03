# A class: one or more dates sharing the same details and model preferences, owned
# by a faculty member. Its status sums up its dates: archived when all are
# cancelled, matched when all are booked, pending otherwise.
class RequestSeries < ApplicationRecord
  belongs_to :user
  has_many :faculty_requests, dependent: :destroy
  has_many :model_slots, -> { order(:position) }, dependent: :destroy

  enum :status, { pending: 0, matched: 1, archived: 2 }

  SHARED_ATTRIBUTES = %w[
    class_name department building model_mode
    pref_skin_tone pref_gender pref_body_type pref_genitalia
    models_needed notes room_number
  ].freeze

  before_validation :normalize_preferences
  before_validation :normalize_blank_text

  validates :class_name, presence: true
  validates :department, presence: true
  validates :department, inclusion: { in: FacultyRequest::DEPARTMENTS }, if: :department_changed?
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
  
  # Replaces the per-model preferences, in order. An empty list means the same
  # preferences for every model.
  def assign_model_slots!(list)
    model_slots.destroy_all
    list.each_with_index { |prefs, i| model_slots.create!(prefs.merge(position: i + 1)) }
    release_slot_positions_beyond!(list.length)
  end

  # After the number of models changes, keeps one spot per model: drops extras and adds open ones.
  def resize_model_slots!
    return if model_slots.empty?

    model_slots.where("position > ?", models_needed).destroy_all
    ((model_slots.count + 1)..models_needed).each { |position| model_slots.create!(position: position) }
    release_slot_positions_beyond!(models_needed)
  end

  # Bookings in spots that no longer exist stay booked, without a spot.
  def release_slot_positions_beyond!(count)
    Gig.where(faculty_request_id: faculty_requests.select(:id))
       .where("model_slot_position > ?", count)
       .update_all(model_slot_position: nil)
  end

  # Recomputes the class's status from its dates. Status only, without validation.
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

  # The most models booked on any one remaining date.
  def max_booked_on_active_request
    faculty_requests.where.not(status: :archived).map(&:booked_count).max || 0
  end
  
  # Releases every booked model from the dates still to come (paid if same-day) and
  # puts those dates back to needing a model.
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
          gig.update_columns(status: Gig.statuses[:cancelled],
            billable: request.starts_at.to_date == Date.current, updated_at: Time.current)
          availability.update_columns(status: ArtModelAvailability.statuses[:active], updated_at: Time.current)
        end
        request.update_columns(status: FacultyRequest.statuses[:pending], updated_at: Time.current)
      end
    end

    update_status!
  end

  # Cancels every date that hasn't started; dates already worked stay on record.
  def cancel_entire_series!
    ActiveRecord::Base.transaction do
      faculty_requests.each do |request|
        next if request.status == 'archived' || request.starts_at <= Time.current
        request.cancel_with_billing!
      end
      update_status!
    end
  end

  private

  # Empty notes and room are saved as nothing, so blank text sent back by a form isn't a change.
  def normalize_blank_text
    self.notes = notes.presence
    self.room_number = room_number.presence
  end

  # Blank preferences mean Any; genitalia only applies to nude classes.
  def normalize_preferences
    self.pref_body_type = "Any" if pref_body_type.blank?
    self.pref_genitalia = "Any" if pref_genitalia.blank? || model_mode != "nude"
  end
end
