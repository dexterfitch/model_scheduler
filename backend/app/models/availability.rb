class Availability < ApplicationRecord
  belongs_to :user
  has_many :booking_requests, dependent: :destroy, inverse_of: :availability

  # CHANGE: pending -> available
  enum :status, { available: 0, requested: 1, confirmed: 2 }

  validates :starts_at, :ends_at, presence: true
  validate :end_after_start

  private

  def end_after_start
    return if ends_at.blank? || starts_at.blank?
    errors.add(:ends_at, "must be after start time") if ends_at <= starts_at
  end
end