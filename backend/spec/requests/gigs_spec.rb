require "rails_helper"

RSpec.describe "Gigs API", type: :request do
  let(:admin) { create(:user, :admin) }

  describe "listing gigs" do
    let!(:my_gig)    { create(:gig) }
    let!(:other_gig) { create(:gig) }
    let(:model)      { my_gig.art_model_availability.user }

    it "shows a model only their own gigs" do
      get "/gigs", headers: auth_headers(model)
      ids = response.parsed_body.map { |g| g["id"] }
      expect(ids).to eq([my_gig.id])
    end

    it "shows an admin every gig" do
      get "/gigs", headers: auth_headers(admin)
      expect(response.parsed_body.size).to eq(2)
    end

    it "doesn't let faculty list gigs" do
      get "/gigs", headers: auth_headers(my_gig.faculty_request.user)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "booking a model" do
    let(:group_class) { create(:faculty_request, models_needed: 2) }

    def book(slot, as: admin)
      post "/gigs",
        params: { gig: { faculty_request_id: group_class.id, art_model_availability_id: slot.id } },
        headers: auth_headers(as), as: :json
    end

    it "keeps the class pending until it's fully staffed" do
      book(create(:art_model_availability))
      expect(response).to have_http_status(:created)
      expect(group_class.reload).to be_pending

      book(create(:art_model_availability))
      expect(group_class.reload).to be_matched
    end

    it "refuses a booking past the requested number of models" do
      2.times { book(create(:art_model_availability)) }
      book(create(:art_model_availability))
      expect(response).to have_http_status(:unprocessable_content)
      expect(group_class.confirmed_gigs.count).to eq(2)
    end

    it "records which admin made the booking" do
      book(create(:art_model_availability))
      expect(Gig.last.confirmed_by).to eq(admin)
    end

    it "doesn't let a model book themselves" do
      slot = create(:art_model_availability)
      book(slot, as: slot.user)
      expect(response).to have_http_status(:forbidden)
    end

    it "reuses the cancelled record when the same model is rebooked, so a same-day release isn't paid twice" do
      slot = create(:art_model_availability)
      book(slot)
      first = Gig.last
      first.update_columns(status: "cancelled", billable: true) # released on the day of class

      book(slot)

      expect(response).to have_http_status(:created)
      expect(Gig.where(faculty_request: group_class).count).to eq(1)
      expect(first.reload).to be_confirmed
      expect(first.billable).to be_nil
    end

    it "still checks the class has room when reusing a cancelled record" do
      slot = create(:art_model_availability)
      book(slot)
      Gig.last.update_columns(status: "cancelled")
      2.times { book(create(:art_model_availability)) } # class is full again

      book(slot)

      expect(response).to have_http_status(:unprocessable_content)
      expect(group_class.confirmed_gigs.count).to eq(2)
    end

    it "puts the model in the open slot they fit best" do
      group_class.request_series.model_slots.create!(position: 1, pref_body_type: "Fat")
      group_class.request_series.model_slots.create!(position: 2, pref_body_type: "Muscular")
      muscular_model = create(:user, :model, body_type: "Muscular")

      book(create(:art_model_availability, user: muscular_model))

      expect(response).to have_http_status(:created)
      expect(Gig.last.model_slot_position).to eq(2)
    end

    it "leaves the slot empty for classes without per-model preferences" do
      book(create(:art_model_availability))
      expect(Gig.last.model_slot_position).to be_nil
    end
  end

  describe "releasing a model" do
    let(:gig) { create(:gig) }

    it "frees the spot and reopens the class" do
      gig.faculty_request.refresh_match_status!
      delete "/gigs/#{gig.id}", headers: auth_headers(admin)

      expect(gig.reload).to be_cancelled
      expect(gig.faculty_request.reload).to be_pending
    end

    it "isn't billable when released ahead of time" do
      delete "/gigs/#{gig.id}", headers: auth_headers(admin)
      expect(gig.reload.billable).to be false
    end

    it "is billable when released on the day of the class" do
      # A class later today that hasn't started yet
      soon = Time.current + 5.minutes
      gig.faculty_request.update_columns(starts_at: soon, ends_at: soon + 1.hour)
      gig.art_model_availability.update_columns(starts_at: soon - 1.hour, ends_at: soon + 2.hours)

      delete "/gigs/#{gig.id}", headers: auth_headers(admin)
      expect(gig.reload.billable).to be true
    end
  end

  describe "releasing a model from a date that already happened" do
    it "refuses, and keeps the gig billable" do
      gig = create(:gig)
      past = 2.days.ago.change(hour: 10)
      gig.faculty_request.update_columns(starts_at: past, ends_at: past + 2.hours)
      gig.art_model_availability.update_columns(starts_at: past - 1.hour, ends_at: past + 7.hours)

      delete "/gigs/#{gig.id}", headers: auth_headers(admin)

      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload).to be_confirmed
    end
  end
end