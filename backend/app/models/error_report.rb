# One kind of unexpected error, from the server or from someone's browser, for the
# Error Log in the SuperUser Panel. The same error within a day is counted on one
# report instead of adding another. A new kind of error tells every SuperUser in
# Updates. Reports are kept for 90 days, and at most 500 of them.
class ErrorReport < ApplicationRecord
  SOURCES = %w[server browser].freeze
  SAME_ERROR_WITHIN = 1.day
  KEEP_FOR = 90.days
  KEEP_AT_MOST = 500

  belongs_to :user, optional: true

  validates :source, inclusion: { in: SOURCES }
  validates :message, :fingerprint, :last_seen_at, presence: true

  # Records an error: counts it on a recent report of the same error, or starts a new
  # one. Messages, details and paths are shortened; query strings are left off.
  def self.record!(source:, message:, path: nil, details: nil, user: nil)
    message = (message.to_s.strip.presence || "Unknown error").truncate(500)
    details = details.to_s.truncate(4000).presence
    path = path.to_s.split("?").first.to_s.truncate(255).presence
    fingerprint = Digest::SHA256.hexdigest([source, message, path.to_s.gsub(/\d+/, ":id")].join("|"))

    recent = where(fingerprint: fingerprint).where("last_seen_at > ?", SAME_ERROR_WITHIN.ago)
      .order(last_seen_at: :desc).first
    if recent
      recent.update!(count: recent.count + 1, last_seen_at: Time.current,
        user: user || recent.user, details: details || recent.details)
      return recent
    end

    report = create!(source: source, message: message, details: details, path: path, user: user,
      fingerprint: fingerprint, last_seen_at: Time.current)
    report.tell_superusers
    clear_old!
    report
  end

  # Deletes reports older than KEEP_FOR, and the oldest beyond KEEP_AT_MOST.
  def self.clear_old!
    where("last_seen_at < ?", KEEP_FOR.ago).delete_all
    keep = order(last_seen_at: :desc).limit(KEEP_AT_MOST).pluck(:id)
    where.not(id: keep).delete_all
  end

  # Adds an Update for every SuperUser about this new kind of error.
  def tell_superusers
    User.where(superuser: true, removed_at: nil).find_each do |superuser|
      Notification.create!(user: superuser, kind: "error", title: message.truncate(120),
        dates: [], group_key: "error:#{fingerprint}")
    end
  rescue StandardError => e
    Rails.logger.error("Error Log update not saved: #{e.class}: #{e.message}")
  end

  # The report as the Error Log shows it, with the person's name.
  def as_json(options = {})
    super({
      only: [:id, :source, :message, :details, :path, :count, :last_seen_at],
      include: { user: { only: [:first_name, :last_name] } }
    }.merge(options))
  end
end
