require "rails_helper"

RSpec.describe FacultyRequest, type: :model do
  it "stays pending until every requested model is booked" do
    group_class = create(:faculty_request, models_needed: 2)

    create(:gig, faculty_request: group_class)
    group_class.refresh_match_status!
    expect(group_class).to be_pending

    create(:gig, faculty_request: group_class)
    group_class.refresh_match_status!
    expect(group_class).to be_matched
  end

  it "won't lower the number of models below how many are booked" do
    group_class = create(:faculty_request, models_needed: 2)
    2.times { create(:gig, faculty_request: group_class) }

    group_class.models_needed = 1
    expect(group_class).not_to be_valid
  end

  it "won't switch to nude while a clothed-only model is booked" do
    booked = create(:gig).faculty_request
    booked.model_mode = :nude
    expect(booked).not_to be_valid
    expect(booked.errors.full_messages.join).to include("only model clothed")
  end

  it "allows switching to nude when the booked model is willing" do
    model = create(:user, :model, :nude_ok)
    slot = create(:art_model_availability, user: model)
    booked = create(:gig, art_model_availability: slot).faculty_request
    booked.model_mode = :nude
    expect(booked).to be_valid
  end

  it "clears the genitalia preference for clothed sessions" do
    req = create(:faculty_request, pref_genitalia: "Intersex")
    expect(req.pref_genitalia).to eq("Any")
  end

  describe ".wrap_standalone_requests_in_series!" do
    it "gives each request without a series its own series, with the same class details" do
      loose = create(:faculty_request, class_name: "Portrait Lab", department: "Painting",
                                       building: "Fox", models_needed: 2, room_number: "301")
      loose.update_columns(request_series_id: nil)

      FacultyRequest.wrap_standalone_requests_in_series!

      series = loose.reload.request_series
      expect(series).to be_present
      expect(series.user).to eq(loose.user)
      expect(series.class_name).to eq("Portrait Lab")
      expect(series.department).to eq("Painting")
      expect(series.building).to eq("Fox")
      expect(series.models_needed).to eq(2)
      expect(series.room_number).to eq("301")
      expect(series).to be_pending
    end

    it "leaves requests that already have a series alone" do
      request = create(:faculty_request, request_series: create(:request_series))
      expect { FacultyRequest.wrap_standalone_requests_in_series! }
        .not_to(change { request.reload.request_series_id })
    end
  end
end