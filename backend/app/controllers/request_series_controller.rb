class RequestSeriesController < ApplicationController
  MAX_DATES_PER_SERIES = 50
  before_action -> { require_role(:admin, :faculty) }, except: [:available_for_model]
  before_action -> { require_role(:admin, :model) }, only: [:available_for_model]
  before_action -> { require_role(:admin) }, only: [:release_remaining]

  def index
    preload = { faculty_requests: { confirmed_gigs: [:confirmed_by, { art_model_availability: :user }] } }
    @series = if current_user.role_admin?
      RequestSeries.all.includes(:user, preload)
    else
      RequestSeries.where(user_id: current_user.id).includes(:user, preload)
    end

    render json: @series, include: {
      user: {},
      faculty_requests: {
        include: {
          confirmed_gigs: current_user.role_admin? ? {
            include: { art_model_availability: { include: :user } }
          } : {
            only: [:id, :status],
            include: {
              confirmed_by: { only: [:id, :first_name, :last_name, :email] }
            }
          }
        }
      }
    }
  end

  def available_for_model
    series_list = RequestSeries.visible_to_model(current_user)
      .includes(faculty_requests: { confirmed_gigs: :art_model_availability })

    payload = series_list.filter_map do |series|
      # Hide dates this model is already booked on (multi-model sessions stay
      # "pending" until every slot is filled)
      open_requests = series.faculty_requests.select do |req|
        req.pending? && req.confirmed_gigs.none? { |g| g.art_model_availability.user_id == current_user.id }
      end
      next if open_requests.empty?

      series.as_json(
        only: [:id, :class_name, :department, :model_mode, :pref_skin_tone, :pref_gender, :room_number, :status, :models_needed]
      ).merge(
        "faculty_requests" => open_requests.map do |req|
          req.as_json(only: [:id, :starts_at, :ends_at, :status, :models_needed])
            .merge("open_slots" => [req.models_needed - req.confirmed_gigs.size, 0].max)
        end
      )
    end

    render json: payload
  end

  def create
    @series = RequestSeries.new(series_params)
    @series.user_id = current_user.id unless current_user.role_admin?
    @series.status = :pending

    dates = params[:dates]

    unless dates.is_a?(Array) && dates.any?
      return render json: { error: "At least one date is required" }, status: :unprocessable_entity
    end

    if dates.length > MAX_DATES_PER_SERIES
      return render json: { error: "A request can have at most #{MAX_DATES_PER_SERIES} dates" }, status: :unprocessable_entity
    end

    # Parse every date up front so one bad entry gives a clear error instead of a crash
    eastern = ActiveSupport::TimeZone["Eastern Time (US & Canada)"]
    times = dates.each_with_index.map do |entry, i|
      entry = entry.permit(:date, :start_time, :end_time) if entry.respond_to?(:permit)
      starts_at = ends_at = nil
      if entry.respond_to?(:[]) && !entry.is_a?(String)
        starts_at = eastern.parse("#{entry[:date]}T#{entry[:start_time]}") rescue nil
        ends_at   = eastern.parse("#{entry[:date]}T#{entry[:end_time]}") rescue nil
      end
      unless starts_at && ends_at
        return render json: { error: "Date ##{i + 1} has an invalid date or time" }, status: :unprocessable_entity
      end
      [starts_at, ends_at]
    end

    failure = nil

    ActiveRecord::Base.transaction do
      @series.save!

      times.each_with_index do |(starts_at, ends_at), i|
        faculty_request = FacultyRequest.new(
          request_series: @series,
          user: @series.user,
          class_name: @series.class_name,
          department: @series.department,
          building: @series.building,
          model_mode: @series.model_mode,
          pref_skin_tone: @series.pref_skin_tone,
          pref_gender: @series.pref_gender,
          pref_body_type: @series.pref_body_type,
          pref_genitalia: @series.pref_genitalia,
          models_needed: @series.models_needed,
          notes: @series.notes,
          room_number: @series.room_number,
          starts_at: starts_at,
          ends_at: ends_at,
          status: :pending
        )
        next if faculty_request.save

        failure = "Date ##{i + 1} (#{starts_at.strftime('%b %-d')}): #{faculty_request.errors.full_messages.to_sentence}"
        raise ActiveRecord::Rollback
      end
    end

    return render json: { error: failure }, status: :unprocessable_entity if failure

    render json: @series, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def update
    @series = RequestSeries.find(params[:id])

    require_admin_or_owner(@series)
    
    has_bookings = @series.faculty_requests
      .where.not(status: :archived)
      .joins(:confirmed_gigs)
      .exists?

    if has_bookings && !current_user.role_admin?
      return render json: { error: "This request has confirmed models, so only an admin can change it." }, status: :forbidden
    end

    if series_params[:model_mode] == "nude"
      clothed_only = clothed_only_models_booked_on(@series)
      if clothed_only.any?
        return render json: { error: "Can't switch to nude: #{clothed_only.to_sentence} only model clothed. Release them first." }, status: :unprocessable_entity
      end
    end

    if series_params.key?(:models_needed)
      booked = @series.max_booked_on_active_request
      if series_params[:models_needed].to_i < booked
        return render json: { error: "Models needed can't be lower than the #{booked} model(s) already booked on a date. Release a model first." }, status: :unprocessable_entity
      end
    end

    ActiveRecord::Base.transaction do
      @series.update!(series_params)

      # Copy only the fields that were sent, read back from the saved series so
      # normalization (e.g. clearing the genitalia pref for clothed sessions) carries over
      changed_keys = series_params.keys.map(&:to_s)
      changed_keys |= ["pref_genitalia"] if changed_keys.include?("model_mode")
      shared_attrs = @series.attributes.slice(*(changed_keys & RequestSeries::SHARED_ATTRIBUTES))
      @series.faculty_requests.update_all(shared_attrs) if shared_attrs.present?

      if shared_attrs.key?("models_needed")
        @series.faculty_requests.where.not(status: :archived).find_each(&:refresh_match_status!)
      end
      @series.update_status!
    end

    render json: @series
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def release_remaining
    @series = RequestSeries.find(params[:id])
    @series.release_remaining_for_rematch!
    render json: @series
  end

  def destroy
    @series = RequestSeries.find(params[:id])

    require_admin_or_owner(@series)

    @series.cancel_entire_series!
    head :no_content
  end

  private

  def clothed_only_models_booked_on(series)
    User.joins(art_model_availabilities: { gigs: :faculty_request })
      .where(gigs: { status: Gig.statuses[:confirmed] })
      .where(faculty_requests: { request_series_id: series.id })
      .where.not(faculty_requests: { status: FacultyRequest.statuses[:archived] })
      .where(willing_to_model_nude: false)
      .distinct
      .map { |u| "#{u.first_name} #{u.last_name}" }
  end

  def series_params
    permitted = [
      :class_name, :department, :building, :model_mode,
      :pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia,
      :models_needed, :notes, :room_number
    ]
    permitted << :user_id if current_user.role_admin?
    params.require(:request_series).permit(permitted)
  end
end