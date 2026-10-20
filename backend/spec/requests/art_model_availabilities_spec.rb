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
end