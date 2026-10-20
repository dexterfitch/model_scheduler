require "rails_helper"

RSpec.describe ArtModelAvailability, type: :model do
  # One all-day slot holding two non-overlapping classes
  let(:day)       { 7.days.from_now.to_date }
  let(:slot)      { create(:art_model_availability, starts_at: day.in_time_zone.change(hour: 8), ends_at: day.in_time_zone.change(hour: 22)) }
  let(:morning)   { create(:faculty_request, starts_at: day.in_time_zone.change(hour: 10), ends_at: day.in_time_zone.change(hour: 12)) }
  let(:afternoon) { create(:faculty_request, starts_at: day.in_time_zone.change(hour: 14), ends_at: day.in_time_zone.change(hour: 16)) }
  let!(:morning_gig)   { create(:gig, faculty_request: morning, art_model_availability: slot) }
  let!(:afternoon_gig) { create(:gig, faculty_request: afternoon, art_model_availability: slot) }

  it "cancels the gig the model chose, not the first one on the slot" do
    slot.reload.cancel_with_gig!(gig_id: afternoon_gig.id)
    expect(Gig.exists?(afternoon_gig.id)).to be false
    expect(Gig.exists?(morning_gig.id)).to be true
  end

  it "keeps the slot active while another class still uses it" do
    slot.reload.cancel_with_gig!(gig_id: afternoon_gig.id)
    expect(slot.reload).to be_active
  end

  it "gives a rescheduled class its own slot when the slot is shared" do
    morning.update!(starts_at: morning.starts_at + 1.day, ends_at: morning.ends_at + 1.day)
    expect(morning_gig.reload.art_model_availability_id).not_to eq(slot.id)
    expect(afternoon_gig.reload).to be_valid
  end
end