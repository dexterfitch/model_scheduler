class SessionsController < ApplicationController
  def omniauth
    # 1. Get data from Google
    auth = request.env['omniauth.auth']

    # 2. Find or Create User
    # This calls the method we just fixed in user.rb
    user = User.from_omniauth(auth)

    # 3. Save the User
    # We use user.save directly. If it fails, we log the error.
    if user.save
      # Success: Redirect back to React Frontend with the User ID
      # The frontend will fetch this user, see role is 'nil', and show the Role Selector.
      redirect_to "http://localhost:5173/login_success/#{user.id}", allow_other_host: true
    else
      # Login Failed
      # Log the specific validation error to the terminal for debugging
      Rails.logger.error("Login Failed: #{user.errors.full_messages.join(', ')}")
      
      # Redirect with a generic error message
      redirect_to "http://localhost:5173?error=Login+Failed", allow_other_host: true
    end
  end
end