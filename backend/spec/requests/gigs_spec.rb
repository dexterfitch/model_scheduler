require 'rails_helper'

RSpec.describe "Gigs API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:faculty) { create(:user) }
  let(:model_user) { create(:user, :model) }
  let(:other_model) { create(:user, :model) }

  def login(user)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  let(:faculty_request) { create(:faculty_request, user: faculty) }
  let(:availability) { create(:art_model_availability, user: model_user) }
  let(:gig) { create(:gig, faculty_request: faculty_request, art_model_availability: availability) }

  describe "GET /gigs" do
    it "allows admin access and returns all gigs" do
      gig
      login(admin)
      get "/gigs"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(1)
    end

    it "allows model access and returns only their gigs" do
      gig
      other_availability = create(:art_model_availability, user: other_model)
      other_request = create(:faculty_request, user: faculty)
      create(:gig, faculty_request: other_request, art_model_availability: other_availability)
      login(model_user)
      get "/gigs"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(1)
    end

    it "denies faculty access" do
      login(faculty)
      get "/gigs"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies unauthenticated access" do
      get "/gigs"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /gigs" do
    it "allows admin to create a gig" do
      login(admin)
      post "/gigs", params: {
          gig: {
            faculty_request_id: faculty_request.id,
            art_model_availability_id: availability.id
          }
      }
      expect(response).to have_http_status(:created)
    end

    it "denies faculty from creating gigs" do
      login(faculty)
      post "/gigs", params: {
        faculty_request_id: faculty_request.id,
        art_model_availability_id: availability.id
      }
      expect(response).to have_http_status(:forbidden)
    end

    it "denies models from creating gigs" do
      login(model_user)
      post "/gigs", params: {
        faculty_request_id: faculty_request.id,
        art_model_availability_id: availability.id
      }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /gigs/:id" do
    it "allows admin to delete a gig" do
      login(admin)
      delete "/gigs/#{gig.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "denies faculty from deleting gigs" do
      login(faculty)
      delete "/gigs/#{gig.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies models from deleting gigs" do
      login(model_user)
      delete "/gigs/#{gig.id}"
      expect(response).to have_http_status(:forbidden)
    end
  end
end