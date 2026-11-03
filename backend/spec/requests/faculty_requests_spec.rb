# Class dates: who can add, move and cancel them, and when.

require "rails_helper"

RSpec.describe "Faculty request permissions", type: :request do
  let(:faculty)       { create(:user) }
  let(:other_faculty) { create(:user) }
  let(:their_series)  { create(:request_series, user: other_faculty) }
  let(:my_series)     { create(:request_series, user: faculty) }

  # The request for adding a date to the given class.
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

  it "only changes the day and times when one date is edited; class details stay with the series" do
    faculty_request = create(:faculty_request, user: faculty, class_name: "Figure Drawing I", building: "Main")
    new_start = 8.days.from_now.change(hour: 13)

    patch "/faculty_requests/#{faculty_request.id}",
      params: { faculty_request: {
        class_name: "Something Else", building: "Fox",
        starts_at: new_start.iso8601, ends_at: (new_start + 2.hours).iso8601
      } },
      headers: auth_headers(faculty), as: :json

    expect(response).to have_http_status(:ok)
    faculty_request.reload
    expect(faculty_request.starts_at).to eq(new_start)
    expect(faculty_request.class_name).to eq("Figure Drawing I")
    expect(faculty_request.building).to eq("Main")
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

    it "keeps an unbooked date, marked cancelled, so there's a record of it" do
      delete "/faculty_requests/#{my_request.id}", headers: auth_headers(faculty)
      expect(my_request.reload).to be_archived
    end

    it "won't let another faculty member cancel your date" do
      delete "/faculty_requests/#{my_request.id}", headers: auth_headers(other_faculty)
      expect(response).to have_http_status(:forbidden)
      expect(FacultyRequest.exists?(my_request.id)).to be true
    end
  end

  describe "dates and times" do
    let(:admin)      { create(:user, :admin) }
    let(:my_request) { create(:faculty_request, user: faculty) }

    # Moves a date to the given hours, the given number of days out, as the given user.
    def move(req, as:, start_hour:, end_hour:, days_out: 7)
      day = days_out.days.from_now
      patch "/faculty_requests/#{req.id}",
        params: { faculty_request: { starts_at: day.change(hour: start_hour).iso8601, ends_at: day.change(hour: end_hour).iso8601 } },
        headers: auth_headers(as), as: :json
    end

    it "lets faculty move an unbooked date" do
      move(my_request, as: faculty, start_hour: 13, end_hour: 15)
      expect(response).to have_http_status(:ok)
      expect(my_request.reload.starts_at.hour).to eq(13)
    end

    it "rejects a class that starts before 8am" do
      move(my_request, as: faculty, start_hour: 7, end_hour: 9)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "rejects a class that runs past 10pm" do
      move(my_request, as: faculty, start_hour: 21, end_hour: 23)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "rejects a date more than four months out" do
      move(my_request, as: faculty, start_hour: 10, end_hour: 12, days_out: 130)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "won't reschedule a booked date on top of the model's other gig" do
      gig = create(:gig, faculty_request: my_request)
      model = gig.art_model_availability.user
      other_day = 9.days.from_now
      other_slot = create(:art_model_availability, user: model,
        starts_at: other_day.change(hour: 9), ends_at: other_day.change(hour: 17))
      create(:gig, art_model_availability: other_slot,
        faculty_request: create(:faculty_request, starts_at: other_day.change(hour: 10), ends_at: other_day.change(hour: 12)))

      move(my_request, as: admin, start_hour: 10, end_hour: 12, days_out: 9)
      expect(response).to have_http_status(:unprocessable_content)
      expect(my_request.reload.starts_at.to_date).to eq(7.days.from_now.to_date)
    end
  end

  describe "cancelling a date that already happened" do
    it "refuses, and keeps the model's gig billable" do
      req = create(:faculty_request, user: faculty)
      gig = create(:gig, faculty_request: req)
      past = 2.days.ago.change(hour: 10)
      req.update_columns(starts_at: past, ends_at: past + 2.hours)
      gig.art_model_availability.update_columns(starts_at: past - 1.hour, ends_at: past + 7.hours)

      delete "/faculty_requests/#{req.id}", headers: auth_headers(faculty)

      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload).to be_confirmed
    end
  end
end
