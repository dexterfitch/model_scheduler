class User < ApplicationRecord
  has_many :art_model_availabilities, dependent: :destroy
  has_many :faculty_requests, dependent: :destroy
  
  enum :role, { admin: 0, faculty: 1, model: 2 }, prefix: true
  
  validates :first_name, :last_name, :email, presence: true
  validates :email, presence: true, uniqueness: true
  validates :email, format: { with: /@mica\.edu\z/i, message: "must be a MICA email address" }
  validates :role, presence: true, on: :update, if: -> { role_was.present? }

  with_options if: :role_model? do
    validates :skin_tone, :gender_identity, presence: true
    validates :willing_to_model_nude, inclusion: { in: [true, false] }
  end

  def self.from_omniauth(auth)
    user = where(email: auth.info.email).first_or_initialize

    user.first_name = auth.info.first_name
    user.last_name = auth.info.last_name
    user.image_url = auth.info.image 

    if user.new_record? && user.respond_to?(:password=)
      user.password = SecureRandom.hex(10)
    end

    user.save
    user
  end
end