# Creating a class with its dates: valid dates, impossible dates, one bad date among many, and the
# 50-date limit.

require "rails_helper"

RSpec.describe "Creating a request series", type: :request do
  let(:faculty)   { create(:user) }
  let(:base)      { { class_name: "Figure Drawing I", department: "Drawing", building: "Main", model_mode: "clothed" } }
  let(:next_week) { 7.days.from_now.to_date.iso8601 }

  # Creates a class with the given dates, as the faculty member.
  def create_series(dates)
    post "/request_series", params: { request_series: base, dates: dates }, headers: auth_headers(faculty), as: :json
  end

  it "creates a series with valid dates" do
    expect {
      create_series([{ date: next_week, start_time: "10:00", end_time: "12:00" }])
    }.to change(FacultyRequest, :count).by(1)
    expect(response).to have_http_status(:created)
  end

  it "rejects an impossible date without crashing" do
    create_series([{ date: "2026-13-45", start_time: "10:00", end_time: "12:00" }])
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["error"]).to eq("Date #1 has an invalid date or time")
  end

  it "names the bad date and saves nothing when one date fails" do
    expect {
      create_series([
        { date: next_week, start_time: "10:00", end_time: "12:00" },
        { date: "2025-01-15", start_time: "10:00", end_time: "12:00" }
      ])
    }.not_to change(RequestSeries, :count)
    expect(response.parsed_body["error"]).to start_with("Date #2")
  end

  it "caps a series at 50 dates" do
    dates = Array.new(51) { { date: next_week, start_time: "10:00", end_time: "12:00" } }
    create_series(dates)
    expect(response.parsed_body["error"]).to eq("A request can have at most 50 dates")
  end

  describe "an admin making a request for a faculty member" do
    let(:admin)    { create(:user, :admin, first_name: "Pat", last_name: "Reyes") }
    let(:michelle) { create(:user, first_name: "Michelle", last_name: "La Perriere") }
    let(:dates) do
      [{ date: next_week, start_time: "12:30", end_time: "14:30" },
       { date: 14.days.from_now.to_date.iso8601, start_time: "09:00", end_time: "11:00" }]
    end

    # Makes a class as the admin, for the given owner (by id, or nil for none).
    def create_for(owner_id)
      post "/request_series", params: { request_series: base.merge(user_id: owner_id), dates: dates },
        headers: auth_headers(admin), as: :json
    end

    it "files the class and every date under the faculty member" do
      create_for(michelle.id)
      expect(response).to have_http_status(:created)
      series = RequestSeries.find(response.parsed_body["id"])
      expect(series.user).to eq(michelle)
      expect(series.faculty_requests.pluck(:user_id)).to all(eq(michelle.id))
    end

    it "tells the faculty member, in one update listing the dates" do
      create_for(michelle.id)
      update = Notification.find_by!(user: michelle)
      expect(update.kind).to eq("class_requested")
      expect(update.title).to eq("Figure Drawing I")
      expect(update.dates.size).to eq(2)
      expect(Notification.where(user: admin)).to be_empty
    end

    it "says in History that it was made on the faculty member's behalf" do
      create_for(michelle.id)
      entry = HistoryEntry.find_by!(action: "requested")
      expect(entry.user).to eq(admin)
      expect(entry.summary).to eq("Requested Michelle La Perriere's Figure Drawing I (2 dates) on their behalf.")
    end

    it "works for a faculty account without a MICA sign-in" do
      sock = create(:user, first_name: "🧦 Visiting", last_name: "Artist")
      create_for(sock.id)
      expect(RequestSeries.last.user).to eq(sock)
    end

    it "asks which faculty member the class is for when none is chosen" do
      expect { create_for(nil) }.not_to change(RequestSeries, :count)
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to eq("Choose the faculty member this class is for.")
    end

    it "won't file a class under someone who isn't faculty" do
      create_for(create(:user, :model).id)
      expect(response.parsed_body["error"]).to eq("Choose the faculty member this class is for.")
    end

    it "won't file a class under someone whose data was removed" do
      gone = create(:user)
      gone.update_columns(removed_at: 1.day.ago)
      create_for(gone.id)
      expect(response.parsed_body["error"]).to eq("Choose the faculty member this class is for.")
    end
  end

  it "keeps a faculty member's own request under their name, whatever owner is sent" do
    other = create(:user)
    post "/request_series", params: { request_series: base.merge(user_id: other.id), dates: [{ date: next_week, start_time: "10:00", end_time: "12:00" }] },
      headers: auth_headers(faculty), as: :json
    expect(RequestSeries.last.user).to eq(faculty)
    expect(Notification.count).to eq(0)
    expect(HistoryEntry.last.summary).to eq("Requested Test User's Figure Drawing I (1 date).")
  end
end
