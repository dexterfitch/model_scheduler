# Signs requests in as any user in request specs.
module AuthHelpers
  # The Authorization header the app would send for this user.
  def auth_headers(user)
    token = JWT.encode(
      { user_id: user.id, ver: user.token_version, exp: 1.hour.from_now.to_i },
      Rails.application.secret_key_base,
      "HS256"
    )
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
