class OpenCall < ApplicationRecord
  belongs_to :faculty, class_name: "User", foreign_key: "user_id"
  has_many :bids, dependent: :destroy

  enum :status, { open: 0, confirmed: 1, cancelled: 2 }

  validates :starts_at, :ends_at, :class_name, presence: true
  validate :must_be_faculty_role

  private

  def must_be_faculty_role
    errors.add(:user, "must be faculty") unless faculty&.role_faculty?
  end
end