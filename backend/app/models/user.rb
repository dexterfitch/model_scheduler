class User < ApplicationRecord
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy
  has_many :request_series, dependent: :destroy

  GENDER_IDENTITIES = ["Woman", "Man", "Non-binary", "Prefer not to say"].freeze
  SKIN_TONES = ["Light", "Medium", "Dark"].freeze
  # What a model can answer about themselves. Requests can only ask for SKIN_TONES.
  SKIN_TONE_ANSWERS = (SKIN_TONES + ["Prefer not to say"]).freeze
  BODY_TYPES = ["Muscular", "Average", "Fat"].freeze
  GENITALIA = ["Male", "Female", "Intersex"].freeze

  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true

  before_validation :normalize_model_attributes
  validate :no_upcoming_nude_bookings, on: :update,
  if: -> { role_model? && willing_to_model_nude_changed?(from: true, to: false) }

  validates :first_name, :last_name, :email, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :email, format: { with: /\A[^@]+@mica\.edu\z/i, message: "must be a MICA email address" }
  validates :role, presence: true, on: :update, if: -> { role_was.present? }

  with_options if: :role_model? do
    validates :gender_identity, presence: true
    validates :gender_identity, inclusion: { in: GENDER_IDENTITIES }
    # One clear message whether the skin tone is missing or not an option
    validates :skin_tone, inclusion: { in: SKIN_TONE_ANSWERS, message: "must be chosen (Light, Medium, Dark or Prefer not to say)" }
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
    # Both optional so existing model profiles stay valid
    validates :body_type, inclusion: { in: BODY_TYPES }, allow_nil: true
    validates :genitalia, inclusion: { in: GENITALIA }, allow_nil: true
  end

  def self.from_omniauth(auth)
    email = auth.info.email.to_s.downcase
    user = where("LOWER(email) = ?", email).first_or_initialize(email: email)
    user.first_name = auth.info.first_name if user.first_name.blank?
    user.last_name = auth.info.last_name if user.last_name.blank?
    user.image_url = auth.info.image
    user
  end

  def as_json(options = {})
    super({ except: [:created_at, :updated_at] }.merge(options))
  end

  # The matching option from today's list, ignoring capitals and spaces, or nil
  def self.current_option(value, options)
    options.find { |option| option.casecmp?(value.to_s.strip) }
  end

  # One-time cleanup for profiles saved under older option lists. Old spellings
  # (like "Non-Binary") become today's spelling; values that no longer exist are
  # cleared, except a model's gender, which becomes "Prefer not to say".
  def self.bring_all_profile_values_up_to_date!
    find_each do |user|
      user.gender_identity = current_option(user.gender_identity, GENDER_IDENTITIES)
      user.gender_identity ||= "Prefer not to say" if user.role_model?
      user.skin_tone = current_option(user.skin_tone, SKIN_TONE_ANSWERS)
      user.body_type = current_option(user.body_type, BODY_TYPES)
      user.genitalia = current_option(user.genitalia, GENITALIA)

      # Skip validation: a model whose skin tone was cleared should still be
      # saved, and will be asked to choose one on their profile
      user.save!(validate: false) if user.changed?
    end
  end

  private

  def no_upcoming_nude_bookings
    count = Gig.where(status: :confirmed)
      .joins(:art_model_availability, :faculty_request)
      .where(art_model_availabilities: { user_id: id })
      .where(faculty_requests: { model_mode: FacultyRequest.model_modes[:nude] })
      .where("faculty_requests.starts_at > ?", Time.current)
      .count
    return if count.zero?

    errors.add(:base, "You're booked for #{count} nude session#{'s' if count > 1}; cancel #{count > 1 ? 'those' : 'it'} first.")
  end

  def normalize_model_attributes
    self.body_type = nil if body_type.blank?
    self.genitalia = nil if genitalia.blank?
    # Only nude sessions use this, so don't keep it for clothed-only models
    self.genitalia = nil unless willing_to_model_nude
  end
end
