# Bookings of a model into a class date. Admins book, release and correct;
# models see their own gigs, with only what their gig cards need.
class GigsController < ApplicationController
  before_action -> { require_role(:admin, :model) }, only: [:index]
  before_action -> { require_role(:admin) }, only: [:create, :destroy, :correct]

  # Lists gigs: every gig with full details and corrections for admins; a model's own as gig cards.
  def index
    gigs = if current_user.role_admin?
      Gig.includes(faculty_request: :user, art_model_availability: :user).all
    else
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

  # Books a model's free time into a class date. The date is locked while booking so
  # two admins can't fill the last spot at once, and a class with per-model
  # preferences gets the spot this model fits best. Reuses the model's old
  # cancelled gig on that date, if there is one, so each model has one record per date.
  def create
    gig = reusable_cancelled_gig || Gig.new
    gig.assign_attributes(gig_params)
    gig.status = :confirmed
    gig.billable = nil
    gig.confirmed_by = current_user

    saved = Gig.transaction do
      gig.faculty_request&.lock!

      if gig.faculty_request && gig.art_model_availability
        gig.model_slot_position = gig.faculty_request.best_open_slot_for(gig.art_model_availability.user)
      end
      
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

  # Releases a model from a date that hasn't started. Same-day releases stay paid.
  # The date goes back to needing a model.
  def destroy
    gig = Gig.find(params[:id])
    if gig.faculty_request.starts_at <= Time.current
      return render json: { error: "This session has already started, so the model can't be released from it." }, status: :unprocessable_content
    end
    is_late_cancel = gig.faculty_request.starts_at.to_date == Date.current

    Gig.transaction do
      gig.update_columns(status: Gig.statuses[:cancelled], billable: is_late_cancel, updated_at: Time.current)
      gig.art_model_availability&.update_columns(status: ArtModelAvailability.statuses[:active], updated_at: Time.current)
      gig.faculty_request&.refresh_match_status!
    end

    gig.faculty_request&.request_series&.update_status!

    render json: { message: "Gig cancelled. Billable: #{is_late_cancel}" }, status: :ok
  end

  # Corrects the record of a gig whose class has already started (see PastGigCorrection).
  def correct
    gig = Gig.find(params[:id])
    PastGigCorrection.new(gig: gig, admin: current_user, params: correction_params).apply!
    render json: admin_json(gig.reload)
  rescue PastGigCorrection::Error => e
    render json: { errors: [e.message] }, status: :unprocessable_content
  end

  private

  # A gig with its class, model and corrections, as admins see it.
  def admin_json(gig)
    gig.as_json.merge("corrections" => gig.corrections)
  end

  # Allowed fields for a correction.
  def correction_params
    params.require(:correction).permit(:kind, :note, :worked_starts_at, :worked_ends_at, :reset_hours, :stand_in_user_id)
  end

  # A gig as a model's gig card shows it: class, time, place and faculty name only.
  # No faculty notes or contact details, and no corrections notes.
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

  # The model's most recent cancelled gig on the same date, to rebook instead of adding a second
  # record.
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

  # Allowed fields for a booking: the date and the model's free time.
  def gig_params
    params.require(:gig).permit(:faculty_request_id, :art_model_availability_id)
  end
end
