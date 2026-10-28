require "rails_helper"

RSpec.describe User, type: :model do
  it "has a valid faculty factory" do
    expect(build(:user)).to be_valid
  end

  it "has a valid model factory" do
    expect(build(:user, :model)).to be_valid
  end

  it "lets a model prefer not to say their skin tone" do
    expect(build(:user, :model, skin_tone: "Prefer not to say")).to be_valid
  end

  it "still needs a model to answer the skin tone question, even if only to skip it" do
    model = build(:user, :model, skin_tone: nil)
    expect(model).not_to be_valid
    expect(model.errors.full_messages).to include("Skin tone must be chosen (Light, Medium, Dark or Prefer not to say)")
  end

  it "doesn't let a class request ask for Prefer not to say" do
    series = build(:request_series, pref_skin_tone: "Prefer not to say")
    expect(series).not_to be_valid
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

  describe ".bring_all_profile_values_up_to_date!" do
    it "fixes old spellings and clears values that no longer exist" do
      model = create(:user, :model)
      model.update_columns(gender_identity: "Non-Binary", skin_tone: "dark ", body_type: "Slim")
      faculty = create(:user)
      faculty.update_columns(gender_identity: "Retired option")

      User.bring_all_profile_values_up_to_date!

      model.reload
      expect(model.gender_identity).to eq("Non-binary")
      expect(model.skin_tone).to eq("Dark")
      expect(model.body_type).to be_nil
      expect(faculty.reload.gender_identity).to be_nil
    end

    it "gives a model whose gender no longer exists 'Prefer not to say', so their profile still works" do
      model = create(:user, :model)
      model.update_columns(gender_identity: "Retired option")
      User.bring_all_profile_values_up_to_date!
      expect(model.reload.gender_identity).to eq("Prefer not to say")
    end

    it "leaves profiles that are already up to date alone" do
      model = create(:user, :model, gender_identity: "Woman", skin_tone: "Medium")
      expect { User.bring_all_profile_values_up_to_date! }.not_to(change { model.reload.updated_at })
    end
  end
end
