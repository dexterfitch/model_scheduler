# One-time announcements in the Updates list.

require "rails_helper"

RSpec.describe Notification do
  describe ".announce_profile_review!" do
    let!(:model)   { create(:user, :model, first_name: "Jordan") }
    let!(:retired) { create(:user, :model, first_name: "Sam").tap { |u| u.update_columns(retired_at: 1.day.ago) } }
    let!(:removed) { create(:user, :model, first_name: "Riley").tap { |u| u.update_columns(removed_at: 1.day.ago) } }
    let!(:faculty) { create(:user, first_name: "Priya") }

    it "tells each current model, unread, to review their profile" do
      expect(Notification.announce_profile_review!).to eq(1)
      update = Notification.find_by!(user: model)
      expect(update.kind).to eq("profile_review")
      expect(update.read_at).to be_nil
    end

    it "leaves out retired models, people whose data was removed, and anyone who isn't a model" do
      Notification.announce_profile_review!
      expect(Notification.where(user: [retired, removed, faculty])).to be_empty
    end

    it "tells each model only once, however many times it's run" do
      Notification.announce_profile_review!
      expect(Notification.announce_profile_review!).to eq(0)
      expect(Notification.where(user: model).count).to eq(1)
    end

    it "is kept in History under the SuperUser, which is how it knows it was sent" do
      dex = create(:user, :admin, first_name: "Dex", superuser: true)
      Notification.announce_profile_review!
      entry = HistoryEntry.find_by!(action: "announced_profile_review")
      expect(entry.user).to eq(dex)
      expect(entry.summary).to eq("Asked 1 model to review their profile, since profile options have expanded.")
    end

    it "doesn't tell a model again after they've cleared it" do
      Notification.announce_profile_review!
      Notification.where(user: model).delete_all
      expect(Notification.announce_profile_review!).to eq(0)
    end
  end
end
