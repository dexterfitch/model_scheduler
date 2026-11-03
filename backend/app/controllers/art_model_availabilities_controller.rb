# Models' free time. Models manage their own; admins see and manage everyone's.
# New or changed time is joined with any free time it overlaps or touches, and a
# booked gig can be cancelled from here.
class ArtModelAvailabilitiesController < ApplicationController
  before_action -> { require_role(:admin, :model) }

  # Lists free time: a model's own, or for admins everyone's (or one model's with user_id).
  def index
    query = if current_user.role_admin?
      params[:user_id] ? ArtModelAvailability.where(user_id: params[:user_id]) : ArtModelAvailability.all
    else
      ArtModelAvailability.where(user_id: current_user.id)
    end
    render json: query.includes(:user), include: :user
  end

  # Adds free time, joining it with the model's overlapping free time.
  def create
    availability = ArtModelAvailability.new(availability_params)
    availability.user_id = current_user.id unless current_user.role_admin?
    asked = [availability.starts_at, availability.ends_at]

    if (saved = availability.save_joining_free_time)
      render json: with_joined(saved, asked), status: :created
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Changes a block of free time, joining it with any free time it now overlaps.
  def update
    availability = ArtModelAvailability.find(params[:id])

    require_admin_or_owner(availability)

    availability.assign_attributes(availability_params)
    asked = [availability.starts_at, availability.ends_at]

    if (saved = availability.save_joining_free_time)
      render json: with_joined(saved, asked)
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Deletes a block of free time. A future block with past bookings in its history
  # is marked cancelled instead, so the history stays.
  def destroy
    availability = ArtModelAvailability.find(params[:id])

    require_admin_or_owner(availability)

    if availability.gigs.exists? && !availability.active_gig && availability.starts_at >= Time.current
      availability.update_columns(status: ArtModelAvailability.statuses[:cancelled], updated_at: Time.current)
      return head :no_content
    end

    if availability.destroy
      head :no_content
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Cancels a booked gig in this block (the one given by gig_id, or the only one).
  # With cancel_remaining_series, the model is also taken off the class's later
  # dates. Classes that have started can't be cancelled. A model cancelling flags
  # the class for the coordinator's attention and tells every admin and the faculty
  # member; an admin cancelling tells the model.
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
    booked = Notifier.confirmed_gigs_of(availability.user_id)

    if availability.cancel_with_gig!(
      gig_id: params[:gig_id],
      cancel_remaining_series: cancel_remaining_series,
      flag_for_attention: !current_user.role_admin?
    )
      cancelled = Notifier.now_cancelled(booked)
      if current_user.role_admin?
        Notifier.released(cancelled, actor: current_user)
      else
        Notifier.dropped_out(cancelled, actor: current_user)
      end
      cancelled.each do |gig|
        request = gig.faculty_request
        summary = if current_user.role_admin?
          "Released #{HistoryEntry.name_of(gig.art_model_availability.user)} from #{request.class_name} on #{HistoryEntry.at(request.starts_at)}."
        else
          "Cancelled their gig: #{request.class_name} on #{HistoryEntry.at(request.starts_at)}."
        end
        record_history(current_user.role_admin? ? "released" : "dropped_out", summary, series_id: request.request_series_id)
      end
      render json: availability
    else
      render json: { error: "No active gig found for this availability slot" }, status: :unprocessable_content
    end
  end

  private

  # The saved block as JSON, plus "joined": whether it was merged with other free
  # time, so the page can say what the block now covers.
  def with_joined(saved, asked)
    joined = [saved.starts_at, saved.ends_at] != asked
    saved.as_json.merge("joined" => joined)
  end

  # Allowed fields: times for everyone, plus user and status for admins.
  def availability_params
    permitted = [:starts_at, :ends_at]
    permitted += [:user_id, :status] if current_user.role_admin?
    params.require(:art_model_availability).permit(permitted)
  end
end
