class User < ApplicationRecord
  has_secure_password

  # Associations
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy

  # Roles
  # We add prefix: true to avoid collision with the reserved word "model"
  # This generates methods like: role_admin?, role_faculty?, role_model?
  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true

  validates :first_name, :last_name, :email, presence: true
  validates :email, uniqueness: true

  # Model-specific validations
  # We use the auto-generated "role_model?" method
  with_options if: :role_model? do
    validates :skin_tone, :gender_identity, presence: true
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
  end
end