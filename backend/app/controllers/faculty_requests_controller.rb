class FacultyRequestsController < ApplicationController
  before_action -> { require_role(:admin, :faculty) }

  def index
    @requests = if current_user.role_admin?
      params[:user_id] ? FacultyRequest.where(user_id: params[:user_id]) : FacultyRequest.all
    else
      FacultyRequest.where(user_id: current_user.id)
    end

    render json: @requests, include: :user
  end

  def create
    @request = FacultyRequest.new(request_params)
    @request.user_id = current_user.id unless current_user.role_admin?
    if @request.request_series && !current_user.role_admin? && @request.request_series.user_id != current_user.id
      raise NotAuthorizedError
    end
    @request.status = :pending

    if @request.save
      @request.request_series&.update_status!
      render json: @request, status: :created
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if (@request.status != 'pending' || @request.confirmed_gigs.exists?) && !current_user.role_admin?
      return render json: { error: "This request can no longer be edited because a model has already been booked or it was archived" }, status: :forbidden
    end

    new_starts_at = request_params[:starts_at] ? Time.zone.parse(request_params[:starts_at].to_s) : @request.starts_at

    if new_starts_at && new_starts_at.to_date <= Date.current
      return render json: { error: "Requests must be for a future date (tomorrow or later)" }, status: :unprocessable_content
    end

    if new_starts_at && new_starts_at > 4.months.from_now
      return render json: { error: "Cannot be more than 4 months in the future" }, status: :unprocessable_content
    end

    if @request.update(request_params)
      @request.request_series&.update_status!
      render json: @request
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if @request.starts_at <= Time.current && @request.confirmed_gigs.exists?
      return render json: { error: "This session has already started, so it can't be cancelled. The booked model will still be paid." }, status: :unprocessable_content
    end

    series = @request.request_series
    had_booked_models = @request.confirmed_gigs.exists?
    is_late_cancel = @request.cancel_with_billing!
    series&.update_status!

    if had_booked_models
      render json: { message: "Request cancelled. Gig billable: #{is_late_cancel}" }, status: :ok
    else
      head :no_content
    end
  end

  private

  def request_params
    permitted = [
      :starts_at, :ends_at, :class_name, :department, :building,
      :pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia,
      :models_needed, :model_mode, :notes, :room_number
    ]
    permitted += [:user_id, :request_series_id] if current_user.role_admin?
    # Faculty can attach a new date to a series (checked in #create), but can't move it later
    permitted << :request_series_id if action_name == "create"
    params.require(:faculty_request).permit(permitted.uniq)
  end
end