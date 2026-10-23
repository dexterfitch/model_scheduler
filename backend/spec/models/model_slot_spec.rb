require "rails_helper"

RSpec.describe ModelSlot, type: :model do
  let(:series) { create(:request_series, models_needed: 2) }

  it "scores a model by how many of the slot's preferences they match" do
    slot = series.model_slots.create!(position: 1, pref_skin_tone: "Dark", pref_gender: "Man", pref_body_type: "Muscular")
    model = build(:user, :model, skin_tone: "Dark", gender_identity: "Man", body_type: "Fat")
    expect(slot.match_score(model, nude: false)).to eq(2)
  end

  it "only counts genitalia for nude sessions" do
    nude_class = create(:request_series, models_needed: 2, model_mode: "nude")
    slot = nude_class.model_slots.create!(position: 1, pref_genitalia: "Intersex")
    model = build(:user, :model, willing_to_model_nude: true, genitalia: "Intersex")
    expect(slot.match_score(model, nude: true)).to eq(1)
    expect(slot.match_score(model, nude: false)).to eq(0)
  end

  it "rejects options that don't exist" do
    expect(series.model_slots.build(position: 1, pref_body_type: "Slim")).not_to be_valid
  end

  it "doesn't keep a genitalia preference for clothed classes" do
    slot = series.model_slots.create!(position: 1, pref_genitalia: "Intersex")
    expect(slot.pref_genitalia).to eq("Any")
  end
end