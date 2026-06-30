class ArtModelAvailabilitiesController < ApplicationController
  before_action -> { require_role(:admin, :model) }

  def index
    query = if current_user.role_admin?
      params[:user_id] ? ArtModelAvailability.where(user_id: params[:user_id]) : ArtModelAvailability.all
    else
      ArtModelAvailability.where(user_id: current_user.id)
    end
    render json: query.includes(:user), include: :user
  end

  def create
    availability = ArtModelAvailability.new(availability_params)
    availability.user_id = current_user.id unless current_user.role_admin?

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

    if availability.destroy
      head :no_content
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def cancel
    availability = ArtModelAvailability.find(params[:id])

    unless current_user.role_admin? || availability.user_id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end

    cancel_remaining_series = ActiveModel::Type::Boolean.new.cast(params[:cancel_remaining_series])

    if availability.cancel_with_gig!(
      cancel_remaining_series: cancel_remaining_series,
      flag_for_attention: !current_user.role_admin?
    )
      render json: availability
    else
      render json: { error: "No active gig found for this availability slot" }, status: :unprocessable_entity
    end
  end

  private

  def availability_params
    permitted = [:user_id, :starts_at, :ends_at]
    permitted << :status if current_user.role_admin?
    params.require(:art_model_availability).permit(permitted)
  end
end