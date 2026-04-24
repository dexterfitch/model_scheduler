require 'rails_helper'

RSpec.describe "Art Model Availabilities API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:model_user) { create(:user, :model) }
  let(:other_model) { create(:user, :model) }
  let(:faculty) { create(:user) }

  def login(user)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  let(:availability) { create(:art_model_availability, user: model_user) }

  describe "GET /art_model_availabilities" do
    it "allows admin to see all availabilities" do
      create(:art_model_availability, user: model_user)
      create(:art_model_availability, user: other_model)
      login(admin)
      get "/art_model_availabilities"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(2)
    end

    it "allows model to see only their own availabilities" do
      create(:art_model_availability, user: model_user)
      create(:art_model_availability, user: other_model)
      login(model_user)
      get "/art_model_availabilities"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(1)
    end

    it "denies faculty access" do
      login(faculty)
      get "/art_model_availabilities"
      expect(response).to have_http_status(:forbidden)
    end

    it "denies unauthenticated access" do
      get "/art_model_availabilities"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /art_model_availabilities" do
    let(:valid_params) do
      {
        art_model_availability: {
          starts_at: 1.week.from_now.change(hour: 9, min: 0),
          ends_at: 1.week.from_now.change(hour: 17, min: 0)
        }
      }
    end

    it "allows model to create availability" do
      login(model_user)
      post "/art_model_availabilities", params: valid_params
      expect(response).to have_http_status(:created)
    end

    it "forces user_id to current user for models" do
      login(model_user)
      post "/art_model_availabilities", params: valid_params.deep_merge(
        art_model_availability: { user_id: other_model.id }
      )
      expect(JSON.parse(response.body)['user_id']).to eq(model_user.id)
    end

    it "allows admin to create availability for any model" do
      login(admin)
      post "/art_model_availabilities", params: {
        art_model_availability: {
          user_id: model_user.id,
          starts_at: 1.week.from_now.change(hour: 9, min: 0),
          ends_at: 1.week.from_now.change(hour: 17, min: 0)
        }
      }
      expect(response).to have_http_status(:created)
    end

    it "denies faculty access" do
      login(faculty)
      post "/art_model_availabilities", params: valid_params
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /art_model_availabilities/:id" do
    it "allows model to delete their own availability" do
      login(model_user)
      delete "/art_model_availabilities/#{availability.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "prevents model from deleting another model's availability" do
      login(other_model)
      delete "/art_model_availabilities/#{availability.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "allows admin to delete any availability" do
      login(admin)
      delete "/art_model_availabilities/#{availability.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "denies faculty access" do
      login(faculty)
      delete "/art_model_availabilities/#{availability.id}"
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /art_model_availabilities/:id" do
    it "allows model to update their own availability" do
      login(model_user)
      patch "/art_model_availabilities/#{availability.id}", params: {
        art_model_availability: { ends_at: 1.week.from_now.change(hour: 18, min: 0) }
      }
      expect(response).to have_http_status(:ok)
    end

    it "prevents model from updating another model's availability" do
      login(other_model)
      patch "/art_model_availabilities/#{availability.id}", params: {
        art_model_availability: { ends_at: 1.week.from_now.change(hour: 18, min: 0) }
      }
      expect(response).to have_http_status(:forbidden)
    end

    it "prevents models from setting status directly" do
      login(model_user)
      patch "/art_model_availabilities/#{availability.id}", params: {
        art_model_availability: { status: 'cancelled' }
      }
      expect(availability.reload.status).to eq('active')
    end
  end
end