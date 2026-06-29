class SessionsController < ApplicationController
  skip_before_action :require_login, only: [:omniauth, :destroy, :test_login]

  def omniauth
    auth = request.env['omniauth.auth']

    unless auth.info.email.to_s.downcase.end_with?('@mica.edu')
      Rails.logger.warn("Rejected non-MICA login attempt: #{auth.info.email}")
      return redirect_to "#{ENV['FRONTEND_URL']}?error=Invalid+domain", allow_other_host: true
    end

    user = User.from_omniauth(auth)

    if user.save
      session[:user_id] = user.id
      redirect_to "#{ENV['FRONTEND_URL']}/login_success/#{user.id}", allow_other_host: true
    else
      Rails.logger.error("Login Failed: #{user.errors.full_messages.join(', ')}")
      redirect_to "#{ENV['FRONTEND_URL']}?error=Login+Failed", allow_other_host: true
    end
  end

  def destroy
    session.delete(:user_id)
    render json: { ok: true }
  end

  def test_login
    raise ActionController::RoutingError, "Not Found" unless Rails.env.development?
    user = User.find_by(email: params[:email])
    if user
      session[:user_id] = user.id
      render json: user
    else
      render json: { error: "User not found" }, status: :not_found
    end
  end

  def me
    if current_user
      render json: current_user
    else
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end
end