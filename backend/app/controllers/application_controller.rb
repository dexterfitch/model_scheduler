# Base for every API controller. Signs people in from the Bearer token on each
# request and provides the role and ownership checks the other controllers use.
# Anything that raises NotAuthorizedError is answered with 403 Forbidden.
class ApplicationController < ActionController::API
  include ActionController::Cookies

  # Raised by the permission checks; turned into a 403 response.
  class NotAuthorizedError < StandardError; end

  before_action :require_login

  rescue_from NotAuthorizedError, with: :render_forbidden

  private

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
