# One thing someone did in the app, for the admins' History: who did it (the user),
# what (a sentence written at the time, so it still reads right after names or
# classes change), the note they gave, if any, and when.
class HistoryEntry < ApplicationRecord
  NOTE_LIMIT = 500
  ZONE = "Eastern Time (US & Canada)".freeze

  belongs_to :user, optional: true

  validates :action, :summary, presence: true

  # Records an entry. Never raises: if it can't be saved, that's logged and the
  # action it describes still stands. Returns the entry, or nil.
  def self.record!(actor:, action:, summary:, series_id: nil, note: nil)
    create!(user: actor, action: action.to_s, summary: summary.to_s.truncate(1000),
      note: note.to_s.strip.truncate(NOTE_LIMIT).presence, request_series_id: series_id)
  rescue StandardError => e
    Rails.logger.error("History not saved (#{action}): #{e.class}: #{e.message}")
    nil
  end

  # A date and time as History writes it, like Tue Nov 3, 10:00 AM (Eastern).
  def self.at(time)
    time.in_time_zone(ZONE).strftime("%a %b %-d, %-l:%M %p")
  end

  # A class date's time span, like Tue Nov 3, 10:00 AM – 12:00 PM (Eastern). The end
  # date is only repeated when it's on a different day.
  def self.span(starts_at, ends_at)
    finish = ends_at.in_time_zone(ZONE)
    same_day = finish.to_date == starts_at.in_time_zone(ZONE).to_date
    "#{at(starts_at)} – #{same_day ? finish.strftime('%-l:%M %p') : at(ends_at)}"
  end

  # A count with the right word form, like 1 date or 3 dates.
  def self.count_of(count, word)
    "#{count} #{word.pluralize(count)}"
  end

  # A person's full name.
  def self.name_of(person)
    "#{person&.first_name} #{person&.last_name}".strip
  end

  # Swaps a person's name for Removed Person in every entry, after their data is removed.
  def self.forget_name!(name)
    return if name.blank?

    like = "%#{sanitize_sql_like(name)}%"
    where("summary LIKE :like OR note LIKE :like", like: like)
      .update_all(["summary = REPLACE(summary, :name, :removed), note = REPLACE(note, :name, :removed)",
        { name: name, removed: "Removed Person" }])
  end

  # The entry as History shows it, with who made it.
  def as_json(options = {})
    super({
      only: [:id, :action, :summary, :note, :request_series_id, :created_at],
      include: { user: { only: [:first_name, :last_name] } }
    }.merge(options))
  end
end
