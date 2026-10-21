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

    require_admin_or_owner(availability)

    if availability.update(availability_params)
      render json: availability
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    availability = ArtModelAvailability.find(params[:id])

    require_admin_or_owner(availability)

    # A slot with past bookings can't be deleted outright (the history must stay),
    # so take it out of the model's availability instead
    if availability.gigs.exists? && !availability.active_gig && availability.starts_at >= Time.current
      availability.update_columns(status: ArtModelAvailability.statuses[:cancelled], updated_at: Time.current)
      return head :no_content
    end

    if availability.destroy
      head :no_content
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def cancel
    availability = ArtModelAvailability.find(params[:id])

    require_admin_or_owner(availability)

    target_gig = params[:gig_id].present? ?
      availability.gigs.find_by(id: params[:gig_id], status: :confirmed) :
      availability.active_gig
    if target_gig && target_gig.faculty_request.starts_at <= Time.current
      return render json: { error: "This session has already started, so it can't be cancelled." }, status: :unprocessable_content
    end

    cancel_remaining_series = ActiveModel::Type::Boolean.new.cast(params[:cancel_remaining_series])

    if availability.cancel_with_gig!(
      gig_id: params[:gig_id],
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
    permitted = [:starts_at, :ends_at]
    permitted += [:user_id, :status] if current_user.role_admin?
    params.require(:art_model_availability).permit(permitted)
  end
end