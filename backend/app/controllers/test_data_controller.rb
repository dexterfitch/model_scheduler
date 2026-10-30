# Lets a SuperUser clear the classes and availability they made while trying the
# app as Faculty or Model under their own account. Only records owned by that
# SuperUser are removed; nobody else's classes, availability or account changes.
class TestDataController < ApplicationController
  before_action :require_superuser

  # How much would be cleared, for the confirmation window
  def show
    render json: counts
  end

  def destroy
    cleared = counts
    ActiveRecord::Base.transaction do
      series_ids = my_series.pluck(:id)
      request_ids = my_requests.pluck(:id)
      slot_ids = my_availability.pluck(:id)
      reopened_ids = real_classes_booked.pluck(:faculty_request_id).uniq

      gig_ids = Gig.where(faculty_request_id: request_ids)
                   .or(Gig.where(art_model_availability_id: slot_ids)).pluck(:id)
      GigCorrection.where(gig_id: gig_ids).delete_all
      Gig.where(id: gig_ids).delete_all
      FacultyRequest.where(id: request_ids).delete_all
      ModelSlot.where(request_series_id: series_ids).delete_all
      RequestSeries.where(id: series_ids).delete_all
      ArtModelAvailability.where(id: slot_ids).delete_all

      # Real classes the SuperUser was booked into go back to needing a model
      FacultyRequest.where(id: reopened_ids).find_each do |request|
        request.refresh_match_status!
        request.request_series&.update_status!
      end
    end
    render json: cleared
  end

  private

  def require_superuser
    raise NotAuthorizedError unless current_user&.superuser?
  end

  def my_series
    RequestSeries.where(user_id: current_user.id)
  end

  def my_requests
    FacultyRequest.where(user_id: current_user.id).or(FacultyRequest.where(request_series_id: my_series.select(:id)))
  end

  def my_availability
    ArtModelAvailability.where(user_id: current_user.id)
  end

  # Confirmed bookings of the SuperUser (as a model) into classes someone else asked for
  def real_classes_booked
    Gig.confirmed
       .where(art_model_availability_id: my_availability.select(:id))
       .where.not(faculty_request_id: my_requests.select(:id))
  end

  def counts
    {
      classes: my_series.count,
      dates: my_requests.count,
      availability: my_availability.count,
      real_classes_booked: real_classes_booked.distinct.count(:faculty_request_id)
    }
  end
end
