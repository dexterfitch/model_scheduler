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
    @request.status = :pending

    if @request.save
      render json: @request, status: :created
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if @request.status != 'pending' && !current_user.role_admin?
      return render json: { error: "This request can no longer be edited because it has already been matched or archived" }, status: :forbidden
    end

    new_starts_at = request_params[:starts_at] ? Time.zone.parse(request_params[:starts_at].to_s) : @request.starts_at

    if new_starts_at && new_starts_at.to_date <= Date.current
      return render json: { error: "Requests must be for a future date (tomorrow or later)" }, status: :unprocessable_entity
    end

    if new_starts_at && new_starts_at > 4.months.from_now
      return render json: { error: "Cannot be more than 4 months in the future" }, status: :unprocessable_entity
    end

    if @request.update(request_params)
      render json: @request
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if @request.status == 'pending'
      if Gig.where(faculty_request_id: @request.id).exists?
        @request.update!(status: :archived)
      else
        @request.destroy
      end
      @request.request_series&.update_status!
      head :no_content
      return
    end

    if @request.status == 'matched' && @request.gig
      gig = @request.gig

      is_late_cancel = gig.faculty_request.starts_at.to_date == Date.current

      Gig.transaction do
        @request.update!(status: 'archived')
        gig.update!(
          status: 'cancelled',
          billable: is_late_cancel
        )
        gig.art_model_availability.update!(status: 'active')
      end

      @request.request_series&.update_status!

      render json: { message: "Request cancelled. Gig billable: #{is_late_cancel}" }, status: :ok
    else
      @request.destroy
      @request.request_series&.update_status!
      head :no_content
    end
  end

  private

  def request_params
    params.require(:faculty_request).permit(
      :user_id, 
      :starts_at, 
      :ends_at, 
      :class_name, 
      :department, 
      :building,
      :pref_skin_tone, 
      :pref_gender, 
      :model_mode,
      :notes,
      :room_number,
      :request_series_id
    )
  end
end