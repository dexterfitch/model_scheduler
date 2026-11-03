# Lets a SuperUser clear the classes and availability they made while trying the
# app as Faculty or Model under their own account. Only records owned by that
# SuperUser are removed; nobody else's records or accounts change.
class TestDataController < ApplicationController
  before_action :require_superuser

  # How much would be cleared, for the confirmation window.
  def show
    render json: counts
  end

  # Deletes the SuperUser's classes, dates, free time and their bookings and
  # corrections, then reopens any real class they were booked into as a model.
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

      FacultyRequest.where(id: reopened_ids).find_each do |request|
        request.refresh_match_status!
        request.request_series&.update_status!
      end
    end
    record_history("cleared_test_data", "Cleared their test data: #{HistoryEntry.count_of(cleared[:classes], 'class')}, " \
      "#{HistoryEntry.count_of(cleared[:availability], 'block')} of free time.")
    render json: cleared
  end

  private

  # Only SuperUsers may use this.
  def require_superuser
    raise NotAuthorizedError unless current_user&.superuser?
  end

  # Classes the SuperUser requested.
  def my_series
    RequestSeries.where(user_id: current_user.id)
  end

  # Dates the SuperUser requested, alone or as part of their classes.
  def my_requests
    FacultyRequest.where(user_id: current_user.id).or(FacultyRequest.where(request_series_id: my_series.select(:id)))
  end

  # Free time the SuperUser added.
  def my_availability
    ArtModelAvailability.where(user_id: current_user.id)
  end

  # Bookings of the SuperUser (as a model) into classes someone else requested.
  def real_classes_booked
    Gig.confirmed
       .where(art_model_availability_id: my_availability.select(:id))
       .where.not(faculty_request_id: my_requests.select(:id))
  end

  # Numbers of classes, dates, blocks of free time and real classes booked.
  def counts
    {
      classes: my_series.count,
      dates: my_requests.count,
      availability: my_availability.count,
      real_classes_booked: real_classes_booked.distinct.count(:faculty_request_id)
    }
  end
end
