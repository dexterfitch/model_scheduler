class ArtModelAvailabilitiesController < ApplicationController
  before_action -> { require_role(:admin, :model) }

  def index
    query = if params[:user_id]
              ArtModelAvailability.where(user_id: params[:user_id])
            else
              ArtModelAvailability.all
            end
    render json: query.includes(:user), include: :user
  end

  def create
    availability = ArtModelAvailability.new(availability_params)
    if availability.save
      render json: availability, status: :created
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    availability = ArtModelAvailability.find(params[:id])

    unless current_user.role_admin? || availability.user_id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end

    if availability.update(availability_params)
      render json: availability
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    availability = ArtModelAvailability.find(params[:id])

    unless current_user.role_admin? || availability.user_id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end
    
    availability.destroy
    head :no_content
  end

  private

  def availability_params
    params.require(:art_model_availability).permit(:user_id, :starts_at, :ends_at, :status)
  end
end