# Cancelling one of two classes in the same free time, and changing classes saved under older rules.

require "rails_helper"

RSpec.describe "Cancelling one of two classes booked into the same free time", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:model) { create(:user, :model) }
  let(:day)   { 7.days.from_now }
  let(:slot)  { create(:art_model_availability, user: model, starts_at: day.change(hour: 8), ends_at: day.change(hour: 20)) }

  # A class on the test day at the given hour, booked into the shared block of free time.
  def booked_class(start_hour)
    request = create(:faculty_request, starts_at: day.change(hour: start_hour), ends_at: day.change(hour: start_hour + 2))
    gig = create(:gig, faculty_request: request, art_model_availability: slot)
    request.refresh_match_status!
    request.request_series.update_status!
    gig
  end

  let!(:morning)   { booked_class(10) }
  let!(:afternoon) { booked_class(14) }

  it "lets an admin release the model from one class and keeps the other booked" do
    delete "/gigs/#{morning.id}", headers: auth_headers(admin)
    expect(response).to have_http_status(:ok)
    expect(morning.reload).to be_cancelled
    expect(afternoon.reload).to be_confirmed
    expect(slot.reload).to be_active
  end

  it "lets faculty cancel one date and keeps the model's other class booked" do
    faculty = morning.faculty_request.user
    delete "/faculty_requests/#{morning.faculty_request_id}", headers: auth_headers(faculty)
    expect(response).to have_http_status(:ok)
    expect(morning.reload).to be_cancelled
    expect(afternoon.reload).to be_confirmed
  end

  it "lets an admin use Release and Rematch on one class and keeps the other booked" do
    post "/request_series/#{morning.faculty_request.request_series_id}/release_remaining", headers: auth_headers(admin)
    expect(response).to have_http_status(:ok)
    expect(morning.reload).to be_cancelled
    expect(afternoon.reload).to be_confirmed
  end
end

RSpec.describe "Changing the status of a class saved under older rules", type: :request do
  let(:admin) { create(:user, :admin) }

  it "still cancels a date whose class has a building name from before today's list" do
    request = create(:faculty_request)
    request.update_columns(building: "Main Building")
    request.request_series.update_columns(building: "Main Building")

    delete "/faculty_requests/#{request.id}", headers: auth_headers(request.user)
    expect(response).to have_http_status(:no_content)
    expect(FacultyRequest.exists?(request.id)).to be false
    expect(request.request_series.reload).to be_archived
  end

  it "still books a model into a class with a building name from before today's list" do
    request = create(:faculty_request)
    request.update_columns(building: "Main Building")
    request.request_series.update_columns(building: "Main Building")
    slot = create(:art_model_availability)

    post "/gigs", params: { gig: { faculty_request_id: request.id, art_model_availability_id: slot.id } },
      headers: auth_headers(admin), as: :json
    expect(response).to have_http_status(:created)
    expect(request.request_series.reload).to be_matched
  end
end
