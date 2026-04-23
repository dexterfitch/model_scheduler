class FacultyRequestsController < ApplicationController
  before_action -> { require_role(:admin, :faculty) }

  def index
    if params[:user_id]
      @requests = FacultyRequest.where(user_id: params[:user_id])
    else
      @requests = FacultyRequest.all
    end

    render json: @requests, include: :user
  end

  def create
    @request = FacultyRequest.new(request_params)

    if @request.save
      render json: @request, status: :created
    else
      render json: @request.errors, status: :unprocessable_entity
    end
  end

  def destroy
    @request = FacultyRequest.find(params[:id])

    unless current_user.role_admin? || @request.user_id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end
    
    if @request.status == 'pending'
      @request.destroy
      head :no_content
      return
    end

    if @request.status == 'matched' && @request.gig
      gig = @request.gig
      
      is_late_cancel = gig.faculty_request.starts_at.to_date == Date.current

      Gig.transaction do
        @request.update!(status: 'archived')

        gig.art_model_availability.update!(status: 'active')

        gig.update!(
          status: 'cancelled',
          billable: is_late_cancel
        )
      end
      
      render json: { message: "Request cancelled. Gig billable: #{is_late_cancel}" }, status: :ok
    else
      @request.destroy
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
      :pref_skin_tone, 
      :pref_gender, 
      :model_mode,
      :status,
      :notes
    )
  end
end