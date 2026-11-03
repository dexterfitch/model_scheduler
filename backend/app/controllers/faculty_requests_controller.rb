# Single dates of a class. Faculty create, move and cancel their own dates;
# admins can do so for anyone. Class-wide details live on RequestSeries.
class FacultyRequestsController < ApplicationController
  before_action -> { require_role(:admin, :faculty) }

  # Lists dates: a faculty member's own, or for admins everyone's (or one person's).
  def index
    @requests = if current_user.role_admin?
      params[:user_id] ? FacultyRequest.where(user_id: params[:user_id]) : FacultyRequest.all
    else
      FacultyRequest.where(user_id: current_user.id)
    end

    render json: @requests, include: :user
  end

  # Adds a date, to one of the faculty member's own classes if a series is given.
  def create
    @request = FacultyRequest.new(request_params)
    @request.user_id = current_user.id unless current_user.role_admin?
    if @request.request_series && !current_user.role_admin? && @request.request_series.user_id != current_user.id
      raise NotAuthorizedError
    end
    @request.status = :pending

    if @request.save
      @request.request_series&.update_status!
      record_history("added_date", "Added a date to #{@request.class_name}: #{HistoryEntry.at(@request.starts_at)}.",
        series_id: @request.request_series_id)
      render json: @request, status: :created
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Moves a date to a new day or time. Faculty can only move dates that are still
  # pending and unbooked; the new date must be from tomorrow to four months out.
  # Models booked on the date are told the new time.
  def update
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if (@request.status != 'pending' || @request.confirmed_gigs.exists?) && !current_user.role_admin?
      return render json: { error: "This request can no longer be edited because a model has already been booked or it was archived" }, status: :forbidden
    end

    new_starts_at = update_params[:starts_at] ? Time.zone.parse(update_params[:starts_at].to_s) : @request.starts_at

    if new_starts_at && new_starts_at.to_date <= Date.current
      return render json: { error: "Requests must be for a future date (tomorrow or later)" }, status: :unprocessable_content
    end

    if new_starts_at && new_starts_at > 4.months.from_now
      return render json: { error: "Cannot be more than 4 months in the future" }, status: :unprocessable_content
    end

    if @request.update(update_params)
      @request.request_series&.update_status!
      if @request.saved_change_to_starts_at? || @request.saved_change_to_ends_at?
        Notifier.date_moved(@request, actor: current_user)
        from = @request.saved_change_to_starts_at? ? @request.saved_change_to_starts_at.first : @request.starts_at
        record_history("moved", "Moved #{@request.class_name} from #{HistoryEntry.at(from)} to " \
          "#{HistoryEntry.at(@request.starts_at)}.", series_id: @request.request_series_id)
      end
      render json: @request
    else
      render json: { errors: @request.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Cancels a date. Booked models are released (paid if it's the same day) and told,
  # and so is the faculty member when an admin cancelled it. A date that has started
  # with a model booked can't be cancelled.
  def destroy
    @request = FacultyRequest.find(params[:id])

    require_admin_or_owner(@request)

    if @request.starts_at <= Time.current && @request.confirmed_gigs.exists?
      return render json: { error: "This session has already started, so it can't be cancelled. The booked model will still be paid." }, status: :unprocessable_content
    end

    series = @request.request_series
    had_booked_models = @request.confirmed_gigs.exists?
    was_open = !@request.archived?
    booked = Notifier.confirmed_gigs_on(@request)
    is_late_cancel = @request.cancel_with_billing!
    series&.update_status!
    released = Notifier.now_cancelled(booked)
    Notifier.dates_cancelled(was_open ? [@request] : [], released, actor: current_user)
    summary = "Cancelled #{@request.class_name} on #{HistoryEntry.at(@request.starts_at)}."
    summary += " #{HistoryEntry.count_of(released.size, 'booked model')} released#{', still paid' if is_late_cancel}." if released.any?
    record_history("cancelled", summary, series_id: @request.request_series_id) if was_open

    if had_booked_models
      render json: { message: "Request cancelled. Gig billable: #{is_late_cancel}" }, status: :ok
    else
      head :no_content
    end
  end

  private
  
  # Moving a date only changes its start and end; class details stay on the series.
  def update_params
    params.require(:faculty_request).permit(:starts_at, :ends_at)
  end

  # Allowed fields for a new date. Admins may also set the owner and series;
  # faculty may attach a new date to a series, which #create checks is theirs.
  def request_params
    permitted = [
      :starts_at, :ends_at, :class_name, :department, :building,
      :pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia,
      :models_needed, :model_mode, :notes, :room_number
    ]
    permitted += [:user_id, :request_series_id] if current_user.role_admin?
    permitted << :request_series_id if action_name == "create"
    params.require(:faculty_request).permit(permitted.uniq)
  end
end
