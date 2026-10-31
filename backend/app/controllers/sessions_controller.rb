# Signing in and out. Google sign-in is limited to verified @mica.edu accounts;
# the sign-in token goes back to the app after a #, so it never reaches server logs.
class SessionsController < ApplicationController
  skip_before_action :require_login, only: [:omniauth, :destroy, :test_login]

  # Google's sign-in callback. Accepts only verified accounts in the mica.edu
  # workspace, creates the user on first sign-in, and sends the browser back to the
  # app with a 24-hour token. Anyone else goes back to the sign-in page with a reason.
  def omniauth
    auth = request.env['omniauth.auth']

    claims = auth.extra&.id_info || auth.extra&.raw_info || {}
    email_verified = claims["email_verified"].to_s == "true"
    workspace = claims["hd"].to_s.downcase
    mica_email = auth.info.email.to_s.downcase.end_with?("@mica.edu")

    unless email_verified && workspace == "mica.edu" && mica_email
      Rails.logger.warn("Rejected login (verified=#{email_verified}, hd=#{workspace.presence || 'none'})")
      return redirect_to sign_in_page_with("Please sign in with your MICA Google account."), allow_other_host: true
    end

    user = User.from_omniauth(auth)

    if user.save
      payload = { user_id: user.id, ver: user.token_version, exp: 24.hours.from_now.to_i }
      token = JWT.encode(payload, Rails.application.secret_key_base, "HS256")
      
      redirect_to "#{ENV['FRONTEND_URL']}/login_success/#{user.id}#token=#{token}", allow_other_host: true
    else
      Rails.logger.error("Login Failed: #{user.errors.full_messages.join(', ')}")
      redirect_to sign_in_page_with("Sign-in didn't work. Please try again."), allow_other_host: true
    end
  end

  # Signs out: every token issued so far stops working.
  def destroy
    current_user&.increment!(:token_version)
    render json: { ok: true }
  end

  # Development only: a token for any user by email, for tests and local checks.
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

  # The app's sign-in page address, showing the given message.
  def sign_in_page_with(message)
    "#{ENV['FRONTEND_URL']}/login?#{{ error: message }.to_query}"
  end
  private :sign_in_page_with

  # The signed-in user.
  def me
    if current_user
      render json: current_user
    else
      render json: { error: "Not authenticated" }, status: :unauthorized
    end
  end
end
