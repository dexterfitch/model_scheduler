class GigsController < ApplicationController
  # GET /gigs
  def index
    @gigs = Gig.includes(:faculty_request, :art_model_availability).all
    
    # We include nested data so the Admin can see WHO is in the gig
    render json: @gigs, include: {
      faculty_request: { include: :user },
      art_model_availability: { include: :user }
    }
  end

  # POST /gigs
  def create
    @gig = Gig.new(gig_params)
    @gig.status = :confirmed

    if @gig.save
      # Mark the Faculty Request as 'matched' so it stops showing up in the "Todo" list
      @gig.faculty_request.update!(status: :matched)
      
      render json: @gig, status: :created
    else
      render json: @gig.errors, status: :unprocessable_entity
    end
  end

  # DELETE /gigs/:id
  def destroy
    @gig = Gig.find(params[:id])
    
    # When a gig is cancelled, we should re-open the faculty request
    request = @gig.faculty_request
    request.update!(status: :pending) if request
    
    @gig.destroy
    head :no_content
  end

  private

  def gig_params
    params.require(:gig).permit(:faculty_request_id, :art_model_availability_id)
  end
end