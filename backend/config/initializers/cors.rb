Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:5173' # Or '*' for development

    resource '*',
      headers: :any,
      # Make sure :put, :patch, and :delete are in this list:
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end