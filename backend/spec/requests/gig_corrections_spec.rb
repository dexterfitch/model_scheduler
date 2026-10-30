require "rails_helper"

RSpec.describe "Correcting the record of a past gig", type: :request do
  let(:admin)   { create(:user, :admin, first_name: "Pat") }
  let(:gig)     { create(:gig) }
  let(:booked_class) { gig.faculty_request }
  let(:model)   { gig.art_model_availability.user }
  let(:two_days_ago) { 2.days.ago.change(hour: 10) }

  # Book it as a future date, then move it into the past, like a class that already happened
  def move_into_past(g, start = two_days_ago)
    g.faculty_booked_class.update_columns(starts_at: start, ends_at: start + 2.hours)
    g.art_model_availability.update_columns(starts_at: start, ends_at: start + 2.hours)
    g
  end

  def correct(params, as: admin, target: gig)
    post "/gigs/#{target.id}/corrections", params: { correction: params }, headers: auth_headers(as), as: :json
  end

  before { move_into_past(gig) }

  it "is only for admins" do
    correct({ kind: "no_show" }, as: model)
    expect(response).to have_http_status(:forbidden)
    correct({ kind: "no_show" }, as: booked_class.user)
    expect(response).to have_http_status(:forbidden)
  end

  it "won't correct a date that hasn't happened yet" do
    future = create(:gig)
    correct({ kind: "no_show" }, target: future)
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["errors"].join).to include("hasn't happened yet")
    expect(future.reload).to be_confirmed
  end

  describe "no-show" do
    it "marks the gig as a no-show that isn't paid, and records who did it and why" do
      correct({ kind: "no_show", note: "Alice says nobody came" })
      expect(response).to have_http_status(:ok)

      gig.reload
      expect(gig.no_show).to be true
      expect(gig).to be_cancelled
      expect(gig.billable).to be false

      entry = gig.gig_corrections.last
      expect(entry.user).to eq(admin)
      expect(entry.kind).to eq("no_show")
      expect(entry.note).to eq("Alice says nobody came")
      expect(response.parsed_body["corrections"].last["summary"]).to include("no-show")
    end

    it "doesn't need a note" do
      correct({ kind: "no_show" })
      expect(response).to have_http_status(:ok)
      expect(gig.gig_corrections.last.note).to be_nil
    end

    it "can be undone, so the model is paid again" do
      correct({ kind: "no_show" })
      correct({ kind: "undo_no_show" })
      expect(response).to have_http_status(:ok)
      gig.reload
      expect(gig.no_show).to be false
      expect(gig).to be_confirmed
      expect(gig.billable).to be_nil
      expect(gig.gig_corrections.count).to eq(2)
    end

    it "won't undo a no-show once someone else is recorded in that spot" do
      stand_in = create(:user, :model)
      correct({ kind: "covered_by", stand_in_user_id: stand_in.id })
      correct({ kind: "undo_no_show" })
      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload.no_show).to be true
    end
  end

  describe "paid or not paid" do
    it "won't stop paying a model who worked (that's a no-show, or fewer hours)" do
      correct({ kind: "unpaid" })
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].join).to include("No-show")
      expect(gig.reload.billable).to be_nil
    end

    it "can take back a cancellation that was paid by mistake" do
      gig.update_columns(status: Gig.statuses[:cancelled], billable: true)
      correct({ kind: "unpaid" })
      expect(response).to have_http_status(:ok)
      expect(gig.reload.billable).to be false
    end

    it "can pay a cancellation the coordinator decided to honour" do
      gig.update_columns(status: Gig.statuses[:cancelled], billable: false)
      correct({ kind: "paid" })
      expect(response).to have_http_status(:ok)
      expect(gig.reload.billable).to be true
    end
  end

  describe "hours worked" do
    it "records the hours the model really worked" do
      correct({ kind: "hours", worked_starts_at: two_days_ago, worked_ends_at: two_days_ago + 90.minutes })
      expect(response).to have_http_status(:ok)
      gig.reload
      expect(gig.worked_starts_at).to eq(two_days_ago)
      expect(gig.worked_ends_at).to eq(two_days_ago + 90.minutes)
      # The class itself keeps its booked times
      expect(booked_class.reload.ends_at).to eq(two_days_ago + 2.hours)
    end

    it "refuses an end time before the start time" do
      correct({ kind: "hours", worked_starts_at: two_days_ago, worked_ends_at: two_days_ago - 1.hour })
      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload.worked_starts_at).to be_nil
    end

    it "can go back to the booked hours" do
      correct({ kind: "hours", worked_starts_at: two_days_ago, worked_ends_at: two_days_ago + 1.hour })
      correct({ kind: "hours", reset_hours: true })
      expect(gig.reload.worked_starts_at).to be_nil
      expect(gig.worked_ends_at).to be_nil
    end
  end

  describe "someone else covered" do
    let(:stand_in) { create(:user, :model, first_name: "Riley") }

    it "marks the booked model as a no-show and gives the stand-in a paid gig on that date" do
      correct({ kind: "covered_by", stand_in_user_id: stand_in.id, note: "Riley stepped in" })
      expect(response).to have_http_status(:ok)

      expect(gig.reload.no_show).to be true
      cover = booked_class.reload.confirmed_gigs.joins(:art_model_availability)
        .find_by(art_model_availabilities: { user_id: stand_in.id })
      expect(cover).to be_present
      expect(cover.billable).to be_nil
      expect(cover.gig_corrections.last.summary).to include("Covered for")
    end

    it "won't record a clothed-only model covering a nude class" do
      booked_class.update_columns(model_mode: FacultyRequest.model_modes[:nude])
      model.update_columns(willing_to_model_nude: true)
      correct({ kind: "covered_by", stand_in_user_id: stand_in.id })
      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload.no_show).to be false
    end

    it "won't record the booked model covering for themselves" do
      correct({ kind: "covered_by", stand_in_user_id: model.id })
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "what each person sees" do
    before { correct({ kind: "no_show", note: "Private note for admins" }) }

    it "shows admins the corrections on the gig list" do
      get "/gigs", headers: auth_headers(admin)
      listed = response.parsed_body.find { |g| g["id"] == gig.id }
      expect(listed["no_show"]).to be true
      expect(listed["corrections"].last["note"]).to eq("Private note for admins")
      expect(listed["corrections"].last["user"]["first_name"]).to eq("Pat")
    end

    it "tells the model it was recorded as a no-show, without the admin's note" do
      get "/gigs", headers: auth_headers(model)
      expect(response.parsed_body.first["no_show"]).to be true
      expect(response.body).not_to include("Private note for admins")
    end

    it "includes every gig of each date, with its corrections, on the admin's Requests page" do
      series = booked_class.request_series
      get "/request_series", headers: auth_headers(admin)
      date = response.parsed_body.find { |s| s["id"] == series.id }["faculty_requests"].first
      expect(date["gigs"].first["no_show"]).to be true
      expect(date["gigs"].first["corrections"].first["note"]).to eq("Private note for admins")
    end

    it "keeps corrections off the faculty member's view" do
      get "/request_series", headers: auth_headers(booked_class.user)
      expect(response.body).not_to include("Private note for admins")
      expect(response.parsed_body.first["faculty_requests"].first).not_to have_key("gigs")
    end
  end
end
