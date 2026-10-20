require "rails_helper"

RSpec.describe "Availability permissions", type: :request do
  let(:model)       { create(:user, :model) }
  let(:other_model) { create(:user, :model) }
  let(:admin)       { create(:user, :admin) }
  let(:slot)        { create(:art_model_availability, user: model) }

  def patch_slot(as:, changes:)
    patch "/art_model_availabilities/#{slot.id}",
      params: { art_model_availability: changes }, headers: auth_headers(as), as: :json
  end

  it "ignores a model's attempt to hand their slot to someone else" do
    patch_slot(as: model, changes: { user_id: other_model.id })
    expect(slot.reload.user_id).to eq(model.id)
  end

  it "lets an admin reassign a slot" do
    patch_slot(as: admin, changes: { user_id: other_model.id })
    expect(slot.reload.user_id).to eq(other_model.id)
  end

  describe "managing slots" do
    it "shows a model only their own slots" do
      slot
      create(:art_model_availability, user: other_model)
      get "/art_model_availabilities", headers: auth_headers(model)
      expect(response.parsed_body.map { |s| s["user_id"] }.uniq).to eq([model.id])
    end

    it "always creates a model's new slot under their own account" do
      post "/art_model_availabilities",
        params: { art_model_availability: { user_id: other_model.id, starts_at: 8.days.from_now.change(hour: 9), ends_at: 8.days.from_now.change(hour: 12) } },
        headers: auth_headers(model), as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["user_id"]).to eq(model.id)
    end

    it "won't let another model delete your slot" do
      delete "/art_model_availabilities/#{slot.id}", headers: auth_headers(other_model)
      expect(response).to have_http_status(:forbidden)
      expect(ArtModelAvailability.exists?(slot.id)).to be true
    end

    it "won't delete a slot that has a booked gig" do
      create(:gig, art_model_availability: slot)
      delete "/art_model_availabilities/#{slot.id}", headers: auth_headers(model)
      expect(ArtModelAvailability.exists?(slot.id)).to be true
    end

    it "deletes a free slot" do
      delete "/art_model_availabilities/#{slot.id}", headers: auth_headers(model)
      expect(ArtModelAvailability.exists?(slot.id)).to be false
    end
  end

  describe "cancelling a gig" do
    let(:booked_class) { create(:faculty_request) }
    let!(:gig) { create(:gig, faculty_request: booked_class, art_model_availability: slot) }

    def cancel(as:, **extra)
      post "/art_model_availabilities/#{slot.id}/cancel",
        params: { gig_id: gig.id, **extra }, headers: auth_headers(as), as: :json
    end

    it "flags the class for admin attention when a model drops out" do
      cancel(as: model)
      expect(Gig.exists?(gig.id)).to be false
      expect(booked_class.reload.needs_attention).to be true
    end

    it "doesn't flag the class when an admin cancels" do
      cancel(as: admin)
      expect(booked_class.reload.needs_attention).to be false
    end

    it "won't let another model cancel your gig" do
      cancel(as: other_model)
      expect(response).to have_http_status(:forbidden)
      expect(Gig.exists?(gig.id)).to be true
    end

    it "can also drop the model from the rest of a series" do
      series = create(:request_series)
      booked_class.update!(request_series: series)
      later_class = create(:faculty_request, request_series: series,
        starts_at: 14.days.from_now.change(hour: 10), ends_at: 14.days.from_now.change(hour: 12))
      later_slot = create(:art_model_availability, user: model,
        starts_at: 14.days.from_now.change(hour: 9), ends_at: 14.days.from_now.change(hour: 17))
      later_gig = create(:gig, faculty_request: later_class, art_model_availability: later_slot)

      cancel(as: model, cancel_remaining_series: true)
      expect(Gig.exists?(later_gig.id)).to be false
    end
  end
end