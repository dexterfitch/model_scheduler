require 'rails_helper'

RSpec.describe "Users API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:superuser) { create(:user, :superuser) }
  let(:faculty) { create(:user) }
  let(:model_user) { create(:user, :model) }

  def login(user)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "GET /users" do
    it "allows admin access" do
      login(admin)
      get "/users"
      expect(response).to have_http_status(:ok)
    end

    it "denies faculty access" do
      login(faculty)
      get "/users"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies model access" do
      login(model_user)
      get "/users"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies unauthenticated access" do
      get "/users"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /users/:id/promote" do
    it "allows admin to promote a user" do
      login(admin)
      post "/users/#{faculty.id}/promote", params: { role: 'model' }
      expect(response).to have_http_status(:ok)
    end

    it "denies faculty from promoting users" do
      login(faculty)
      post "/users/#{model_user.id}/promote", params: { role: 'admin' }
      expect(response).to have_http_status(:forbidden)
    end

    it "rejects invalid roles" do
      login(admin)
      post "/users/#{faculty.id}/promote", params: { role: 'supervillain' }
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "POST /users/:id/promote_to_superuser" do
    it "allows superuser to promote an admin" do
      login(superuser)
      target = create(:user, :admin)
      post "/users/#{target.id}/promote_to_superuser"
      expect(response).to have_http_status(:ok)
    end

    it "denies non-superuser admin from promoting to superuser" do
      login(admin)
      target = create(:user, :admin)
      post "/users/#{target.id}/promote_to_superuser"
      expect(response).to have_http_status(:forbidden)
    end

    it "rejects promoting a non-admin to superuser" do
      login(superuser)
      post "/users/#{faculty.id}/promote_to_superuser"
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PATCH /users/:id" do
    it "allows a user to update their own profile" do
      login(faculty)
      patch "/users/#{faculty.id}", params: { user: { first_name: "Updated" } }
      expect(response).to have_http_status(:ok)
    end

    it "prevents a user from updating another user's profile" do
      login(faculty)
      patch "/users/#{model_user.id}", params: { user: { first_name: "Hacked" } }
      expect(response).to have_http_status(:forbidden)
    end

    it "ignores role changes via update" do
      login(faculty)
      patch "/users/#{faculty.id}", params: { user: { role: "admin" } }
      expect(faculty.reload.role).to eq("faculty")
    end
  end
end