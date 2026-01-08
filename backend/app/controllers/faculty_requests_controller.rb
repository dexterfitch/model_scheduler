class FacultyRequestsController < ApplicationController
  # GET /faculty_requests
  def index
    # Filter by user_id if provided (for a specific faculty member's view)
    # Otherwise return all (for the Admin dashboard)
    if params[:user_id]
      @requests = FacultyRequest.where(user_id: params[:user_id])
    else
      @requests = FacultyRequest.all
    end

    render json: @requests, include: :user
  end

  # POST /faculty_requests
  def create
    @request = FacultyRequest.new(request_params)

    if @request.save
      render json: @request, status: :created
    else
      render json: @request.errors, status: :unprocessable_entity
    end
  end

  # DELETE /faculty_requests/:id
  def destroy
    @request = FacultyRequest.find(params[:id])
    @request.destroy
    head :no_content
  end

  private

  def request_params
    params.require(:faculty_request).permit(
      :user_id, 
      :starts_at, 
      :ends_at, 
      :class_name, 
      :pref_skin_tone, 
      :pref_gender, 
      :pref_disability,
      :model_mode,  # <--- Make sure this is added
      :status
    )
  end
end