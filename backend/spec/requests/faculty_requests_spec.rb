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
end