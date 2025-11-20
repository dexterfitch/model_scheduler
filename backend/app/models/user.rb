class User < ApplicationRecord
  has_secure_password

  # Associations
  has_many :availabilities, dependent: :destroy
  has_many :faculty_booking_requests,
           class_name: 'BookingRequest',
           foreign_key: :faculty_id,
           inverse_of: :faculty,
           dependent: :restrict_with_error

  # Roles
  enum :role, { model: 0, faculty: 1, admin: 2 }, prefix: true

  # Normalization
  before_validation :normalize_email

  # Validations
  validates :first_name, :last_name, presence: true
  validates :email,
            presence: true,
            format: { with: URI::MailTo::EMAIL_REGEXP },
            uniqueness: { case_sensitive: false }
  validates :role, presence: true
  validates :password, length: { minimum: 8 }, if: -> { new_record? || password.present? }
  validates :nude_model, inclusion: { in: [true, false] }
  validate  :nude_flag_only_for_models

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end

  def nude_flag_only_for_models
    if !role_model? && nude_model
      errors.add(:nude_model, "can only be true for art models")
    end
  end
end