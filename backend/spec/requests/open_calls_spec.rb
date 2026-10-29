require "rails_helper"

RSpec.describe "Open calls for models", type: :request do
  let(:clothed_only) { create(:user, :model) }
  let(:nude_ok)      { create(:user, :model, :nude_ok) }

  def open_series_ids(as)
    get "/request_series/available_for_model", headers: auth_headers(as)
    response.parsed_body.map { |s| s["id"] }
  end

  def series_with_date(mode)
    series = create(:request_series, model_mode: mode)
    create(:faculty_request, request_series: series, model_mode: mode)
    series
  end

  it "hides nude sessions from models who only pose clothed" do
    nude_series = series_with_date("nude")
    expect(open_series_ids(clothed_only)).not_to include(nude_series.id)
  end

  it "shows nude sessions to models willing to pose nude" do
    nude_series = series_with_date("nude")
    expect(open_series_ids(nude_ok)).to include(nude_series.id)
  end

  it "hides a date from a model already booked on it, but not from others" do
    series = create(:request_series, models_needed: 2)
    group_class = create(:faculty_request, request_series: series, models_needed: 2)
    slot = create(:art_model_availability, user: clothed_only)
    create(:gig, faculty_request: group_class, art_model_availability: slot)

    expect(open_series_ids(clothed_only)).not_to include(series.id)
    expect(open_series_ids(nude_ok)).to include(series.id)
  end

  it "only offers dates that are still to come" do
    series = create(:request_series)
    upcoming = create(:faculty_request, request_series: series)
    past = create(:faculty_request, request_series: series)
    past.update_columns(starts_at: 2.days.ago.change(hour: 10), ends_at: 2.days.ago.change(hour: 12))

    get "/request_series/available_for_model", headers: auth_headers(clothed_only)
    offered = response.parsed_body.find { |s| s["id"] == series.id }
    expect(offered["faculty_requests"].map { |r| r["id"] }).to eq([upcoming.id])
  end

  it "leaves out a class whose open dates have all passed" do
    series = series_with_date("clothed")
    series.faculty_requests.update_all(starts_at: 2.days.ago.change(hour: 10), ends_at: 2.days.ago.change(hour: 12))
    expect(open_series_ids(clothed_only)).not_to include(series.id)
  end

  it "doesn't show open calls to faculty" do
    get "/request_series/available_for_model", headers: auth_headers(create(:user))
    expect(response).to have_http_status(:forbidden)
  end

  it "lists open calls by their next date, and each call's dates in order" do
    later = create(:request_series)
    create(:faculty_request, request_series: later, starts_at: 9.days.from_now.change(hour: 10), ends_at: 9.days.from_now.change(hour: 12))
    sooner = create(:request_series)
    # Added out of order on purpose
    create(:faculty_request, request_series: sooner, starts_at: 12.days.from_now.change(hour: 10), ends_at: 12.days.from_now.change(hour: 12))
    create(:faculty_request, request_series: sooner, starts_at: 3.days.from_now.change(hour: 10), ends_at: 3.days.from_now.change(hour: 12))

    get "/request_series/available_for_model", headers: auth_headers(clothed_only)
    calls = response.parsed_body.select { |c| [later.id, sooner.id].include?(c["id"]) }
    expect(calls.map { |c| c["id"] }).to eq([sooner.id, later.id])
    dates = calls.first["faculty_requests"].map { |r| Time.zone.parse(r["starts_at"]).to_date }
    expect(dates).to eq(dates.sort)
  end
end
