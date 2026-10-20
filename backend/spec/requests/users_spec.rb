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
      post "/users/#{user.id}/promote", params: { role: "model" }, headers: auth_headers(admin), as: :json
      expect(user.reload).to be_role_model
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
end