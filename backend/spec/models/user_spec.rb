require "rails_helper"

RSpec.describe User, type: :model do
  it "has a valid faculty factory" do
    expect(build(:user)).to be_valid
  end

  it "has a valid model factory" do
    expect(build(:user, :model)).to be_valid
  end

  it "clears genitalia for models who won't pose nude" do
    user = create(:user, :model, genitalia: "Intersex")
    expect(user.genitalia).to be_nil
  end

  it "keeps genitalia for models who will pose nude" do
    user = create(:user, :model, :nude_ok, genitalia: "Intersex")
    expect(user.genitalia).to eq("Intersex")
  end
end