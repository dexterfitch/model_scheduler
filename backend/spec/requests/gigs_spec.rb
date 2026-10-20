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
      today = Time.zone.today
      gig.faculty_request.update_columns(starts_at: today.in_time_zone.change(hour: 10), ends_at: today.in_time_zone.change(hour: 12))
      gig.art_model_availability.update_columns(starts_at: today.in_time_zone.change(hour: 9), ends_at: today.in_time_zone.change(hour: 17))

      delete "/gigs/#{gig.id}", headers: auth_headers(admin)
      expect(gig.reload.billable).to be true
    end
  end
end