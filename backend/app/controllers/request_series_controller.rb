class RequestSeriesController < ApplicationController
  before_action -> { require_role(:admin, :faculty) }, except: [:available_for_model]
  before_action -> { require_role(:admin, :model) }, only: [:available_for_model]

  def index
    @series = if current_user.role_admin?
      RequestSeries.all.includes(:user, faculty_requests: { gig: { art_model_availability: :user } })
    else
      RequestSeries.where(user_id: current_user.id).includes(:user, faculty_requests: { gig: { art_model_availability: :user } })
    end

    render json: @series, include: {
      user: {},
      faculty_requests: {
        include: {
          gig: current_user.role_admin? ? {
            include: { art_model_availability: { include: :user } }
          } : {
            only: [:id, :status]
          }
        }
      }
    }
  end

  def available_for_model
    series = RequestSeries.visible_to_model(current_user)
      .includes(faculty_requests: {})

    render json: series.as_json(
      only: [:id, :class_name, :department, :model_mode, :pref_skin_tone, :pref_gender, :room_number, :status],
      include: {
        faculty_requests: {
          only: [:id, :starts_at, :ends_at, :status]
        }
      }
    )
  end

  def create
    @series = RequestSeries.new(series_params)
    @series.user_id = current_user.id unless current_user.role_admin?
    @series.status = :pending

    dates = params[:dates]

    if dates.blank? || dates.empty?
      return render json: { error: "At least one date is required" }, status: :unprocessable_entity
    end

    ActiveRecord::Base.transaction do
      @series.save!

      dates.each do |date_entry|
        starts_at = ActiveSupport::TimeZone["Eastern Time (US & Canada)"].parse("#{date_entry[:date]}T#{date_entry[:start_time]}")
        ends_at = ActiveSupport::TimeZone["Eastern Time (US & Canada)"].parse("#{date_entry[:date]}T#{date_entry[:end_time]}")

        FacultyRequest.create!(
          request_series: @series,
          user: @series.user,
          class_name: @series.class_name,
          department: @series.department,
          building: @series.building,
          model_mode: @series.model_mode,
          pref_skin_tone: @series.pref_skin_tone,
          pref_gender: @series.pref_gender,
          notes: @series.notes,
          room_number: @series.room_number,
          starts_at: starts_at,
          ends_at: ends_at,
          status: :pending
        )
      end
    end

    render json: @series, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def destroy
    @series = RequestSeries.find(params[:id])

    unless current_user.role_admin? || @series.user_id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end

    @series.destroy
    head :no_content
  end

  private

  def series_params
    params.require(:request_series).permit(
      :user_id,
      :class_name,
      :department,
      :building,
      :model_mode,
      :pref_skin_tone,
      :pref_gender,
      :notes,
      :room_number
    )
  end
end