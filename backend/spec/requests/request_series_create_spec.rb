require "rails_helper"

RSpec.describe "Creating a request series", type: :request do
  let(:faculty)   { create(:user) }
  let(:base)      { { class_name: "Figure Drawing I", department: "Drawing", building: "Main", model_mode: "clothed" } }
  let(:next_week) { 7.days.from_now.to_date.iso8601 }

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
end