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

    # SCENARIO 1: Request is just Pending (No Gig yet)
    if @request.status == 'pending'
      @request.destroy
      head :no_content
      return
    end

    # SCENARIO 2: Request is Matched (Has a Gig)
    if @request.status == 'matched' && @request.gig
      gig = @request.gig
      
      # 24-Hour Rule Check
      time_until_gig = gig.faculty_request.starts_at - Time.current
      is_late_cancel = time_until_gig < 24.hours

      Gig.transaction do
        # 1. Mark Request as Archived (Faculty is done with it)
        @request.update!(status: 'archived')

        # 2. Release the Model's Availability (So they can get re-booked)
        gig.art_model_availability.update!(status: 'active')

        # 3. Handle the Gig Record
        gig.update!(
          status: 'cancelled',
          billable: is_late_cancel # True if < 24 hours, False otherwise
        )
      end
      
      # Send back a message so frontend knows what happened
      render json: { message: "Request cancelled. Gig billable: #{is_late_cancel}" }, status: :ok
    else
      # Fallback for weird states
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
      :pref_disability,
      :model_mode,  # <--- Make sure this is added
      :status
    )
  end
end