# The Error Log: unexpected errors on the server or in someone's browser are kept for
# SuperUsers to see, and a new kind of error tells them in Updates.

require "rails_helper"

RSpec.describe "Error Log", type: :request do
  let(:admin)     { create(:user, :admin) }
  let(:superuser) { create(:user, :admin, superuser: true) }
  let(:model)     { create(:user, :model) }

  # Makes the gig list fail with this message, then asks for it as the admin.
  def break_gig_list(message = "boom")
    allow_any_instance_of(GigsController).to receive(:index).and_raise(RuntimeError, message)
    begin
      get "/gigs", headers: auth_headers(admin)
    rescue RuntimeError
      nil
    end
  end

  describe "server errors" do
    it "keeps what went wrong, where, and for whom, without the request's details" do
      break_gig_list("undefined method 'name' for nil")
      report = ErrorReport.last
      expect(report).to have_attributes(source: "server", path: "/gigs", user_id: admin.id, count: 1)
      expect(report.message).to include("RuntimeError: undefined method 'name' for nil")
    end

    it "counts the same error again instead of adding another" do
      break_gig_list
      break_gig_list
      expect(ErrorReport.count).to eq(1)
      expect(ErrorReport.last.count).to eq(2)
    end

    it "doesn't keep ordinary not-found answers" do
      delete "/gigs/0", headers: auth_headers(admin)
      expect(ErrorReport.count).to eq(0)
    end

    it "tells SuperUsers about a new kind of error in Updates, once" do
      superuser
      break_gig_list
      break_gig_list
      expect(superuser.notifications.where(kind: "error").count).to eq(1)
      expect(admin.notifications.where(kind: "error")).to be_empty
    end
  end

  describe "browser errors" do
    it "keeps an error a signed-in person's browser reports" do
      post "/error_reports", params: { message: "TypeError: x is undefined", details: "at AllGigs.jsx:12", path: "/gigs" },
        headers: auth_headers(model), as: :json
      expect(response).to have_http_status(:no_content)
      expect(ErrorReport.last).to have_attributes(source: "browser", path: "/gigs", user_id: model.id)
    end

    it "needs a sign-in" do
      post "/error_reports", params: { message: "x" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "stops keeping one person's reports after 20 in an hour" do
      25.times do |i|
        post "/error_reports", params: { message: "Error #{i}", path: "/" }, headers: auth_headers(model), as: :json
      end
      expect(ErrorReport.where(user: model).sum(:count)).to eq(20)
    end

    it "shortens very long messages" do
      post "/error_reports", params: { message: "x" * 5000, details: "y" * 20_000 }, headers: auth_headers(model), as: :json
      expect(ErrorReport.last.message.length).to be <= 500
      expect(ErrorReport.last.details.length).to be <= 4000
    end
  end

  describe "the log" do
    it "is for SuperUsers only, newest first" do
      ErrorReport.record!(source: "browser", message: "older", path: "/")
      ErrorReport.record!(source: "browser", message: "newer", path: "/")

      get "/error_reports", headers: auth_headers(admin)
      expect(response).to have_http_status(:forbidden)

      get "/error_reports", headers: auth_headers(superuser)
      expect(response.parsed_body.map { |r| r["message"] }).to eq(["newer", "older"])
    end

    it "can be cleared" do
      ErrorReport.record!(source: "browser", message: "x", path: "/")
      delete "/error_reports", headers: auth_headers(superuser)
      expect(ErrorReport.count).to eq(0)
    end
  end
end
