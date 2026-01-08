class GigsController < ApplicationController
  def index
    # Eager load the deep nested associations
    gigs = Gig.includes(
      faculty_request: :user,
      art_model_availability: :user
    ).all

    # Explicitly tell Rails to include the users in the JSON output
    render json: gigs, include: {
      faculty_request: { include: :user },
      art_model_availability: { include: :user }
    }
  end

  def create
    gig = Gig.new(gig_params)
    if gig.save
      # When a gig is created, update the availability and request statuses
      gig.art_model_availability.update(status: 'active') # Ensure it stays active (or change logic if needed)
      gig.faculty_request.update(status: 'matched')
      
      render json: gig, status: :created
    else
      render json: { errors: gig.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    gig = Gig.find(params[:id])
    if gig.update(gig_params)
      render json: gig
    else
      render json: { errors: gig.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    gig = Gig.find(params[:id])
    
    # When cancelling a gig, revert statuses
    gig.faculty_request.update(status: 'pending')
    # availability usually stays 'active' so they can be booked again, 
    # or you might want to set it to something else depending on logic.
    
    gig.destroy
    head :no_content
  end

  private

  def gig_params
    params.require(:gig).permit(:faculty_request_id, :art_model_availability_id)
  end
end