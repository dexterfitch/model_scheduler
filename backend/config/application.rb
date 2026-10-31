# Loads Rails and the gems the API uses, then sets up the application.

require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_cable/engine"

Bundler.require(*Rails.groups)

# The Pose Pool API.
module Backend
  # Rails settings for the API: Eastern time, API-only, and a cookie session used
  # only during Google sign-in.
  class Application < Rails::Application
    config.load_defaults 8.0
    config.time_zone = "Eastern Time (US & Canada)"
    config.autoload_lib(ignore: %w[assets tasks])
    config.api_only = true
    config.session_store :cookie_store,
      key: '_mica_scheduler_session',
      secure: Rails.env.production?,
      httponly: true,
      same_site: Rails.env.production? ? :none : :lax
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore, config.session_options
  end
end
