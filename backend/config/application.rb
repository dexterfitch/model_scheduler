require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_cable/engine"

Bundler.require(*Rails.groups)

module Backend
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