require "rails_helper"

RSpec.describe "Request series permissions", type: :request do
  let(:faculty) { create(:user) }
  let(:admin)   { create(:user, :admin) }
  let(:series)  { create(:request_series, user: faculty) }
  let!(:booked_date) do
    request = create(:faculty_request, user: faculty, request_series: series)
    create(:gig, faculty_request: request)
    request.refresh_match_status!
    request
  end

  def patch_series(as:, changes:)
    patch "/request_series/#{series.id}",
      params: { request_series: changes }, headers: auth_headers(as), as: :json
  end

  it "blocks faculty from editing a series with a booked model" do
    patch_series(as: faculty, changes: { notes: "changed" })
    expect(response).to have_http_status(:forbidden)
    expect(series.reload.notes).not_to eq("changed")
  end

  it "lets an admin edit it" do
    patch_series(as: admin, changes: { notes: "changed" })
    expect(response).to have_http_status(:ok)
    expect(series.reload.notes).to eq("changed")
  end

  it "blocks switching to nude while a clothed-only model is booked, even for admins" do
    patch_series(as: admin, changes: { model_mode: "nude" })
    expect(response).to have_http_status(:unprocessable_content)
    expect(series.reload.model_mode).to eq("clothed")
  end
end