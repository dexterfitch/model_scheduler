# Lets only the app's own front end (FRONTEND_URL) call the API from a browser.

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    frontend_url = if Rails.env.production?
      ENV.fetch("FRONTEND_URL") { raise "FRONTEND_URL environment variable is not set!" }
    else
      ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    end

    origins frontend_url

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
