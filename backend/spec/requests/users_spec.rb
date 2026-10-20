require "rails_helper"

RSpec.describe "User profile permissions", type: :request do
  let(:user)  { create(:user) }
  let(:admin) { create(:user, :admin) }

  def patch_user(as:, changes:)
    patch "/users/#{user.id}", params: { user: changes }, headers: auth_headers(as), as: :json
  end

  it "ignores a user's attempt to change their own email" do
    original = user.email
    patch_user(as: user, changes: { email: "someone.else@mica.edu" })
    expect(user.reload.email).to eq(original)
  end

  it "still saves the rest of a profile update" do
    patch_user(as: user, changes: { first_name: "Priya" })
    expect(user.reload.first_name).to eq("Priya")
  end

  it "lets an admin change a user's email" do
    patch_user(as: admin, changes: { email: "new.address@mica.edu" })
    expect(user.reload.email).to eq("new.address@mica.edu")
  end
end