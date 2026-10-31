# Classes: who can change them, what faculty and admins see, and what changes reach past dates.

require "rails_helper"

RSpec.describe "Request series permissions", type: :request do
  let(:faculty) { create(:user) }
  let(:admin)   { create(:user, :admin) }
  let(:series)  { create(:request_series, user: faculty) }
  let!(:booked_date) do
    request = create(:faculty_request, user: faculty, request_series: series)
    create(:gig, faculty_request: request)
    request.refresh_match_status!
    request
  end

  # Changes the class, as the given user.
  def patch_series(as:, changes:)
    patch "/request_series/#{series.id}",
      params: { request_series: changes }, headers: auth_headers(as), as: :json
  end

  it "blocks faculty from editing a series with a booked model" do
    patch_series(as: faculty, changes: { notes: "changed" })
    expect(response).to have_http_status(:forbidden)
    expect(series.reload.notes).not_to eq("changed")
  end

  it "lets an admin edit it" do
    patch_series(as: admin, changes: { notes: "changed" })
    expect(response).to have_http_status(:ok)
    expect(series.reload.notes).to eq("changed")
  end

  it "blocks switching to nude while a clothed-only model is booked, even for admins" do
    patch_series(as: admin, changes: { model_mode: "nude" })
    expect(response).to have_http_status(:unprocessable_content)
    expect(series.reload.model_mode).to eq("clothed")
  end

  it "only changes dates that haven't started, so past dates and old reports stay as they were" do
    past_date = create(:faculty_request, user: faculty, request_series: series)
    past_date.update_columns(starts_at: 3.days.ago.change(hour: 10), ends_at: 3.days.ago.change(hour: 12))

    patch_series(as: admin, changes: { department: "Painting", class_name: "Painting Studio" })

    expect(response).to have_http_status(:ok)
    expect(booked_date.reload.department).to eq("Painting")
    expect(booked_date.class_name).to eq("Painting Studio")
    expect(past_date.reload.department).to eq("Drawing")
    expect(past_date.class_name).to eq("Figure Drawing I")
  end

  describe "listing series" do
    # The booked model cancels their gig on the booked date; returns that model.
    def model_drops_out
      gig = booked_date.confirmed_gigs.first
      model = gig.art_model_availability.user
      post "/art_model_availabilities/#{gig.art_model_availability_id}/cancel",
        params: { gig_id: gig.id }, headers: auth_headers(model), as: :json
      model
    end

    it "tells admins which model dropped out of a date that needs attention" do
      model = model_drops_out
      get "/request_series", headers: auth_headers(admin)

      date = response.parsed_body.first["faculty_requests"].first
      expect(date["needs_attention"]).to be true
      expect(date["dropped_out_model_name"]).to eq("#{model.first_name} #{model.last_name}")
    end

    it "doesn't share the model's name with faculty" do
      model_drops_out
      get "/request_series", headers: auth_headers(faculty)

      date = response.parsed_body.first["faculty_requests"].first
      expect(date).not_to have_key("dropped_out_model_name")
    end
  end

  describe "release and rematch" do
    it "frees every booked model and reopens the dates" do
      post "/request_series/#{series.id}/release_remaining", headers: auth_headers(admin)
      expect(booked_date.reload).to be_pending
      expect(booked_date.confirmed_gigs).to be_empty
    end

    it "is admin-only" do
      post "/request_series/#{series.id}/release_remaining", headers: auth_headers(faculty)
      expect(response).to have_http_status(:forbidden)
      expect(booked_date.reload).to be_matched
    end
  end

  describe "cancelling a whole series" do
    it "archives booked dates and cancels their gigs, unbilled when done ahead of time" do
      gig = booked_date.confirmed_gigs.first
      delete "/request_series/#{series.id}", headers: auth_headers(faculty)

      expect(booked_date.reload).to be_archived
      expect(gig.reload).to be_cancelled
      expect(gig.billable).to be false
    end

    it "deletes dates nobody was booked on" do
      empty_date = create(:faculty_request, user: faculty, request_series: series,
        starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
      delete "/request_series/#{series.id}", headers: auth_headers(faculty)
      expect(FacultyRequest.exists?(empty_date.id)).to be false
    end

    it "won't let another faculty member cancel it" do
      delete "/request_series/#{series.id}", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:forbidden)
      expect(booked_date.reload).to be_matched
    end
  end

  describe "what the series list reveals" do
    let(:booked_model) { booked_date.confirmed_gigs.first.art_model_availability.user }

    it "never shows faculty the booked model's personal details" do
      booked_model.update!(phone: "410-555-0199")
      get "/request_series", headers: auth_headers(faculty)

      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include(booked_model.email)
      expect(response.body).not_to include("410-555-0199")
      expect(response.body).not_to include("art_model_availability")
    end

    it "still tells faculty that a model is booked" do
      get "/request_series", headers: auth_headers(faculty)
      dates = response.parsed_body.first["faculty_requests"]
      expect(dates.first["confirmed_gigs"].size).to eq(1)
    end

    it "shows admins which model is booked" do
      get "/request_series", headers: auth_headers(admin)
      expect(response.body).to include(booked_model.email)
    end
  end

  describe "changing models per session" do
    it "reopens a matched date when an admin raises the count" do
      patch_series(as: admin, changes: { models_needed: 2 })
      expect(booked_date.reload).to be_pending
      expect(booked_date.models_needed).to eq(2)
    end

    it "won't go below the number of models already booked" do
      booked_date.update_columns(models_needed: 2)
      series.update_columns(models_needed: 2)
      create(:gig, faculty_request: booked_date)

      patch_series(as: admin, changes: { models_needed: 1 })
      expect(response).to have_http_status(:unprocessable_content)
      expect(booked_date.reload.models_needed).to eq(2)
    end

    it "copies series changes to every date" do
      patch_series(as: admin, changes: { room_number: "B204" })
      expect(booked_date.reload.room_number).to eq("B204")
    end
  end
end
