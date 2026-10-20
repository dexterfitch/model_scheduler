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
end