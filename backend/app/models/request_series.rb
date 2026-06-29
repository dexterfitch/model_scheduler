class RequestSeries < ApplicationRecord
  belongs_to :user
  has_many :faculty_requests, dependent: :destroy

  enum :status, { pending: 0, matched: 1, archived: 2 }

  before_destroy :release_gigs, prepend: true

  validates :class_name, presence: true
  validates :department, presence: true
  validates :building, presence: true, inclusion: { in: FacultyRequest::BUILDINGS }
  validates :model_mode, presence: true, inclusion: { in: %w[clothed nude] }
  validates :pref_gender, inclusion: { in: User::GENDER_IDENTITIES + ["Any"] }, allow_nil: true
  validates :pref_skin_tone, inclusion: { in: User::SKIN_TONES + ["Any"] }, allow_nil: true
  validates :user, presence: true

  scope :with_pending_requests, -> {
    joins(:faculty_requests).where(faculty_requests: { status: :pending }).distinct
  }

  scope :visible_to_model, ->(model_user) {
    with_pending_requests.where(
      "request_series.model_mode = 'clothed' OR ?", model_user.willing_to_model_nude
    )
  }

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

  private

  def release_gigs
    faculty_requests.each do |request|
      gig = request.gig
      next unless gig

      gig.destroy!
      gig.art_model_availability.update!(status: 'active')
    end
  end
end