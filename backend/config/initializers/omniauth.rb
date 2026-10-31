# Google sign-in, limited to the mica.edu workspace and always showing the account chooser.
#
# Sign-in starts from a link on the app's own sign-in page, a separate site from the
# API, so OmniAuth's check that sign-in was started by a form on the API's own pages
# (request_validation_phase) is turned off. What still protects sign-in: OAuth's state
# check on Google's reply stays on, Google always asks which account to use, and the
# callback only accepts verified accounts in the mica.edu workspace. Turning the
# check on would mean an extra Continue with Google page served by the API.

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
    ENV['GOOGLE_CLIENT_ID'],
    ENV['GOOGLE_CLIENT_SECRET'],
    {
      scope: 'email, profile',
      prompt: 'select_account',
      hd: 'mica.edu',
    }
end

OmniAuth.config.allowed_request_methods = [:get, :post]
OmniAuth.config.request_validation_phase = nil
