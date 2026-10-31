# Google sign-in: only verified mica.edu accounts get in, and the token stays out of server logs.

require "rails_helper"

RSpec.describe "Signing in with Google", type: :request do
  before { OmniAuth.config.test_mode = true }
  after do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.test_mode = false
  end

  # Makes Google's sign-in answer with this account, verified or not, in the given workspace.
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

  it "hands over the sign-in token after a #, so it never reaches a server log" do
    google_says(email: "newfaculty@mica.edu")
    expect(response.location).to match(/login_success\/\d+#token=[^&]+\z/)
    expect(response.location).not_to include("?token=")
  end

  it "turns away a personal Gmail account, with a message on the sign-in page" do
    google_says(email: "someone@gmail.com", hd: nil)
    expect(response.location).to include("/login?error=Please+sign+in+with+your+MICA+Google+account.")
  end

  it "keeps a turned-away person's email out of the server log" do
    logged = []
    allow(Rails.logger).to receive(:warn) { |message| logged << message.to_s }
    google_says(email: "someone.personal@gmail.com", hd: nil)
    expect(logged.join).to include("Rejected")
    expect(logged.join).not_to include("someone.personal")
  end

  it "turns away a MICA address Google hasn't verified" do
    google_says(email: "unverified@mica.edu", verified: false)
    expect(response.location).to include("/login?error=Please+sign+in+with+your+MICA+Google+account.")
    expect(User.exists?(email: "unverified@mica.edu")).to be false
  end

  it "turns away a MICA-looking email from a different organization" do
    google_says(email: "imposter@mica.edu", hd: "example.com")
    expect(response.location).to include("/login?error=Please+sign+in+with+your+MICA+Google+account.")
  end
end
