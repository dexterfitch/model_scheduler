# Updates: what each person is told when their gigs or classes change, and reading them.

require "rails_helper"

RSpec.describe "Updates", type: :request do
  let(:admin)   { create(:user, :admin, first_name: "Dex") }
  let(:faculty) { create(:user, first_name: "Priya") }
  let(:model)   { create(:user, :model, first_name: "Jordan", last_name: "Ellis") }
  let(:series)  { create(:request_series, user: faculty, class_name: "Anatomy Lab") }
  let(:date)    { create(:faculty_request, user: faculty, request_series: series) }
  let(:slot)    { create(:art_model_availability, user: model) }

  # Books the model into the date, as an admin would.
  def book!(on: date, free: slot)
    post "/gigs", params: { gig: { faculty_request_id: on.id, art_model_availability_id: free.id } },
      headers: auth_headers(admin), as: :json
    expect(response).to have_http_status(:created)
    Gig.find(response.parsed_body["id"])
  end

  # The updates a person has, newest first, as the app shows them.
  def updates_for(user)
    get "/notifications", headers: auth_headers(user)
    response.parsed_body["notifications"]
  end

  describe "reading updates" do
    it "needs a sign-in" do
      get "/notifications"
      expect(response).to have_http_status(:unauthorized)
    end

    it "shows each person only their own, newest first, with how many are unread" do
      Notification.add!(user: model, kind: "booked", request: date)
      later = create(:faculty_request, user: faculty, request_series: create(:request_series, user: faculty, class_name: "Painting II"))
      Notification.add!(user: model, kind: "booked", request: later)
      Notification.add!(user: faculty, kind: "class_booked", request: date)

      get "/notifications", headers: auth_headers(model)
      expect(response.parsed_body["unread"]).to eq(2)
      expect(response.parsed_body["notifications"].map { |n| n["title"] }).to eq(["Painting II", "Anatomy Lab"])
    end

    it "marks them all read" do
      Notification.add!(user: model, kind: "booked", request: date)
      post "/notifications/read", headers: auth_headers(model)
      expect(response).to have_http_status(:no_content)
      get "/notifications", headers: auth_headers(model)
      expect(response.parsed_body["unread"]).to eq(0)
      expect(response.parsed_body["notifications"].first["read_at"]).to be_present
    end

    it "only marks the reader's own updates read" do
      Notification.add!(user: faculty, kind: "class_booked", request: date)
      post "/notifications/read", headers: auth_headers(model)
      expect(faculty.notifications.unread.count).to eq(1)
    end

    it "clears away read updates once they're half a year old" do
      old = Notification.add!(user: model, kind: "booked", request: date)
      old.update_columns(read_at: 200.days.ago, updated_at: 200.days.ago)
      updates_for(model)
      expect(Notification.exists?(old.id)).to be false
    end
  end

  describe "booking" do
    it "tells the model they're booked, and the faculty member that a model is booked" do
      book!
      expect(updates_for(model).map { |n| [n["kind"], n["title"]] }).to eq([["booked", "Anatomy Lab"]])
      expect(updates_for(faculty).map { |n| n["kind"] }).to eq(["class_booked"])
    end

    it "doesn't tell the admin who did the booking" do
      book!
      expect(updates_for(admin)).to be_empty
    end

    it "gathers bookings of several dates of one class into one update" do
      second = create(:faculty_request, user: faculty, request_series: series,
        starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
      book!
      book!(on: second, free: create(:art_model_availability, user: model,
        starts_at: 14.days.from_now.change(hour: 9), ends_at: 14.days.from_now.change(hour: 17)))

      updates = updates_for(model)
      expect(updates.length).to eq(1)
      expect(updates.first["dates"].length).to eq(2)
    end

    it "starts a new update once the earlier one has been read" do
      book!
      post "/notifications/read", headers: auth_headers(model)
      second = create(:faculty_request, user: faculty, request_series: series,
        starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
      book!(on: second, free: create(:art_model_availability, user: model,
        starts_at: 14.days.from_now.change(hour: 9), ends_at: 14.days.from_now.change(hour: 17)))
      expect(updates_for(model).length).to eq(2)
    end
  end

  describe "releasing and cancelling" do
    it "tells the model when an admin releases them" do
      gig = book!
      delete "/gigs/#{gig.id}", headers: auth_headers(admin)
      released = updates_for(model).find { |n| n["kind"] == "released" }
      expect(released).to include("title" => "Anatomy Lab", "paid" => false)
    end

    it "tells the models booked on a date the faculty member cancelled" do
      book!
      delete "/faculty_requests/#{date.id}", headers: auth_headers(faculty)
      expect(updates_for(model).map { |n| n["kind"] }).to include("date_cancelled")
      expect(updates_for(faculty).map { |n| n["kind"] }).not_to include("class_cancelled")
    end

    it "tells the faculty member when an admin cancels their class, and the booked models once per class" do
      second = create(:faculty_request, user: faculty, request_series: series,
        starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
      book!
      book!(on: second, free: create(:art_model_availability, user: model,
        starts_at: 14.days.from_now.change(hour: 9), ends_at: 14.days.from_now.change(hour: 17)))
      post "/notifications/read", headers: auth_headers(model)

      delete "/request_series/#{series.id}", headers: auth_headers(admin)

      cancelled = updates_for(model).select { |n| n["kind"] == "date_cancelled" }
      expect(cancelled.length).to eq(1)
      expect(cancelled.first["dates"].length).to eq(2)
      expect(updates_for(faculty).map { |n| n["kind"] }).to include("class_cancelled")
    end

    it "tells each model released from a class's remaining dates" do
      book!
      post "/request_series/#{series.id}/release_remaining", headers: auth_headers(admin)
      expect(updates_for(model).map { |n| n["kind"] }).to include("released")
    end

    it "tells the model when an admin cancels their gig from the model's calendar" do
      gig = book!
      post "/art_model_availabilities/#{slot.id}/cancel", params: { gig_id: gig.id }, headers: auth_headers(admin), as: :json
      expect(updates_for(model).map { |n| n["kind"] }).to include("released")
    end
  end

  describe "a model dropping out" do
    let!(:other_admin) { create(:user, :admin) }
    let!(:gig) { book! }

    before do
      post "/art_model_availabilities/#{slot.id}/cancel", params: { gig_id: gig.id }, headers: auth_headers(model), as: :json
    end

    it "tells every admin who dropped out of what" do
      dropped = updates_for(admin).find { |n| n["kind"] == "dropped_out" }
      expect(dropped).to include("title" => "Anatomy Lab", "about" => "Jordan Ellis")
      expect(other_admin.notifications.where(kind: "dropped_out").count).to eq(1)
    end

    it "tells the faculty member their model cancelled, without saying who" do
      update = updates_for(faculty).find { |n| n["kind"] == "model_cancelled" }
      expect(update).to be_present
      expect(update["about"]).to be_nil
    end

    it "doesn't tell the model about their own cancelling" do
      expect(updates_for(model).map { |n| n["kind"] }).not_to include("released", "dropped_out")
    end
  end

  describe "a booked date moving" do
    it "tells the booked model the new time" do
      book!
      new_start = 10.days.from_now.change(hour: 13)
      patch "/faculty_requests/#{date.id}",
        params: { faculty_request: { starts_at: new_start, ends_at: new_start + 2.hours } },
        headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:ok)

      moved = updates_for(model).find { |n| n["kind"] == "date_moved" }
      expect(Time.zone.parse(moved["dates"].first)).to eq(new_start)
    end
  end
end
