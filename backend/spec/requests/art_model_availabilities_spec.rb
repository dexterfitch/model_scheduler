# Free time: who can see and change it, cancelling gigs, and joining overlapping time.

require "rails_helper"

RSpec.describe "Availability permissions", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:model)       { create(:user, :model) }
  let(:other_model) { create(:user, :model) }
  let(:admin)       { create(:user, :admin) }
  let(:slot)        { create(:art_model_availability, user: model) }

  # Changes the model's block of free time, as the given user.
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

    # Cancels the booked gig in the block, as the given user.
    def cancel(as:, **extra)
      post "/art_model_availabilities/#{slot.id}/cancel",
        params: { gig_id: gig.id, **extra }, headers: auth_headers(as), as: :json
    end

    it "flags the class for admin attention when a model drops out" do
      cancel(as: model)
      expect(gig.reload).to be_cancelled
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
      expect(later_gig.reload).to be_cancelled
    end
  end

  describe "editing slots" do
    it "lets a model change the hours of a free slot" do
      patch_slot(as: model, changes: { ends_at: slot.starts_at + 4.hours })
      expect(response).to have_http_status(:ok)
      expect(slot.reload.ends_at).to eq(slot.starts_at + 4.hours)
    end

    it "won't move free time so it starts in the past" do
      patch_slot(as: model, changes: { starts_at: 2.days.ago.change(hour: 9), ends_at: 2.days.ago.change(hour: 12) })
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].join).to include("past")
      expect(slot.reload.starts_at).to be > Time.current
    end

    it "still lets a model shorten free time that's already under way" do
      travel_to Time.current.change(hour: 12) do
        started = Time.current.change(hour: 10)
        slot.update_columns(starts_at: started, ends_at: started + 6.hours)
        patch_slot(as: model, changes: { ends_at: started + 4.hours })
        expect(response).to have_http_status(:ok)
        expect(slot.reload.ends_at).to eq(started + 4.hours)
      end
    end

    it "locks a slot once a gig is booked on it" do
      create(:gig, art_model_availability: slot)
      patch_slot(as: model, changes: { ends_at: slot.starts_at + 4.hours })
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "cancelling a gig that already happened" do
    it "refuses, and keeps the gig on record for billing" do
      gig = create(:gig, art_model_availability: slot)
      past = 2.days.ago.change(hour: 10)
      gig.faculty_request.update_columns(starts_at: past, ends_at: past + 2.hours)
      slot.update_columns(starts_at: past - 1.hour, ends_at: past + 7.hours)

      post "/art_model_availabilities/#{slot.id}/cancel",
        params: { gig_id: gig.id }, headers: auth_headers(model), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(gig.reload).to be_confirmed
    end
  end

  describe "deleting a free slot that has a cancelled gig in its history" do
    it "removes it from the model's availability instead of crashing" do
      gig = create(:gig, art_model_availability: slot)
      gig.update_columns(status: Gig.statuses[:cancelled], billable: false)

      delete "/art_model_availabilities/#{slot.id}", headers: auth_headers(model)

      expect(response).to have_http_status(:no_content)
      expect(slot.reload).to be_cancelled
      expect(gig.reload).to be_cancelled
    end
  end

  describe "joining time that overlaps" do
    let(:day) { 8.days.from_now }

    # Adds free time on the test day between the given hours, as the given user (for another model,
    # if given).
    def add_slot(as:, start_hour:, end_hour:, for_user: nil)
      fields = { starts_at: day.change(hour: start_hour), ends_at: day.change(hour: end_hour) }
      fields[:user_id] = for_user.id if for_user
      post "/art_model_availabilities", params: { art_model_availability: fields }, headers: auth_headers(as), as: :json
    end

    # A model's active blocks of free time, as [start hour, end hour] pairs in order.
    def blocks_for(user)
      ArtModelAvailability.active.where(user: user).order(:starts_at).map do |b|
        [b.starts_at.hour, b.ends_at.hour]
      end
    end

    it "stretches the model's free time to cover both, instead of adding a second block" do
      add_slot(as: model, start_hour: 9, end_hour: 15)
      add_slot(as: model, start_hour: 14, end_hour: 18)
      expect(response).to have_http_status(:created)
      expect(blocks_for(model)).to eq([[9, 18]])
      expect(response.parsed_body["joined"]).to be true
      expect(response.parsed_body["starts_at"]).to eq(day.change(hour: 9).as_json)
    end

    it "doesn't add the same time twice" do
      add_slot(as: model, start_hour: 9, end_hour: 17)
      add_slot(as: model, start_hour: 9, end_hour: 17)
      expect(response).to have_http_status(:created)
      expect(blocks_for(model)).to eq([[9, 17]])
    end

    it "joins blocks that meet end to end" do
      add_slot(as: model, start_hour: 12, end_hour: 15)
      add_slot(as: model, start_hour: 15, end_hour: 17)
      expect(blocks_for(model)).to eq([[12, 17]])
    end

    it "joins every block the new time touches" do
      add_slot(as: model, start_hour: 9, end_hour: 11)
      add_slot(as: model, start_hour: 13, end_hour: 15)
      add_slot(as: model, start_hour: 10, end_hour: 14)
      expect(blocks_for(model)).to eq([[9, 15]])
    end

    it "keeps separate blocks separate when they don't meet" do
      add_slot(as: model, start_hour: 9, end_hour: 11)
      add_slot(as: model, start_hour: 13, end_hour: 15)
      expect(response.parsed_body["joined"]).to be false
      expect(blocks_for(model)).to eq([[9, 11], [13, 15]])
    end

    it "leaves a block with a booked gig alone" do
      booked = create(:art_model_availability, user: model, starts_at: day.change(hour: 9), ends_at: day.change(hour: 12))
      create(:gig, art_model_availability: booked,
        faculty_request: create(:faculty_request, starts_at: day.change(hour: 9), ends_at: day.change(hour: 12)))

      add_slot(as: model, start_hour: 11, end_hour: 16)
      expect(response).to have_http_status(:created)
      expect(booked.reload.ends_at.hour).to eq(12)
      expect(blocks_for(model)).to eq([[9, 12], [11, 16]])
    end

    it "adds nothing when the time is already inside one block" do
      add_slot(as: model, start_hour: 9, end_hour: 17)
      add_slot(as: model, start_hour: 10, end_hour: 12)
      expect(blocks_for(model)).to eq([[9, 17]])
      expect(response.parsed_body["joined"]).to be true
    end

    it "doesn't join a cancelled block" do
      old = create(:art_model_availability, user: model, starts_at: day.change(hour: 9), ends_at: day.change(hour: 12))
      old.update_columns(status: ArtModelAvailability.statuses[:cancelled])
      add_slot(as: model, start_hour: 10, end_hour: 14)
      expect(blocks_for(model)).to eq([[10, 14]])
    end

    it "never joins two different models' time" do
      add_slot(as: model, start_hour: 9, end_hour: 15)
      add_slot(as: other_model, start_hour: 14, end_hour: 18)
      expect(blocks_for(model)).to eq([[9, 15]])
      expect(blocks_for(other_model)).to eq([[14, 18]])
    end

    it "joins time an admin adds for a model too" do
      add_slot(as: model, start_hour: 9, end_hour: 12)
      add_slot(as: admin, for_user: model, start_hour: 11, end_hour: 14)
      expect(blocks_for(model)).to eq([[9, 14]])
    end

    it "joins blocks when a block is stretched over another, keeping its gig history" do
      morning = create(:art_model_availability, user: model, starts_at: day.change(hour: 9), ends_at: day.change(hour: 11))
      evening = create(:art_model_availability, user: model, starts_at: day.change(hour: 15), ends_at: day.change(hour: 18))
      history = create(:gig, art_model_availability: evening,
        faculty_request: create(:faculty_request, starts_at: day.change(hour: 15), ends_at: day.change(hour: 17)))
      history.update_columns(status: Gig.statuses[:cancelled])

      patch "/art_model_availabilities/#{morning.id}",
        params: { art_model_availability: { ends_at: day.change(hour: 16) } }, headers: auth_headers(model), as: :json
      expect(response).to have_http_status(:ok)
      expect(blocks_for(model)).to eq([[9, 18]])
      expect(history.reload.art_model_availability_id).to eq(morning.id)
    end

    it "lets a block's own hours change without joining itself" do
      patch_slot(as: model, changes: { starts_at: slot.starts_at + 1.hour })
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["joined"]).to be false
    end
  end
end
