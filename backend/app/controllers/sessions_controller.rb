class SessionsController < ApplicationController
  skip_before_action :require_login, only: [:omniauth, :destroy]
  
  def omniauth
    auth = request.env['omniauth.auth']
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
end