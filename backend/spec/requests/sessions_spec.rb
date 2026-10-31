# Sign-in tokens: real ones work; forged ones and ones from before a logout don't.

require "rails_helper"

RSpec.describe "Login tokens", type: :request do
  let(:user) { create(:user) }

  # Base64 the way JWT encodes token parts, for building forged tokens.
  def b64(str)
    Base64.urlsafe_encode64(str, padding: false)
  end

  it "accepts a real token" do
    get "/me", headers: auth_headers(user)
    expect(response).to have_http_status(:ok)
  end

  it "rejects a forged token with no signature" do
    forged = "#{b64({ alg: 'none', typ: 'JWT' }.to_json)}.#{b64({ user_id: user.id }.to_json)}."
    get "/me", headers: { "Authorization" => "Bearer #{forged}" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a token after logout" do
    headers = auth_headers(user)
    delete "/logout", headers: headers
    get "/me", headers: headers
    expect(response).to have_http_status(:unauthorized)
  end
end
