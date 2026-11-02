# Loading only recent records: the Requests and Gigs pages ask for the last year,
# and can ask for everything.

require "rails_helper"

RSpec.describe "Recent data", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:old_date) do
    date = create(:faculty_request, class_name: "Old Class")
    date.request_series.update_columns(class_name: "Old Class")
    date.update_columns(starts_at: 2.years.ago, ends_at: 2.years.ago + 2.hours)
    date
  end
  let(:new_date) { create(:faculty_request, class_name: "New Class") }

  it "lists only classes with a date since the given day" do
    old_date
    new_date
    get "/request_series", params: { since: 1.year.ago.to_date.iso8601 }, headers: auth_headers(admin)
    expect(response.parsed_body.map { |s| s["id"] }).to eq([new_date.request_series_id])
  end

  it "lists every class without a day, or with one it can't read" do
    old_date
    new_date
    get "/request_series", headers: auth_headers(admin)
    expect(response.parsed_body.length).to eq(2)
    get "/request_series", params: { since: "not-a-date" }, headers: auth_headers(admin)
    expect(response.parsed_body.length).to eq(2)
  end

  it "lists only gigs on dates since the given day" do
    old_gig = create(:gig)
    old_gig.faculty_request.update_columns(starts_at: 2.years.ago, ends_at: 2.years.ago + 2.hours)
    new_gig = create(:gig, faculty_request: new_date)
    get "/gigs", params: { since: 1.year.ago.to_date.iso8601 }, headers: auth_headers(admin)
    ids = response.parsed_body.map { |g| g["id"] }
    expect(ids).to include(new_gig.id)
    expect(ids).not_to include(old_gig.id)
  end
end
