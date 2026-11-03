# History, for admins: everything people have done in the app, newest first.
class HistoryEntriesController < ApplicationController
  PAGE = 100

  before_action -> { require_role(:admin) }

  # A page of entries, newest first. q searches what was done, the note and who did
  # it; before_id gives the page older than that entry.
  def index
    entries = HistoryEntry.includes(:user).order(id: :desc)
    entries = entries.where("history_entries.id < ?", params[:before_id].to_i) if params[:before_id].present?

    query = params[:q].to_s.strip
    if query.present?
      like = "%#{HistoryEntry.sanitize_sql_like(query)}%"
      entries = entries.references(:user).where(
        "history_entries.summary ILIKE :q OR history_entries.note ILIKE :q OR " \
        "CONCAT(users.first_name, ' ', users.last_name) ILIKE :q", q: like
      )
    end

    render json: entries.limit(PAGE)
  end
end
