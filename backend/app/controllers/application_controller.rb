class ApplicationController < ActionController::API
  include ActionController::Cookies

  before_action :require_login

  rescue_from NotAuthorizedError, with: :render_forbidden

  private

  class NotAuthorizedError < StandardError; end

  def require_login
    unless current_user
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def require_role(*roles)
    return if current_user&.superuser?
    unless roles.map(&:to_s).include?(current_user&.role)
      raise NotAuthorizedError
    end
  end

  def render_forbidden
    render json: { error: "Not authorized" }, status: :forbidden
  end
end