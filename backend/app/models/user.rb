class User < ApplicationRecord
  # Associations
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy

  # Roles
  # We add prefix: true to avoid collision with the reserved word "model"
  # This generates methods like: role_admin?, role_faculty?, role_model?
  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true

  # VALIDATIONS
  validates :first_name, :last_name, :email, presence: true
  validates :email, presence: true, uniqueness: true
  validates :email, format: { with: /@mica\.edu\z/i, message: "must be a MICA email address" }
  
  # NEW: Allow role to be nil on create (first login), but require it for any updates.
  validates :role, presence: true, on: :update

  def self.from_omniauth(auth)
    # Find user by email (or create if new)
    where(email: auth.info.email).first_or_initialize do |user|
      user.first_name = auth.info.first_name
      user.last_name = auth.info.last_name
      user.email = auth.info.email
      
      # Note: We do NOT set user.role here. 
      # It defaults to nil so the frontend can detect it and redirect to Role Selection.
    end
  end

  # Model-specific validations
  # We use the auto-generated "role_model?" method
  # These will strictly only run if the role has been set to 'model'
  with_options if: :role_model? do
    validates :skin_tone, :gender_identity, presence: true
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
  end
end