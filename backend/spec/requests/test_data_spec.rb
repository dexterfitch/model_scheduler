# Clearing a SuperUser's own test data, and nobody else's.

require "rails_helper"

RSpec.describe "Clearing a SuperUser's own test data", type: :request do
  let(:me)     { create(:user, :admin, superuser: true) }
  let(:admin)  { create(:user, :admin) }
  let(:alice)  { create(:user) }
  let(:jordan) { create(:user, :model) }

  let!(:my_class)   { create(:request_series, user: me) }
  let!(:my_date1)   { create(:faculty_request, user: me, request_series: my_class) }
  let!(:my_date2)   { create(:faculty_request, user: me, request_series: my_class, starts_at: 9.days.from_now.change(hour: 10)) }
  let!(:jordan_on_my_class) { create(:gig, faculty_request: my_date1, art_model_availability: create(:art_model_availability, user: jordan)) }

  let!(:my_free_time) { create(:art_model_availability, user: me, starts_at: 10.days.from_now.change(hour: 9)) }
  let!(:real_class)   { create(:faculty_request, user: alice) }
  let!(:me_on_real_class) do
    me.update_columns(role: User.roles[:model], gender_identity: "Woman", skin_tone: "Medium")
    gig = create(:gig, faculty_request: real_class, art_model_availability: create(:art_model_availability, user: me))
    real_class.refresh_match_status!
    me.update_columns(role: User.roles[:admin])
    gig
  end

  let!(:alices_class) { create(:faculty_request, user: alice, starts_at: 11.days.from_now.change(hour: 10)) }
  let!(:jordans_time) { create(:art_model_availability, user: jordan, starts_at: 12.days.from_now.change(hour: 9)) }

  it "is only for SuperUsers" do
    get "/test_data", headers: auth_headers(admin)
    expect(response).to have_http_status(:forbidden)
    delete "/test_data", headers: auth_headers(admin)
    expect(response).to have_http_status(:forbidden)
    expect(RequestSeries.exists?(my_class.id)).to be true
  end

  it "counts what would be cleared, so the confirmation can say" do
    get "/test_data", headers: auth_headers(me)
    expect(response.parsed_body).to include(
      "classes" => 1, "dates" => 2, "availability" => 2, "real_classes_booked" => 1
    )
  end

  it "clears my classes, my availability and their bookings" do
    delete "/test_data", headers: auth_headers(me)
    expect(response).to have_http_status(:ok)

    expect(RequestSeries.exists?(my_class.id)).to be false
    expect(FacultyRequest.where(id: [my_date1.id, my_date2.id])).to be_empty
    expect(ArtModelAvailability.where(user: me)).to be_empty
    expect(Gig.where(id: [jordan_on_my_class.id, me_on_real_class.id])).to be_empty
  end

  it "leaves everyone else's classes and availability alone" do
    delete "/test_data", headers: auth_headers(me)
    expect(FacultyRequest.exists?(alices_class.id)).to be true
    expect(FacultyRequest.exists?(real_class.id)).to be true
    expect(ArtModelAvailability.exists?(jordans_time.id)).to be true
    expect(User.exists?(me.id)).to be true
  end

  it "reopens a real class I was booked into as a model" do
    expect(real_class.reload).to be_matched
    delete "/test_data", headers: auth_headers(me)
    expect(real_class.reload).to be_pending
  end

  it "also removes corrections made on the gigs it clears" do
    jordan_on_my_class.gig_corrections.create!(user: me, kind: "no_show", summary: "Test")
    delete "/test_data", headers: auth_headers(me)
    expect(GigCorrection.count).to eq(0)
  end

  it "does nothing harmful when there's nothing to clear" do
    other_superuser = create(:user, :admin, superuser: true)
    delete "/test_data", headers: auth_headers(other_superuser)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["classes"]).to eq(0)
    expect(RequestSeries.exists?(my_class.id)).to be true
  end
end
