# One update for one person about a change to their gigs or classes, shown in the
# app's Updates list. Updates of the same kind about the same class that arrive
# close together, before being read, are gathered into one listing every date.
class Notification < ApplicationRecord
  KINDS = %w[
    booked class_booked released date_cancelled class_cancelled
    dropped_out model_cancelled date_moved error
    class_edited class_date_moved class_date_added
  ].freeze
  GATHER_WITHIN = 10.minutes
  KEEP_READ_FOR = 180.days

  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :title, :group_key, presence: true

  scope :unread, -> { where(read_at: nil) }

  # Tells a person about a class date: adds the date to a recent unread update of the
  # same kind about the same class, or starts a new one. Returns the update.
  def self.add!(user:, kind:, request:, paid: nil, about: nil)
    key = [kind, request.request_series_id || "date-#{request.id}", paid, about].join(":")
    date = request.starts_at.iso8601
    recent = unread.where(user: user, group_key: key)
      .where("updated_at > ?", GATHER_WITHIN.ago)
      .order(updated_at: :desc).first

    if recent
      recent.update!(dates: (recent.dates | [date]).sort_by { |d| Time.zone.parse(d) })
      recent
    else
      create!(user: user, kind: kind.to_s, group_key: key, title: request.class_name,
        dates: [date], paid: paid, about: about)
    end
  end

  # Deletes a person's updates that were read more than KEEP_READ_FOR ago.
  def self.clear_old_for!(user)
    where(user: user).where.not(read_at: nil).where("updated_at < ?", KEEP_READ_FOR.ago).delete_all
  end

  # The update as the app shows it.
  def as_json(options = {})
    super({ only: [:id, :kind, :title, :dates, :paid, :about, :read_at, :updated_at] }.merge(options))
  end
end
