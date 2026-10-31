# Cancelling a whole class: dates still to come are cancelled, dates already worked stay booked.

require "rails_helper"

RSpec.describe RequestSeries, type: :model do
  describe "#cancel_entire_series!" do
    let(:series) { create(:request_series) }

    let!(:past_gig) do
      req = create(:faculty_request, request_series: series)
      gig = create(:gig, faculty_request: req)
      past = 3.days.ago.change(hour: 10)
      req.update_columns(starts_at: past, ends_at: past + 2.hours, status: FacultyRequest.statuses[:matched])
      gig.art_model_availability.update_columns(starts_at: past - 1.hour, ends_at: past + 7.hours)
      gig
    end

    let!(:future_gig) do
      req = create(:faculty_request, request_series: series,
        starts_at: 10.days.from_now.change(hour: 10), ends_at: 10.days.from_now.change(hour: 12))
      slot = create(:art_model_availability,
        starts_at: 10.days.from_now.change(hour: 9), ends_at: 10.days.from_now.change(hour: 17))
      create(:gig, faculty_request: req, art_model_availability: slot)
    end

    it "cancels the dates still to come" do
      series.cancel_entire_series!
      expect(future_gig.reload).to be_cancelled
    end

    it "leaves sessions that already happened booked, so the model is still paid" do
      series.cancel_entire_series!
      expect(past_gig.reload).to be_confirmed
      expect(past_gig.faculty_request.reload).not_to be_archived
    end
  end
end
