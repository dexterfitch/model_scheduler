# The Error Log. Browsers report errors the page didn't catch; SuperUsers read and
# clear the log.
class ErrorReportsController < ApplicationController
  BROWSER_REPORTS_PER_HOUR = 20

  before_action :require_superuser, only: [:index, :destroy_all]

  # The most recent reports, newest first.
  def index
    render json: ErrorReport.includes(:user).order(last_seen_at: :desc).limit(200)
  end

  # Records an error from the signed-in person's browser, unless they've already
  # sent BROWSER_REPORTS_PER_HOUR in the last hour.
  def create
    sent = ErrorReport.where(source: "browser", user: current_user)
      .where("last_seen_at > ?", 1.hour.ago).sum(:count)
    if sent < BROWSER_REPORTS_PER_HOUR
      ErrorReport.record!(source: "browser", message: params[:message], details: params[:details],
        path: params[:path], user: current_user)
    end
    head :no_content
  end

  # Clears the whole log.
  def destroy_all
    ErrorReport.delete_all
    head :no_content
  end

  private

  # Only SuperUsers can read or clear the log.
  def require_superuser
    render json: { error: "Only a SuperUser can see the Error Log." }, status: :forbidden unless current_user.superuser?
  end
end
