require "rails_helper"

RSpec.describe "Faculty request permissions", type: :request do
  let(:faculty)       { create(:user) }
  let(:other_faculty) { create(:user) }
  let(:their_series)  { create(:request_series, user: other_faculty) }
  let(:my_series)     { create(:request_series, user: faculty) }

  def new_date_params(series)
    {
      faculty_request: {
        request_series_id: series.id,
        class_name: "Figure Drawing I", department: "Drawing", building: "Main",
        model_mode: "clothed",
        starts_at: 7.days.from_now.change(hour: 10).iso8601,
        ends_at: 7.days.from_now.change(hour: 12).iso8601
      }
    }
  end

  it "blocks adding a date to another faculty member's series" do
    expect {
      post "/faculty_requests", params: new_date_params(their_series), headers: auth_headers(faculty), as: :json
    }.not_to change(FacultyRequest, :count)
    expect(response).to have_http_status(:forbidden)
  end

  it "allows adding a date to your own series" do
    expect {
      post "/faculty_requests", params: new_date_params(my_series), headers: auth_headers(faculty), as: :json
    }.to change(FacultyRequest, :count).by(1)
  end

  it "ignores attempts to reassign a request to someone else" do
    faculty_request = create(:faculty_request, user: faculty)
    patch "/faculty_requests/#{faculty_request.id}",
      params: { faculty_request: { user_id: other_faculty.id } }, headers: auth_headers(faculty), as: :json
    expect(faculty_request.reload.user_id).to eq(faculty.id)
  end

  describe "viewing, editing and cancelling single dates" do
    let(:my_request) { create(:faculty_request, user: faculty) }

    it "shows faculty only their own requests" do
      my_request
      create(:faculty_request, user: other_faculty)
      get "/faculty_requests", headers: auth_headers(faculty)
      expect(response.parsed_body.map { |r| r["user_id"] }.uniq).to eq([faculty.id])
    end

    it "doesn't let models see requests" do
      get "/faculty_requests", headers: auth_headers(create(:user, :model))
      expect(response).to have_http_status(:forbidden)
    end

    it "locks a date once a model is booked on it" do
      create(:gig, faculty_request: my_request)
      patch "/faculty_requests/#{my_request.id}",
        params: { faculty_request: { notes: "changed" } }, headers: auth_headers(faculty), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "won't move a date into the past" do
      patch "/faculty_requests/#{my_request.id}",
        params: { faculty_request: { starts_at: 1.day.ago.change(hour: 10).iso8601, ends_at: 1.day.ago.change(hour: 12).iso8601 } },
        headers: auth_headers(faculty), as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "cancels a booked date without billing when done ahead of time" do
      gig = create(:gig, faculty_request: my_request)
      delete "/faculty_requests/#{my_request.id}", headers: auth_headers(faculty)
      expect(my_request.reload).to be_archived
      expect(gig.reload).to be_cancelled
      expect(gig.billable).to be false
    end

    it "deletes an unbooked date outright" do
      delete "/faculty_requests/#{my_request.id}", headers: auth_headers(faculty)
      expect(FacultyRequest.exists?(my_request.id)).to be false
    end

    it "won't let another faculty member cancel your date" do
      delete "/faculty_requests/#{my_request.id}", headers: auth_headers(other_faculty)
      expect(response).to have_http_status(:forbidden)
      expect(FacultyRequest.exists?(my_request.id)).to be true
    end
  end
end