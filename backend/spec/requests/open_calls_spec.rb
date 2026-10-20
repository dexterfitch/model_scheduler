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

  it "doesn't show open calls to faculty" do
    get "/request_series/available_for_model", headers: auth_headers(create(:user))
    expect(response).to have_http_status(:forbidden)
  end
end