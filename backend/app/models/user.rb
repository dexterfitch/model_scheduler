class User < ApplicationRecord
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy
  has_many :request_series, dependent: :destroy

  GENDER_IDENTITIES = ["Woman", "Man", "Non-binary", "Prefer not to say"].freeze
  SKIN_TONES = ["Light", "Medium", "Dark"].freeze

  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true

  validates :first_name, :last_name, :email, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :email, format: { with: /\A[^@]+@mica\.edu\z/i, message: "must be a MICA email address" }
  validates :role, presence: true, on: :update, if: -> { role_was.present? }

  with_options if: :role_model? do
    validates :skin_tone, :gender_identity, presence: true
    validates :gender_identity, inclusion: { in: GENDER_IDENTITIES }
    validates :skin_tone, inclusion: { in: SKIN_TONES }
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
  end

  def self.from_omniauth(auth)
    user = where(email: auth.info.email).first_or_initialize
    user.first_name = auth.info.first_name
    user.last_name = auth.info.last_name
    user.image_url = auth.info.image
    user
  end

  def as_json(options = {})
    super({ except: [:created_at, :updated_at] }.merge(options))
  end
end