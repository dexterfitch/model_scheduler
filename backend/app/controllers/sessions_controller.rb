class SessionsController < ApplicationController
  skip_before_action :require_login
  
  def omniauth
    auth = request.env['omniauth.auth']
    user = User.from_omniauth(auth)

    if user.save
      session[:user_id] = user.id
      redirect_to "http://localhost:5173/login_success/#{user.id}", allow_other_host: true
    else
      Rails.logger.error("Login Failed: #{user.errors.full_messages.join(', ')}")
      redirect_to "http://localhost:5173?error=Login+Failed", allow_other_host: true
    end
  end
end