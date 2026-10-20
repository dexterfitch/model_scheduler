require "rails_helper"

RSpec.describe "Signing in with Google", type: :request do
  before { OmniAuth.config.test_mode = true }
  after do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.test_mode = false
  end

  # Pretend Google sent back this account, then hit the login callback
  def google_says(email:, verified: true, hd: "mica.edu")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "123",
      info: { email: email, first_name: "Test", last_name: "Person" },
      extra: { id_info: { "email_verified" => verified, "hd" => hd } }
    )
    get "/auth/google_oauth2/callback"
  end

  it "lets in a verified MICA account" do
    google_says(email: "newfaculty@mica.edu")
    expect(response.location).to include("login_success")
    expect(User.exists?(email: "newfaculty@mica.edu")).to be true
  end

  it "turns away a personal Gmail account" do
    google_says(email: "someone@gmail.com", hd: nil)
    expect(response.location).to include("error=Invalid+domain")
  end

  it "turns away a MICA address Google hasn't verified" do
    google_says(email: "unverified@mica.edu", verified: false)
    expect(response.location).to include("error=Invalid+domain")
    expect(User.exists?(email: "unverified@mica.edu")).to be false
  end

  it "turns away a MICA-looking email from a different organization" do
    google_says(email: "imposter@mica.edu", hd: "example.com")
    expect(response.location).to include("error=Invalid+domain")
  end
end