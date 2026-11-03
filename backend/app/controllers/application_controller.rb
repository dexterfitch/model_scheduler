# Base for every API controller. Signs people in from the Bearer token on each
# request and provides the role and ownership checks the other controllers use.
# Anything that raises NotAuthorizedError is answered with 403 Forbidden. Unexpected
# errors are kept in the Error Log before Rails answers them as usual.
class ApplicationController < ActionController::API
  include ActionController::Cookies

  # Raised by the permission checks; turned into a 403 response.
  class NotAuthorizedError < StandardError; end

  # Errors that are ordinary answers (not found, missing fields, not allowed), not bugs.
  EXPECTED_ERRORS = [
    ActiveRecord::RecordNotFound, ActionController::ParameterMissing,
    ActionController::RoutingError, NotAuthorizedError
  ].freeze

  before_action :require_login
  around_action :record_unexpected_errors

  rescue_from NotAuthorizedError, with: :render_forbidden

  private

  # Keeps any unexpected error in the Error Log, then lets it carry on to Rails.
  def record_unexpected_errors
    yield
  rescue *EXPECTED_ERRORS
    raise
  rescue StandardError => e
    record_server_error(e)
    raise
  end

  # Adds a server error to the Error Log: its class and message, the app's own lines
  # of the backtrace, the path (not the request's contents) and who was signed in.
  # Never raises, so the original error is the one that's answered.
  def record_server_error(error)
    ErrorReport.record!(
      source: "server",
      message: "#{error.class}: #{error.message}",
      details: Rails.backtrace_cleaner.clean(error.backtrace || []).first(15).join("\n"),
      path: request.path,
      user: @current_user
    )
  rescue StandardError => e
    Rails.logger.error("Error Log not saved: #{e.class}: #{e.message}")
  end

  # Adds an entry to History for the signed-in person, with the note they sent, if any.
  def record_history(action, summary, series_id: nil, note: params[:note])
    HistoryEntry.record!(actor: current_user, action: action, summary: summary, series_id: series_id, note: note)
  end

  # The since parameter as the start of that day, or nil when it's missing or unreadable.
  def since_param
    Date.iso8601(params[:since].to_s).in_time_zone if params[:since].present?
  rescue ArgumentError
    nil
  end

  # Answers 401 when the request carries no valid sign-in token.
  def require_login
    unless current_user
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end

  # The signed-in user from the request's Bearer token, or nil. The token must be
  # signed with the app's secret, unexpired, and carry the user's current token
  # version, so tokens issued before a logout stop working.
  def current_user
    return @current_user if defined?(@current_user)

    header = request.headers['Authorization']
    if header.present?
      token = header.split(' ').last
      begin
        decoded = JWT.decode(token, Rails.application.secret_key_base, true, { algorithm: "HS256" }).first
        @current_user = User.find_by(id: decoded['user_id'])
        @current_user = nil if @current_user && decoded.fetch('ver', 0) != @current_user.token_version
      rescue JWT::DecodeError
        @current_user = nil
      end
    end

    @current_user
  end

  # Lets the request through only for the given roles. SuperUsers always pass.
  def require_role(*roles)
    return if current_user&.superuser?
    unless roles.map(&:to_s).include?(current_user&.role)
      raise NotAuthorizedError
    end
  end

  # Lets the request through only for admins or the user who owns the record.
  def require_admin_or_owner(record)
    return if current_user.role_admin? || record.user_id == current_user.id
    raise NotAuthorizedError
  end

  # The 403 answer for NotAuthorizedError.
  def render_forbidden
    render json: { error: "Not authorized" }, status: :forbidden
  end
end
