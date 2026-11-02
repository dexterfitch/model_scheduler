# Anyone who signs in: an admin, faculty member or model (role is chosen on first
# sign-in). Models answer personal questions used for matching; every one can be
# Prefer not to say or left blank, except skin tone and gender, which must be answered.
# A model can be retired (no longer offered or counted), and anyone's data can be
# removed on request, which keeps their past gigs and classes under "Removed Person".
class User < ApplicationRecord
  # Raised when a person can't be retired or removed yet, with the reason.
  class NotYet < StandardError; end

  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy
  has_many :request_series, dependent: :destroy
  has_many :notifications, dependent: :delete_all
  has_many :error_reports, dependent: :nullify

  GENDER_IDENTITIES = ["Woman", "Man", "Non-binary", "Prefer not to say"].freeze
  SKIN_TONES = ["Light", "Medium", "Dark"].freeze
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
    validates :skin_tone, inclusion: { in: SKIN_TONE_ANSWERS, message: "must be chosen (Light, Medium, Dark or Prefer not to say)" }
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
    validates :body_type, inclusion: { in: BODY_TYPES }, allow_nil: true
    validates :genitalia, inclusion: { in: GENITALIA }, allow_nil: true
  end

  # The user for a Google sign-in, matched by email, created if new, with name and photo filled in.
  def self.from_omniauth(auth)
    email = auth.info.email.to_s.downcase
    user = where("LOWER(email) = ?", email).first_or_initialize(email: email)
    user.first_name = auth.info.first_name if user.first_name.blank?
    user.last_name = auth.info.last_name if user.last_name.blank?
    user.image_url = auth.info.image
    user
  end

  # Profile JSON without timestamps or the private calendar link token.
  def as_json(options = {})
    super({ except: [:created_at, :updated_at, :calendar_token] }.merge(options))
  end

  # The matching option from today's list, ignoring capitals and spaces, or nil.
  def self.current_option(value, options)
    options.find { |option| option.casecmp?(value.to_s.strip) }
  end

  # One-time cleanup for profiles saved under older option lists: old spellings
  # become today's; values that no longer exist are cleared, except a model's
  # gender, which becomes Prefer not to say. Saved without validation, so a model
  # whose skin tone was cleared is asked for it on their profile.
  def self.bring_all_profile_values_up_to_date!
    find_each do |user|
      user.gender_identity = current_option(user.gender_identity, GENDER_IDENTITIES)
      user.gender_identity ||= "Prefer not to say" if user.role_model?
      user.skin_tone = current_option(user.skin_tone, SKIN_TONE_ANSWERS)
      user.body_type = current_option(user.body_type, BODY_TYPES)
      user.genitalia = current_option(user.genitalia, GENITALIA)

      user.save!(validate: false) if user.changed?
    end
  end

  # Whether the model has retired from the pool.
  def retired?
    retired_at.present?
  end

  # The model's confirmed gigs on dates still to come.
  def upcoming_gigs
    Gig.confirmed.joins(:art_model_availability, :faculty_request)
      .where(art_model_availabilities: { user_id: id })
      .where("faculty_requests.starts_at > ?", Time.current)
  end

  # The faculty member's class dates still to come that aren't cancelled.
  def upcoming_class_dates
    FacultyRequest.where(user_id: id).where.not(status: :archived).where("starts_at > ?", Time.current)
  end

  # Retires a model: their free time still to come is taken away, so they're no
  # longer offered or counted. Past gigs stay. Raises NotYet while they have
  # upcoming gigs.
  def retire!
    refuse_with_upcoming_gigs!
    transaction do
      clear_future_free_time!
      update_columns(retired_at: Time.current, updated_at: Time.current)
    end
  end

  # Removes a person's data on request: name, contact details, photo and every
  # personal answer are cleared, their free time still to come and their updates are
  # deleted, and every sign-in and calendar link ends. Their past gigs and classes stay, so pay and
  # reports still add up. Raises NotYet while they have upcoming gigs or classes.
  def remove_data!
    refuse_with_upcoming_gigs!
    classes = upcoming_class_dates.count
    if classes.positive?
      raise NotYet, "#{first_name} has #{classes} upcoming class date#{'s' if classes != 1}. Cancel #{classes == 1 ? 'it' : 'them'} first."
    end

    transaction do
      clear_future_free_time!
      notifications.delete_all
      update_columns(
        first_name: "Removed", last_name: "Person", email: "removed-#{id}@removed.invalid",
        phone: nil, stage_name: nil, pronouns: nil, skin_tone: nil, gender_identity: nil,
        body_type: nil, genitalia: nil, image_url: nil, willing_to_model_nude: false, superuser: false,
        retired_at: retired_at || Time.current, removed_at: Time.current, calendar_token: nil,
        token_version: token_version + 1, updated_at: Time.current
      )
    end
  end

  private

  # Raises NotYet while the model has confirmed gigs still to come.
  def refuse_with_upcoming_gigs!
    count = upcoming_gigs.count
    return if count.zero?

    raise NotYet, "#{first_name} has #{count} upcoming gig#{'s' if count != 1}. Release them first."
  end

  # Takes away free time that hasn't started: blocks with gig history are cancelled
  # (keeping the history), the rest are deleted.
  def clear_future_free_time!
    future = art_model_availabilities.where("starts_at > ?", Time.current)
    with_history = Gig.select(:art_model_availability_id)
    future.where(id: with_history).update_all(status: ArtModelAvailability.statuses[:cancelled], updated_at: Time.current)
    future.where.not(id: with_history).delete_all
  end

  # A model can't stop posing nude while booked into an upcoming nude class.
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

  # Blank answers are saved as blank; genitalia is only kept for models willing to pose nude.
  def normalize_model_attributes
    self.body_type = nil if body_type.blank?
    self.genitalia = nil if genitalia.blank?
    self.genitalia = nil unless willing_to_model_nude
  end
end
