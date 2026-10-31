# Checks the seed file refuses to run on the live site.

require "rails_helper"

RSpec.describe "db/seeds.rb" do
  it "refuses to run in production, and leaves every record alone" do
    person = create(:user)
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production"))

    expect { load Rails.root.join("db/seeds.rb") }.to raise_error(/production/)
    expect(User.exists?(person.id)).to be true
  end
end
