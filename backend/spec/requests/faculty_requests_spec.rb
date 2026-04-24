require 'rails_helper'

RSpec.describe "Faculty Requests API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:faculty) { create(:user) }
  let(:other_faculty) { create(:user) }
  let(:model_user) { create(:user, :model) }

  def login(user)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  let(:faculty_request) { create(:faculty_request, user: faculty) }

  describe "GET /faculty_requests" do
    it "allows admin to see all requests" do
      create(:faculty_request, user: faculty)
      create(:faculty_request, user: other_faculty)
      login(admin)
      get "/faculty_requests"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(2)
    end

    it "allows faculty to see only their own requests" do
      create(:faculty_request, user: faculty)
      create(:faculty_request, user: other_faculty)
      login(faculty)
      get "/faculty_requests"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(1)
    end

    it "denies model access" do
      login(model_user)
      get "/faculty_requests"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies unauthenticated access" do
      get "/faculty_requests"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /faculty_requests" do
    let(:valid_params) do
      {
        faculty_request: {
          class_name: "Figure Drawing",
          department: "Drawing",
          starts_at: 1.week.from_now.change(hour: 10, min: 0),
          ends_at: 1.week.from_now.change(hour: 12, min: 0),
          model_mode: "clothed",
          pref_skin_tone: "Any",
          pref_gender: "Any"
        }
      }
    end

    it "allows faculty to create a request" do
      login(faculty)
      post "/faculty_requests", params: valid_params
      expect(response).to have_http_status(:created)
    end

    it "forces user_id to current user for faculty" do
      login(faculty)
      post "/faculty_requests", params: valid_params.deep_merge(
        faculty_request: { user_id: other_faculty.id }
      )
      expect(JSON.parse(response.body)['user_id']).to eq(faculty.id)
    end

    it "denies model access" do
      login(model_user)
      post "/faculty_requests", params: valid_params
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /faculty_requests/:id" do
    it "allows admin to delete any request" do
      login(admin)
      delete "/faculty_requests/#{faculty_request.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "allows faculty to delete their own request" do
      login(faculty)
      delete "/faculty_requests/#{faculty_request.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "prevents faculty from deleting another faculty's request" do
      login(other_faculty)
      delete "/faculty_requests/#{faculty_request.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies model access" do
      login(model_user)
      delete "/faculty_requests/#{faculty_request.id}"
      expect(response).to have_http_status(:forbidden)
    end
  end
end