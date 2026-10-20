class User < ApplicationRecord
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy
  has_many :request_series, dependent: :destroy

  GENDER_IDENTITIES = ["Woman", "Man", "Non-binary", "Prefer not to say"].freeze
  SKIN_TONES = ["Light", "Medium", "Dark"].freeze
  BODY_TYPES = ["Muscular", "Average", "Fat"].freeze
  GENITALIA = ["Male", "Female", "Intersex"].freeze

  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true

  before_validation :normalize_model_attributes

  validates :first_name, :last_name, :email, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :email, format: { with: /\A[^@]+@mica\.edu\z/i, message: "must be a MICA email address" }
  validates :role, presence: true, on: :update, if: -> { role_was.present? }

  with_options if: :role_model? do
    validates :skin_tone, :gender_identity, presence: true
    validates :gender_identity, inclusion: { in: GENDER_IDENTITIES }
    validates :skin_tone, inclusion: { in: SKIN_TONES }
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

  private

  def normalize_model_attributes
    self.body_type = nil if body_type.blank?
    self.genitalia = nil if genitalia.blank?
    # Only nude sessions use this, so don't keep it for clothed-only models
    self.genitalia = nil unless willing_to_model_nude
  end
end
