# History: a record for admins of who changed what, when, and why, and cancelled
# dates kept so a cancelled class can still be seen.

require "rails_helper"

RSpec.describe "History", type: :request do
  let(:admin)     { create(:user, :admin, first_name: "Pat", last_name: "Reyes") }
  let(:superuser) { create(:user, :admin, superuser: true) }
  let(:faculty)   { create(:user, first_name: "Alice", last_name: "Chen") }
  let(:model)     { create(:user, :model, first_name: "Jordan", last_name: "Ellis") }
  let(:series)    { create(:request_series, user: faculty, class_name: "Anatomy Lab", room_number: "201") }
  let(:date)      { create(:faculty_request, user: faculty, request_series: series, class_name: "Anatomy Lab") }

  # The history as an admin sees it, newest first.
  def history(params = {})
    get "/history_entries", params: params, headers: auth_headers(admin)
    response.parsed_body
  end

  # Books the model into the date, as the admin.
  def book!
    post "/gigs", params: { gig: { faculty_request_id: date.id, art_model_availability_id: create(:art_model_availability, user: model).id } },
      headers: auth_headers(admin), as: :json
    Gig.find(response.parsed_body["id"])
  end

  describe "cancelling a class" do
    it "keeps the class and its dates, marked cancelled, for admins to find" do
      date
      delete "/request_series/#{series.id}", params: { note: "Faculty on leave" }, headers: auth_headers(admin), as: :json

      get "/request_series", headers: auth_headers(admin)
      listed = response.parsed_body.find { |s| s["id"] == series.id }
      expect(listed["status"]).to eq("archived")
      expect(listed["faculty_requests"].map { |r| r["status"] }).to eq(["archived"])
    end

    it "records who cancelled it, what, and the note they gave" do
      date
      delete "/request_series/#{series.id}", params: { note: "Faculty on leave" }, headers: auth_headers(admin), as: :json

      entry = history.first
      expect(entry["summary"]).to eq("Cancelled Anatomy Lab (1 date still to come).")
      expect(entry["note"]).to eq("Faculty on leave")
      expect(entry["user"]).to include("first_name" => "Pat", "last_name" => "Reyes")
    end

    it "records a date removed on its own, with its note" do
      delete "/faculty_requests/#{date.id}", params: { note: "Room double-booked" }, headers: auth_headers(admin), as: :json
      expect(history.first).to include("summary" => a_string_starting_with("Cancelled Anatomy Lab on "), "note" => "Room double-booked")
    end
  end

  describe "editing a class" do
    it "records which details changed, with the note" do
      patch "/request_series/#{series.id}", params: { request_series: { room_number: "305", notes: "Bring easels" }, note: "Moved rooms" },
        headers: auth_headers(admin), as: :json
      expect(history.first).to include("summary" => "Edited Anatomy Lab: room, notes.", "note" => "Moved rooms")
    end

    it "records nothing when nothing changed" do
      patch "/request_series/#{series.id}", params: { request_series: { room_number: "201" } }, headers: auth_headers(admin), as: :json
      expect(history).to be_empty
    end

    it "records a date moved, from and to" do
      new_start = 10.days.from_now.change(hour: 13)
      patch "/faculty_requests/#{date.id}", params: { faculty_request: { starts_at: new_start, ends_at: new_start + 2.hours }, note: "Faculty asked" },
        headers: auth_headers(admin), as: :json
      expect(history.first["summary"]).to match(/\AMoved Anatomy Lab from .+10:00 AM . 12:00 PM to .+1:00 PM . 3:00 PM\.\z/)
    end

    it "shows the end time too, so a change to only the end is clear" do
      patch "/faculty_requests/#{date.id}", params: { faculty_request: { ends_at: date.ends_at + 1.hour } },
        headers: auth_headers(admin), as: :json
      summary = history.first["summary"]
      expect(summary).to include("10:00 AM – 12:00 PM to ")
      expect(summary).to end_with("10:00 AM – 1:00 PM.")
    end

    it "shows the time span of a date added, booked or cancelled" do
      delete "/faculty_requests/#{date.id}", headers: auth_headers(admin), as: :json
      expect(history.first["summary"]).to end_with("10:00 AM – 12:00 PM.")
    end

    it "records a date added" do
      post "/faculty_requests", params: { faculty_request: { request_series_id: series.id, user_id: faculty.id, class_name: "Anatomy Lab",
        department: "Drawing", building: "Main", model_mode: "clothed", models_needed: 1,
        starts_at: 9.days.from_now.change(hour: 10), ends_at: 9.days.from_now.change(hour: 12) } },
        headers: auth_headers(admin), as: :json
      expect(history.first["summary"]).to start_with("Added a date to Anatomy Lab: ")
    end
  end

  describe "bookings and corrections" do
    it "records booking and releasing a model, with the release's note" do
      gig = book!
      delete "/gigs/#{gig.id}", params: { note: "Swapping for Riley" }, headers: auth_headers(admin), as: :json
      summaries = history.map { |e| e["summary"] }
      expect(summaries).to include(a_string_starting_with("Booked Jordan Ellis for Anatomy Lab on "))
      expect(history.first).to include("summary" => a_string_starting_with("Released Jordan Ellis from Anatomy Lab on "), "note" => "Swapping for Riley")
    end

    it "records a model cancelling their own gig, under their name" do
      gig = book!
      post "/art_model_availabilities/#{gig.art_model_availability_id}/cancel", params: { gig_id: gig.id }, headers: auth_headers(model), as: :json
      entry = history.first
      expect(entry["summary"]).to start_with("Cancelled their gig: Anatomy Lab on ")
      expect(entry["user"]).to include("first_name" => "Jordan")
    end

    it "records the people changes admins make" do
      post "/users/#{model.id}/retire", headers: auth_headers(admin)
      expect(history.first["summary"]).to eq("Retired Jordan Ellis.")
    end
  end

  describe "the list" do
    it "is for admins only" do
      get "/history_entries", headers: auth_headers(faculty)
      expect(response).to have_http_status(:forbidden)
    end

    it "finds entries by class, by who made them, and by note" do
      HistoryEntry.record!(actor: admin, action: "edited", summary: "Edited Anatomy Lab: room.", note: "Projector broken")
      HistoryEntry.record!(actor: faculty, action: "requested", summary: "Requested Painting II (2 dates).")
      expect(history(q: "anatomy").map { |e| e["summary"] }).to eq(["Edited Anatomy Lab: room."])
      expect(history(q: "Alice Chen").map { |e| e["summary"] }).to eq(["Requested Painting II (2 dates)."])
      expect(history(q: "projector").length).to eq(1)
    end

    it "pages through older entries" do
      entries = 3.times.map { |i| HistoryEntry.record!(actor: admin, action: "edited", summary: "Entry #{i}") }
      older = history(before_id: entries.last.id)
      expect(older.map { |e| e["id"] }).to eq([entries[1].id, entries[0].id])
    end

    it "keeps notes to a sensible length" do
      entry = HistoryEntry.record!(actor: admin, action: "edited", summary: "x", note: "n" * 2000)
      expect(entry.note.length).to be <= 500
    end
  end

  describe "removing a person's data" do
    it "takes their name out of History and of other people's Updates" do
      gig = book!
      post "/art_model_availabilities/#{gig.art_model_availability_id}/cancel", params: { gig_id: gig.id }, headers: auth_headers(model), as: :json
      post "/users/#{model.id}/remove_data", headers: auth_headers(superuser)

      expect(HistoryEntry.where("summary LIKE ?", "%Jordan Ellis%")).to be_empty
      expect(HistoryEntry.where("summary LIKE ?", "%Removed Person%")).to exist
      expect(Notification.where(about: "Jordan Ellis")).to be_empty
    end
  end
end
