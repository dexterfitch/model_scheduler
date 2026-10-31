require "rails_helper"

RSpec.describe "User profile permissions", type: :request do
  let(:user)  { create(:user) }
  let(:admin) { create(:user, :admin) }

  def patch_user(as:, changes:)
    patch "/users/#{user.id}", params: { user: changes }, headers: auth_headers(as), as: :json
  end

  it "ignores a user's attempt to change their own email" do
    original = user.email
    patch_user(as: user, changes: { email: "someone.else@mica.edu" })
    expect(user.reload.email).to eq(original)
  end

  it "still saves the rest of a profile update" do
    patch_user(as: user, changes: { first_name: "Priya" })
    expect(user.reload.first_name).to eq("Priya")
  end

  it "lets an admin change a user's email" do
    patch_user(as: admin, changes: { email: "new.address@mica.edu" })
    expect(user.reload.email).to eq("new.address@mica.edu")
  end

  describe "protecting admin accounts" do
    let(:superuser)   { create(:user, :admin, superuser: true) }
    let(:other_admin) { create(:user, :admin) }

    def patch_profile(target, as:, changes:)
      patch "/users/#{target.id}", params: { user: changes }, headers: auth_headers(as), as: :json
    end

    it "won't let an admin change the SuperUser's email (that would hand over their account)" do
      original = superuser.email
      patch_profile(superuser, as: admin, changes: { email: "someone.else@mica.edu" })
      expect(response).to have_http_status(:forbidden)
      expect(superuser.reload.email).to eq(original)
    end

    it "won't let an admin edit another admin's profile" do
      patch_profile(other_admin, as: admin, changes: { first_name: "Changed" })
      expect(response).to have_http_status(:forbidden)
      expect(other_admin.reload.first_name).not_to eq("Changed")
    end

    it "won't let an admin change their own email, but saves the rest" do
      original = admin.email
      patch_profile(admin, as: admin, changes: { email: "new.me@mica.edu", first_name: "Pat" })
      expect(response).to have_http_status(:ok)
      expect(admin.reload.email).to eq(original)
      expect(admin.first_name).to eq("Pat")
    end

    it "lets the SuperUser change an admin's email" do
      patch_profile(other_admin, as: superuser, changes: { email: "fixed.address@mica.edu" })
      expect(response).to have_http_status(:ok)
      expect(other_admin.reload.email).to eq("fixed.address@mica.edu")
    end
  end

  describe "viewing profiles" do
    let(:model)   { create(:user, :model, :nude_ok, genitalia: "Intersex") }
    let(:faculty) { create(:user) }

    it "lets admins list all users" do
      get "/users", headers: auth_headers(admin)
      expect(response).to have_http_status(:ok)
    end

    it "blocks faculty and models from listing users" do
      [faculty, model].each do |u|
        get "/users", headers: auth_headers(u)
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "blocks faculty from viewing a model's profile" do
      get "/users/#{model.id}", headers: auth_headers(faculty)
      expect(response).to have_http_status(:forbidden)
      expect(response.body).not_to include("Intersex")
    end

    it "lets models view their own profile" do
      get "/users/#{model.id}", headers: auth_headers(model)
      expect(response.parsed_body["genitalia"]).to eq("Intersex")
    end
  end

  describe "changing roles" do
    it "doesn't let faculty promote themselves to admin" do
      post "/users/#{user.id}/promote", params: { role: "admin" }, headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(user.reload).to be_role_faculty
    end

    it "lets an admin change someone's role" do
      post "/users/#{user.id}/promote", params: { role: "model", skin_tone: "Dark" }, headers: auth_headers(admin), as: :json
      expect(user.reload).to be_role_model
      expect(user.skin_tone).to eq("Dark")
    end

    it "asks for a skin tone instead of guessing one when switching someone to model" do
      post "/users/#{user.id}/promote", params: { role: "model" }, headers: auth_headers(admin), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"]).to eq(["Skin tone must be chosen (Light, Medium, Dark or Prefer not to say)"])
      expect(user.reload).to be_role_faculty
      expect(user.skin_tone).to be_nil
    end

    it "brings outdated profile values up to date when switching someone to model" do
      user.update_columns(gender_identity: "Non-Binary", skin_tone: "medium", body_type: "Slim")
      post "/users/#{user.id}/promote", params: { role: "model" }, headers: auth_headers(admin), as: :json

      expect(response).to have_http_status(:ok)
      user.reload
      expect(user).to be_role_model
      expect(user.gender_identity).to eq("Non-binary") # same answer, today's spelling
      expect(user.skin_tone).to eq("Medium")
      expect(user.body_type).to be_nil                 # no longer an option, and optional
    end

    it "uses Prefer not to say for a gender value that no longer exists" do
      user.update_columns(gender_identity: "Retired option")
      post "/users/#{user.id}/promote", params: { role: "model", skin_tone: "Light" }, headers: auth_headers(admin), as: :json
      expect(user.reload.gender_identity).to eq("Prefer not to say")
    end

    it "explains why a role switch failed" do
      user.update_columns(email: "old.address@gmail.com")
      post "/users/#{user.id}/promote", params: { role: "model" }, headers: auth_headers(admin), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"]).to include("Email must be a MICA email address")
    end

    it "only lets superusers grant superuser status" do
      other_admin = create(:user, :admin)
      post "/users/#{other_admin.id}/promote_to_superuser", headers: auth_headers(admin)
      expect(response).to have_http_status(:forbidden)
      expect(other_admin.reload.superuser).to be_falsey
    end

    it "lets a new user pick faculty or model" do
      newcomer = create(:user, role: nil)
      post "/select_role", params: { role: "faculty" }, headers: auth_headers(newcomer), as: :json
      expect(newcomer.reload).to be_role_faculty
    end

    it "lets someone switched to model prefer not to say their skin tone" do
      post "/users/#{user.id}/promote", params: { role: "model", skin_tone: "Prefer not to say" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)
      expect(user.reload.skin_tone).to eq("Prefer not to say")
    end

    it "uses the skin tone a new model chose" do
      newcomer = create(:user, role: nil)
      post "/select_role", params: { role: "model", skin_tone: "Medium" }, headers: auth_headers(newcomer), as: :json

      expect(response).to have_http_status(:ok)
      expect(newcomer.reload).to be_role_model
      expect(newcomer.skin_tone).to eq("Medium")
    end

    it "doesn't let a new user pick admin" do
      newcomer = create(:user, role: nil)
      post "/select_role", params: { role: "admin" }, headers: auth_headers(newcomer), as: :json
      expect(newcomer.reload.role).to be_nil
    end

    it "doesn't let someone switch roles after choosing" do
      post "/select_role", params: { role: "model" }, headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(user.reload).to be_role_faculty
    end
  end

  describe "superusers" do
    let(:superuser) { create(:user, :admin, superuser: true) }

    it "are the only ones who can make someone an admin" do
      post "/users/#{user.id}/promote", params: { role: "admin" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(user.reload).to be_role_faculty

      post "/users/#{user.id}/promote", params: { role: "admin" }, headers: auth_headers(superuser), as: :json
      expect(user.reload).to be_role_admin
    end

    it "are the only ones who can change an admin's role" do
      other_admin = create(:user, :admin)
      post "/users/#{other_admin.id}/promote", params: { role: "faculty" }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(other_admin.reload).to be_role_admin
    end

    it "can still switch themselves back to admin after viewing the app as faculty" do
      superuser.update!(role: :faculty)
      post "/users/#{superuser.id}/promote", params: { role: "admin" }, headers: auth_headers(superuser), as: :json
      expect(superuser.reload).to be_role_admin
    end

    it "can grant superuser status to an admin" do
      other_admin = create(:user, :admin)
      post "/users/#{other_admin.id}/promote_to_superuser", headers: auth_headers(superuser)
      expect(other_admin.reload.superuser).to be true
    end

    it "can't grant superuser status to someone who isn't an admin" do
      post "/users/#{user.id}/promote_to_superuser", headers: auth_headers(superuser)
      expect(response).to have_http_status(:unprocessable_content)
      expect(user.reload.superuser).to be_falsey
    end

    it "keeps admin powers while viewing the app as a model" do
      superuser.update!(role: :model, gender_identity: "Woman", skin_tone: "Medium", willing_to_model_nude: false)
      get "/users", headers: auth_headers(superuser)
      expect(response).to have_http_status(:ok)
    end
  end

  describe "sock accounts" do
    let(:sock_params) do
      { user: { first_name: "Sock", last_name: "Model", email: "sock.model@mica.edu",
                gender_identity: "Woman", skin_tone: "Light", willing_to_model_nude: false } }
    end

    it "lets an admin create a model account" do
      post "/users", params: sock_params, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:created)
      expect(User.find_by(email: "sock.model@mica.edu")).to be_role_model
    end

    it "always makes the new account a model, even if another role is requested" do
      post "/users", params: { user: sock_params[:user].merge(role: "admin") }, headers: auth_headers(admin), as: :json
      expect(User.find_by(email: "sock.model@mica.edu")).to be_role_model
    end

    it "doesn't let faculty create accounts" do
      post "/users", params: sock_params, headers: auth_headers(user), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(User.exists?(email: "sock.model@mica.edu")).to be false
    end
  end

  describe "withdrawing consent to pose nude" do
    let(:model) { create(:user, :model, :nude_ok) }
    let(:slot)  { create(:art_model_availability, user: model) }

    def stop_posing_nude
      patch "/users/#{model.id}", params: { user: { willing_to_model_nude: false } },
        headers: auth_headers(model), as: :json
    end

    it "is blocked while the model is booked into an upcoming nude session" do
      create(:gig, art_model_availability: slot, faculty_request: create(:faculty_request, :nude))
      stop_posing_nude

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].join).to include("booked for 1 nude session")
      expect(model.reload.willing_to_model_nude).to be true
    end

    it "is allowed when the model's only bookings are clothed" do
      create(:gig, art_model_availability: slot)
      stop_posing_nude

      expect(response).to have_http_status(:ok)
      expect(model.reload.willing_to_model_nude).to be false
    end
  end
end
