# Calendar subscription links: each person's private feed of their gigs or classes,
# for Google, Apple or Outlook Calendar to keep up to date.

require "rails_helper"

RSpec.describe "Calendar links", type: :request do
  let(:admin)   { create(:user, :admin) }
  let(:superuser) { create(:user, :admin, superuser: true) }
  let(:faculty) { create(:user, first_name: "Priya", last_name: "Nair") }
  let(:model)   { create(:user, :model, first_name: "Jordan", last_name: "Ellis") }
  let(:series)  { create(:request_series, user: faculty, class_name: "Anatomy Lab", building: "Fox", room_number: "201") }
  let(:date)    { create(:faculty_request, user: faculty, request_series: series, class_name: "Anatomy Lab", building: "Fox", room_number: "201") }

  # The person's calendar link, made if they don't have one yet.
  def link_for(user)
    get "/calendar_link", headers: auth_headers(user)
    response.parsed_body["url"]
  end

  # The feed at a link, as a calendar app would fetch it (no sign-in).
  def fetch(url)
    get URI(url).path
    response
  end

  it "gives each signed-in person one private link, the same each time" do
    first = link_for(model)
    expect(first).to match(%r{/calendar/[A-Za-z0-9_-]{20,}\.ics\z})
    expect(link_for(model)).to eq(first)
    expect(link_for(faculty)).not_to eq(first)
  end

  it "needs a sign-in to see or reset the link" do
    get "/calendar_link"
    expect(response).to have_http_status(:unauthorized)
  end

  it "shows a model their booked classes, and leaves out cancelled ones" do
    create(:gig, faculty_request: date, art_model_availability: create(:art_model_availability, user: model))
    other = create(:faculty_request, class_name: "Painting II", starts_at: 9.days.from_now.change(hour: 10), ends_at: 9.days.from_now.change(hour: 12))
    create(:gig, faculty_request: other, status: :cancelled,
      art_model_availability: create(:art_model_availability, user: model, starts_at: 9.days.from_now.change(hour: 9), ends_at: 9.days.from_now.change(hour: 17)))

    feed = fetch(link_for(model))

    expect(feed).to have_http_status(:ok)
    expect(feed.media_type).to eq("text/calendar")
    expect(feed.body).to start_with("BEGIN:VCALENDAR")
    expect(feed.body).to include("SUMMARY:Modeling: Anatomy Lab")
    expect(feed.body).to include("LOCATION:Fox 201")
    expect(feed.body).to include("DTSTART:#{date.starts_at.utc.strftime('%Y%m%dT%H%M%SZ')}")
    expect(feed.body).not_to include("Painting II")
  end

  it "shows faculty their class dates and whether a model is booked, without naming the model" do
    date
    unbooked = create(:faculty_request, user: faculty, request_series: series, class_name: "Anatomy Lab",
      starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
    create(:gig, faculty_request: date, art_model_availability: create(:art_model_availability, user: model))

    body = fetch(link_for(faculty)).body

    expect(body).to include("SUMMARY:Anatomy Lab (model booked)")
    expect(body).to include("SUMMARY:Anatomy Lab (needs a model)")
    expect(body).to include("UID:date-#{unbooked.id}@")
    expect(body).not_to include("Jordan")
  end

  it "shows admins every booking, with the model's name" do
    create(:gig, faculty_request: date, art_model_availability: create(:art_model_availability, user: model))
    expect(fetch(link_for(admin)).body).to include("SUMMARY:Jordan Ellis: Anatomy Lab")
  end

  it "keeps commas and semicolons in names from breaking the calendar" do
    date.update_columns(class_name: "Life Drawing; Advanced, Section 2")
    create(:gig, faculty_request: date, art_model_availability: create(:art_model_availability, user: model))
    expect(fetch(link_for(model)).body).to include("SUMMARY:Modeling: Life Drawing\\; Advanced\\, Section 2")
  end

  it "makes a new link on reset, and the old one stops working" do
    old = link_for(model)
    post "/calendar_link/reset", headers: auth_headers(model)
    new_url = response.parsed_body["url"]

    expect(new_url).not_to eq(old)
    expect(fetch(old)).to have_http_status(:not_found)
    expect(fetch(new_url)).to have_http_status(:ok)
  end

  it "answers an unknown link with not found" do
    expect(fetch("http://www.example.com/calendar/not-a-real-link.ics")).to have_http_status(:not_found)
  end

  it "stops a person's link working once their data is removed" do
    url = link_for(model)
    post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)
    expect(fetch(url)).to have_http_status(:not_found)
  end
end
