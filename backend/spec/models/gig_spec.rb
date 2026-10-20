require "rails_helper"

RSpec.describe Gig, type: :model do
  it "has a valid factory" do
    expect(create(:gig)).to be_persisted
  end

  it "won't book a model into two overlapping classes, even from different slots" do
    first = create(:gig)
    model = first.art_model_availability.user
    other_slot = create(:art_model_availability, user: model)
    overlapping_class = create(:faculty_request)

    second = build(:gig, faculty_request: overlapping_class, art_model_availability: other_slot)
    expect(second).not_to be_valid
    expect(second.errors.full_messages).to include("This model is already booked for another class during this time")
  end

  it "won't book more models than the class asked for" do
    full_class = create(:faculty_request, models_needed: 1)
    create(:gig, faculty_request: full_class)

    extra = build(:gig, faculty_request: full_class)
    expect(extra).not_to be_valid
    expect(extra.errors.full_messages).to include("This class already has all 1 model(s) it requested")
  end

  it "won't book the same model twice on one class" do
    group_class = create(:faculty_request, models_needed: 2)
    first = create(:gig, faculty_request: group_class)
    model = first.art_model_availability.user
    second_slot = create(:art_model_availability, user: model)

    repeat = build(:gig, faculty_request: group_class, art_model_availability: second_slot)
    expect(repeat).not_to be_valid
    expect(repeat.errors.full_messages).to include("This model is already booked for this class")
  end

  it "won't book a clothed-only model into a nude class" do
    nude_class = create(:faculty_request, :nude)
    gig = build(:gig, faculty_request: nude_class)
    expect(gig).not_to be_valid
    expect(gig.errors.full_messages).to include("This model is not willing to model nude, and the class requires a nude session")
  end
end