require "rails_helper"

RSpec.describe User, type: :model do
  it "has a valid faculty factory" do
    expect(build(:user)).to be_valid
  end

  it "has a valid model factory" do
    expect(build(:user, :model)).to be_valid
  end

  it "clears genitalia for models who won't pose nude" do
    user = create(:user, :model, genitalia: "Intersex")
    expect(user.genitalia).to be_nil
  end

  it "keeps genitalia for models who will pose nude" do
    user = create(:user, :model, :nude_ok, genitalia: "Intersex")
    expect(user.genitalia).to eq("Intersex")
  end
  
  describe ".from_omniauth" do
    def google_login(email:, first: "GoogleFirst", last: "GoogleLast")
      OmniAuth::AuthHash.new(info: { email: email, first_name: first, last_name: last })
    end

    it "matches an existing user even when the email's capitalization differs" do
      existing = create(:user, email: "pnair@mica.edu")
      expect(User.from_omniauth(google_login(email: "PNair@MICA.edu")).id).to eq(existing.id)
    end

    it "keeps a name the user edited in their profile" do
      create(:user, email: "pnair@mica.edu", first_name: "Priya", last_name: "Nair")
      user = User.from_omniauth(google_login(email: "pnair@mica.edu"))
      expect([user.first_name, user.last_name]).to eq(["Priya", "Nair"])
    end

    it "fills in the name from Google on a first login" do
      user = User.from_omniauth(google_login(email: "newperson@mica.edu"))
      expect(user.first_name).to eq("GoogleFirst")
    end
  end
end