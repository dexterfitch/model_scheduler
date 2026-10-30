class GigsController < ApplicationController
  before_action -> { require_role(:admin, :model) }, only: [:index]
  before_action -> { require_role(:admin) }, only: [:create, :destroy, :correct]

  def index
    gigs = if current_user.role_admin?
      Gig.includes(faculty_request: :user, art_model_availability: :user).all
    else
      # Models only see their own gigs
      Gig.includes(faculty_request: :user, art_model_availability: :user)
        .joins(:art_model_availability)
        .where(art_model_availabilities: { user_id: current_user.id })
    end

    if current_user.role_admin?
      render json: gigs.includes(gig_corrections: :user).map { |gig| admin_json(gig) }
    else
      render json: gigs.map { |gig| model_card(gig) }
    end
  end

  def create
    gig = reusable_cancelled_gig || Gig.new
    gig.assign_attributes(gig_params)
    gig.status = :confirmed
    gig.billable = nil
    gig.confirmed_by = current_user

    saved = Gig.transaction do
      # Lock the request so two admins can't over-fill the last open slot at once
      gig.faculty_request&.lock!

      # Classes with per-model preferences: fill the open slot this model fits best
      if gig.faculty_request && gig.art_model_availability
        gig.model_slot_position = gig.faculty_request.best_open_slot_for(gig.art_model_availability.user)
      end
      
      # context: :create runs the new-booking checks (room in the class, not
      # already booked, still bookable) even when reusing an old record
      gig.save(context: :create)
    end

    if saved
      gig.art_model_availability&.update(status: 'active')
      faculty_request = gig.faculty_request
      faculty_request.refresh_match_status!
      faculty_request.update(needs_attention: false) if faculty_request.matched?
      faculty_request.request_series&.update_status!
      render json: gig, status: :created
    else
      render json: { errors: gig.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    gig = Gig.find(params[:id])
    if gig.faculty_request.starts_at <= Time.current
      return render json: { error: "This session has already started, so the model can't be released from it." }, status: :unprocessable_content
    end
    is_late_cancel = gig.faculty_request.starts_at.to_date == Date.current

    Gig.transaction do
      gig.update!(status: 'cancelled', billable: is_late_cancel)
      gig.art_model_availability&.update!(status: 'active')
      gig.faculty_request&.refresh_match_status!
    end

    gig.faculty_request&.request_series&.update_status!

    render json: { message: "Gig cancelled. Billable: #{is_late_cancel}" }, status: :ok
  end

  # An admin fixes the record of a gig whose class already happened
  def correct
    gig = Gig.find(params[:id])
    PastGigCorrection.new(gig: gig, admin: current_user, params: correction_params).apply!
    render json: admin_json(gig.reload)
  rescue PastGigCorrection::Error => e
    render json: { errors: [e.message] }, status: :unprocessable_content
  end

  private

  def admin_json(gig)
    gig.as_json.merge("corrections" => gig.corrections)
  end

  def correction_params
    params.require(:correction).permit(:kind, :note, :worked_starts_at, :worked_ends_at, :reset_hours, :stand_in_user_id)
  end

  # What a model's own gig cards need, and nothing more: no faculty notes,
  # no faculty contact details
  def model_card(gig)
    gig.serializable_hash(only: [:id, :status, :billable, :no_show, :worked_starts_at, :worked_ends_at, :model_slot_position, :faculty_request_id, :art_model_availability_id]).merge(
      "faculty_request" => gig.faculty_request.serializable_hash(
        only: [:id, :request_series_id, :class_name, :department, :building, :room_number, :model_mode, :starts_at, :ends_at, :status],
        include: { user: { only: [:first_name, :last_name] } }
      ),
      "art_model_availability" => gig.art_model_availability.serializable_hash(
        only: [:id, :starts_at, :ends_at, :status],
        include: { user: { only: [:id] } }
      )
    )
  end

  # Rebooking a model who was released from this class reuses their old record,
  # so each model has one record per date and a same-day release isn't paid twice
  def reusable_cancelled_gig
    availability = ArtModelAvailability.find_by(id: gig_params[:art_model_availability_id])
    return unless availability

    Gig.cancelled
      .joins(:art_model_availability)
      .where(faculty_request_id: gig_params[:faculty_request_id],
             art_model_availabilities: { user_id: availability.user_id })
      .order(updated_at: :desc)
      .first
  end

  def gig_params
    params.require(:gig).permit(:faculty_request_id, :art_model_availability_id)
  end
end
