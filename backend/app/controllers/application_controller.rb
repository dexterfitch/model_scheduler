class ApplicationController < ActionController::API
  include ActionController::Cookies

  class NotAuthorizedError < StandardError; end

  before_action :require_login

  rescue_from NotAuthorizedError, with: :render_forbidden

  private

  def require_login
    unless current_user
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end

  def current_user
    return @current_user if defined?(@current_user)

    header = request.headers['Authorization']
    if header.present?
      token = header.split(' ').last
      begin
        decoded = JWT.decode(token, Rails.application.secret_key_base, true, { algorithm: "HS256" }).first
        @current_user = User.find_by(id: decoded['user_id'])
        # Tokens from before a logout carry an old version number
        @current_user = nil if @current_user && decoded.fetch('ver', 0) != @current_user.token_version
      rescue JWT::DecodeError
        @current_user = nil
      end
    end

    @current_user
  end

  def require_role(*roles)
    return if current_user&.superuser?
    unless roles.map(&:to_s).include?(current_user&.role)
      raise NotAuthorizedError
    end
  end

  def require_admin_or_owner(record)
    return if current_user.role_admin? || record.user_id == current_user.id
    raise NotAuthorizedError
  end

  def render_forbidden
    render json: { error: "Not authorized" }, status: :forbidden
  end
end