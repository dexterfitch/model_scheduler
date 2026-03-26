class ApplicationController < ActionController::API
  include ActionController::Cookies

  before_action :require_login

  private

  def require_login
    unless session[:user_id]
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def require_role(*roles)
    return if current_user&.superuser?
    unless roles.map(&:to_s).include?(current_user&.role)
      render json: { error: "Not authorized" }, status: :forbidden
    end
  end
end