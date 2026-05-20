class RequestSeries < ApplicationRecord
  belongs_to :user
  has_many :faculty_requests, dependent: :destroy

  enum :status, { pending: 0, matched: 1, archived: 2 }

  validates :class_name, presence: true
  validates :department, presence: true
  validates :model_mode, presence: true
  validates :user, presence: true

  def update_status!
    if faculty_requests.none?
      update!(status: :archived)
    elsif faculty_requests.all? { |r| r.status == 'matched' }
      update!(status: :matched)
    elsif faculty_requests.all? { |r| r.status == 'archived' }
      update!(status: :archived)
    else
      update!(status: :pending)
    end
  end
end