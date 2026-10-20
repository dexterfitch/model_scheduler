class SessionsController < ApplicationController
  skip_before_action :require_login, only: [:omniauth, :destroy, :test_login]

  def omniauth
    auth = request.env['omniauth.auth']

    claims = auth.extra&.id_info || auth.extra&.raw_info || {}
    email_verified = claims["email_verified"].to_s == "true"
    workspace = claims["hd"].to_s.downcase
    mica_email = auth.info.email.to_s.downcase.end_with?("@mica.edu")

    unless email_verified && workspace == "mica.edu" && mica_email
      Rails.logger.warn("Rejected login: #{auth.info.email} (verified=#{email_verified}, hd=#{workspace.presence || 'none'})")
      return redirect_to "#{ENV['FRONTEND_URL']}?error=Invalid+domain", allow_other_host: true
    end

    user = User.from_omniauth(auth)

    if user.save
      payload = { user_id: user.id, ver: user.token_version, exp: 24.hours.from_now.to_i }
      token = JWT.encode(payload, Rails.application.secret_key_base, "HS256")
      
      redirect_to "#{ENV['FRONTEND_URL']}/login_success/#{user.id}?token=#{token}", allow_other_host: true
    else
      Rails.logger.error("Login Failed: #{user.errors.full_messages.join(', ')}")
      redirect_to "#{ENV['FRONTEND_URL']}?error=Login+Failed", allow_other_host: true
    end
  end

  def destroy
    current_user&.increment!(:token_version)
    render json: { ok: true }
  end

  def test_login
    raise ActionController::RoutingError, "Not Found" unless Rails.env.development?
    user = User.find_by(email: params[:email])
    if user
      payload = { user_id: user.id, ver: user.token_version, exp: 24.hours.from_now.to_i }
      token = JWT.encode(payload, Rails.application.secret_key_base, "HS256")
      render json: { user: user, token: token }
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