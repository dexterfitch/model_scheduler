# Retiring a model who no longer poses, and removing a person's data on request
# while keeping the history that pay and reports depend on.

require "rails_helper"

RSpec.describe "Retiring models and removing data", type: :request do
  let(:admin)     { create(:user, :admin) }
  let(:superuser) { create(:user, :admin, superuser: true) }
  let(:faculty)   { create(:user) }
  let(:model) do
    create(:user, :model, first_name: "Jordan", last_name: "Ellis", phone: "410-555-0100",
      stage_name: "J", pronouns: "she/her", body_type: "Average")
  end

  # A gig of the model's that already happened.
  def past_gig_for(user)
    gig = create(:gig, art_model_availability: create(:art_model_availability, user: user))
    past = 3.days.ago.change(hour: 10)
    gig.faculty_request.update_columns(starts_at: past, ends_at: past + 2.hours, status: FacultyRequest.statuses[:matched])
    gig.art_model_availability.update_columns(starts_at: past - 1.hour, ends_at: past + 7.hours)
    gig
  end

  describe "retiring a model" do
    it "stops them being offered: their upcoming free time goes, and their past gigs stay" do
      free = create(:art_model_availability, user: model)
      worked = past_gig_for(model)

      post "/users/#{model.id}/retire", headers: auth_headers(admin)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["retired_at"]).to be_present
      expect(ArtModelAvailability.exists?(free.id)).to be false
      expect(worked.reload).to be_confirmed
    end

    it "waits until they've been released from upcoming gigs" do
      create(:gig, art_model_availability: create(:art_model_availability, user: model))
      post "/users/#{model.id}/retire", headers: auth_headers(admin)
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to include("1 upcoming gig")
      expect(model.reload.retired_at).to be_nil
    end

    it "is only for models" do
      post "/users/#{faculty.id}/retire", headers: auth_headers(admin)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "is only for admins" do
      post "/users/#{model.id}/retire", headers: auth_headers(faculty)
      expect(response).to have_http_status(:forbidden)
    end

    context "once retired" do
      before { model.update_columns(retired_at: Time.current) }

      it "won't take new free time" do
        post "/art_model_availabilities",
          params: { art_model_availability: { starts_at: 8.days.from_now.change(hour: 9), ends_at: 8.days.from_now.change(hour: 12) } },
          headers: auth_headers(model), as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body["errors"].join).to include("retired")
      end

      it "shows them no open calls" do
        create(:faculty_request)
        get "/request_series/available_for_model", headers: auth_headers(model)
        expect(response.parsed_body).to eq([])
      end

      it "can't be booked, even into free time left over" do
        free = build(:art_model_availability, user: model).tap { |a| a.save!(validate: false) }
        request = create(:faculty_request)
        post "/gigs", params: { gig: { faculty_request_id: request.id, art_model_availability_id: free.id } },
          headers: auth_headers(admin), as: :json
        expect(response).to have_http_status(:unprocessable_content)
      end

      it "can be brought back" do
        post "/users/#{model.id}/reinstate", headers: auth_headers(admin)
        expect(response).to have_http_status(:ok)
        expect(model.reload.retired_at).to be_nil
      end
    end
  end

  describe "removing a person's data" do
    it "clears their name, contact details and personal answers, and signs them out everywhere" do
      old_headers = auth_headers(model)
      Notification.add!(user: model, kind: "booked", request: create(:faculty_request))

      post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)

      expect(response).to have_http_status(:ok)
      model.reload
      expect([model.first_name, model.last_name]).to eq(["Removed", "Person"])
      expect(model.email).not_to include("@mica.edu")
      expect([model.phone, model.stage_name, model.pronouns, model.skin_tone, model.gender_identity, model.body_type, model.image_url]).to all(be_nil)
      expect(model.removed_at).to be_present
      expect(model.notifications).to be_empty

      get "/me", headers: old_headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "keeps their past gigs, so reports still add up" do
      worked = past_gig_for(model)
      post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)
      expect(worked.reload).to be_confirmed
      get "/gigs", headers: auth_headers(admin)
      names = response.parsed_body.map { |g| g.dig("art_model_availability", "user", "first_name") }
      expect(names).to include("Removed")
    end

    it "lets the same person sign up again later as someone new" do
      email = model.email
      post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)
      expect(User.where("LOWER(email) = ?", email.downcase)).to be_empty
    end

    it "is only for SuperUsers" do
      post "/users/#{model.id}/remove_data", headers: auth_headers(admin)
      expect(response).to have_http_status(:forbidden)
      expect(model.reload.first_name).to eq("Jordan")
    end

    it "waits until a model has been released from upcoming gigs" do
      create(:gig, art_model_availability: create(:art_model_availability, user: model))
      post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)
      expect(response).to have_http_status(:unprocessable_content)
      expect(model.reload.first_name).to eq("Jordan")
    end

    it "waits until a faculty member's upcoming classes are cancelled" do
      create(:faculty_request, user: faculty, request_series: create(:request_series, user: faculty))
      post "/users/#{faculty.id}/remove_data", headers: auth_headers(superuser)
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to include("upcoming class")
    end

    it "won't remove the SuperUser's own data, or another SuperUser's" do
      post "/users/#{superuser.id}/remove_data", headers: auth_headers(superuser)
      expect(response).to have_http_status(:unprocessable_content)
      other = create(:user, :admin, superuser: true)
      post "/users/#{other.id}/remove_data", headers: auth_headers(superuser)
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
