class ArtModelAvailabilitiesController < ApplicationController
  # GET /art_model_availabilities
  def index
    # If a specific user_id is passed, filter by that (e.g., for a specific model's profile)
    # Otherwise, return all (for the Admin dashboard)
    if params[:user_id]
      @availabilities = ArtModelAvailability.where(user_id: params[:user_id])
    else
      @availabilities = ArtModelAvailability.all
    end
    
    # We include the user data so the frontend can see the model's name/demographics
    render json: @availabilities, include: :user
  end

  # POST /art_model_availabilities
  def create
    @availability = ArtModelAvailability.new(availability_params)

    if @availability.save
      render json: @availability, status: :created
    else
      render json: @availability.errors, status: :unprocessable_entity
    end
  end

  # DELETE /art_model_availabilities/:id
  def destroy
    @availability = ArtModelAvailability.find(params[:id])
    @availability.destroy
    head :no_content
  end

  private

  def availability_params
    # We permit user_id here so the frontend can say "I am User X creating this slot"
    params.require(:art_model_availability).permit(:user_id, :starts_at, :ends_at, :status)
  end
end