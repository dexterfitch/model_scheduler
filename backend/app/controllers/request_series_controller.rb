# Classes: a set of dates sharing the same details and model preferences.
# Faculty manage their own classes; admins manage every class and can release
# models to rebook; models see open calls they could sign up for.
class RequestSeriesController < ApplicationController
  MAX_DATES_PER_SERIES = 50
  PREFERENCE_FIELDS = %w[pref_skin_tone pref_gender pref_body_type pref_genitalia].freeze
  # How each kind of change to a class is described in History, in this order:
  # short details with their before and after values, longer ones just as changed.
  EDITED_FIELDS = [
    [%w[class_name], "class name", :values], [%w[department], "department", :values],
    [%w[building], "building", :values], [%w[room_number], "room", :values],
    [%w[model_mode], "nudity", :values], [%w[models_needed], "number of models", :values],
    [PREFERENCE_FIELDS + %w[model_slots], "preferences", :changed], [%w[notes], "notes", :changed],
    [%w[user_id], "faculty member", :people]
  ].freeze
  before_action -> { require_role(:admin, :faculty) }, except: [:available_for_model]
  before_action -> { require_role(:admin, :model) }, only: [:available_for_model]
  before_action -> { require_role(:admin) }, only: [:release_remaining]

  # Lists classes with their dates. Admins also get every gig of each date (with
  # corrections) and who dropped out; faculty only learn whether a date is booked
  # and which admin to contact, never who the model is. With since, only classes
  # with a date on or after that day.
  def index
    preload = { faculty_requests: { confirmed_gigs: [:confirmed_by, { art_model_availability: :user }] } }
    if current_user.role_admin?
      preload[:faculty_requests][:gigs] = [{ gig_corrections: :user }, { art_model_availability: :user }]
    end
    @series = if current_user.role_admin?
      RequestSeries.all.includes(:user, :model_slots, preload)
    else
      RequestSeries.where(user_id: current_user.id).includes(:user, :model_slots, preload)
    end
    if (since = since_param)
      @series = @series.where(id: FacultyRequest.where("starts_at >= ?", since).select(:request_series_id))
    end

    render json: @series, include: {
      user: {},
      model_slots: { only: [:position, :pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia] },
      faculty_requests: {
        methods: current_user.role_admin? ? [:dropped_out_model_name] : [],
        include: (current_user.role_admin? ? {
          gigs: { methods: [:corrections], include: { art_model_availability: { include: :user } } }
        } : {}).merge(
          confirmed_gigs: current_user.role_admin? ? {
            include: { art_model_availability: { include: :user } }
          } : {
            only: [:id, :status],
            include: {
              confirmed_by: { only: [:id, :first_name, :last_name, :email] }
            }
          }
        )
      }
    }
  end

  # Open calls for the signed-in model: classes with dates still to come that need a
  # model, that this model could pose for (nude classes only for models willing),
  # leaving out dates they're already booked on. Soonest first. Retired models get none.
  def available_for_model
    return render json: [] if current_user.retired?

    series_list = RequestSeries.visible_to_model(current_user)
      .includes(faculty_requests: { confirmed_gigs: :art_model_availability })

    payload = series_list.filter_map do |series|
      open_requests = series.faculty_requests.select do |req|
        req.pending? && req.starts_at > Time.current &&
          req.confirmed_gigs.none? { |g| g.art_model_availability.user_id == current_user.id }
      end.sort_by(&:starts_at)
      next if open_requests.empty?

      series.as_json(
        only: [:id, :class_name, :department, :model_mode, :pref_skin_tone, :pref_gender, :room_number, :status, :models_needed]
      ).merge(
        "faculty_requests" => open_requests.map do |req|
          req.as_json(only: [:id, :starts_at, :ends_at, :status, :models_needed])
            .merge("open_slots" => [req.models_needed - req.confirmed_gigs.size, 0].max)
        end
      )
    end

    render json: payload.sort_by { |call| Time.zone.parse(call["faculty_requests"].first["starts_at"].to_s) }
  end

  # Creates a class and all its dates in one go. Dates are given in Eastern time;
  # one bad date rolls back the whole class, with an error naming that date.
  def create
    @series = RequestSeries.new(series_params)
    @series.user_id = current_user.id unless current_user.role_admin?
    @series.status = :pending

    slots = model_slot_params
    if slots.present? && slots.length != @series.models_needed
      return render json: { error: slot_count_error(@series.models_needed) }, status: :unprocessable_content
    end

    dates = params[:dates]

    unless dates.is_a?(Array) && dates.any?
      return render json: { error: "At least one date is required" }, status: :unprocessable_content
    end

    if dates.length > MAX_DATES_PER_SERIES
      return render json: { error: "A request can have at most #{MAX_DATES_PER_SERIES} dates" }, status: :unprocessable_content
    end

    eastern = ActiveSupport::TimeZone["Eastern Time (US & Canada)"]
    times = dates.each_with_index.map do |entry, i|
      entry = entry.permit(:date, :start_time, :end_time) if entry.respond_to?(:permit)
      starts_at = ends_at = nil
      if entry.respond_to?(:[]) && !entry.is_a?(String)
        starts_at = eastern.parse("#{entry[:date]}T#{entry[:start_time]}") rescue nil
        ends_at   = eastern.parse("#{entry[:date]}T#{entry[:end_time]}") rescue nil
      end
      unless starts_at && ends_at
        return render json: { error: "Date ##{i + 1} has an invalid date or time" }, status: :unprocessable_content
      end
      [starts_at, ends_at]
    end

    failure = nil

    ActiveRecord::Base.transaction do
      @series.save!
      @series.assign_model_slots!(slots) if slots.present?

      times.each_with_index do |(starts_at, ends_at), i|
        faculty_request = FacultyRequest.new(
          request_series: @series,
          user: @series.user,
          class_name: @series.class_name,
          department: @series.department,
          building: @series.building,
          model_mode: @series.model_mode,
          pref_skin_tone: @series.pref_skin_tone,
          pref_gender: @series.pref_gender,
          pref_body_type: @series.pref_body_type,
          pref_genitalia: @series.pref_genitalia,
          models_needed: @series.models_needed,
          notes: @series.notes,
          room_number: @series.room_number,
          starts_at: starts_at,
          ends_at: ends_at,
          status: :pending
        )
        next if faculty_request.save

        failure = "Date ##{i + 1} (#{starts_at.strftime('%b %-d')}): #{faculty_request.errors.full_messages.to_sentence}"
        raise ActiveRecord::Rollback
      end
    end

    return render json: { error: failure }, status: :unprocessable_content if failure

    record_history("requested", "Requested #{@series.class_name} (#{HistoryEntry.count_of(times.size, 'date')}).", series_id: @series.id)
    render json: @series, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # Changes a class's details or preferences. Only dates still to come pick up the
  # changes, so past records stay as they were. Faculty can't change a class once a
  # model is booked; nobody can switch to nude while a clothed-only model is
  # booked, or ask for fewer models than are already booked.
  def update
    @series = RequestSeries.find(params[:id])

    require_admin_or_owner(@series)
    
    has_bookings = @series.faculty_requests
      .where.not(status: :archived)
      .joins(:confirmed_gigs)
      .exists?

    if has_bookings && !current_user.role_admin?
      return render json: { error: "This request has confirmed models, so only an admin can change it." }, status: :forbidden
    end

    if series_params[:model_mode] == "nude"
      clothed_only = clothed_only_models_booked_on(@series)
      if clothed_only.any?
        return render json: { error: "Can't switch to nude: #{clothed_only.to_sentence} only model clothed. Release them first." }, status: :unprocessable_content
      end
    end

    if series_params.key?(:models_needed)
      booked = @series.max_booked_on_active_request
      if series_params[:models_needed].to_i < booked
        return render json: { error: "Models needed can't be lower than the #{booked} model(s) already booked on a date. Release a model first." }, status: :unprocessable_content
      end
    end

    slots = model_slot_params
    needed = (series_params[:models_needed] || @series.models_needed).to_i
    if slots.present? && slots.length != needed
      return render json: { error: slot_count_error(needed) }, status: :unprocessable_content
    end

    slots_before = @series.model_slots.map { |s| s.attributes.slice(*PREFERENCE_FIELDS) }
    edited = {}
    ActiveRecord::Base.transaction do
      @series.update!(series_params)
      edited = @series.saved_changes.reject { |key, (before, after)| key == "updated_at" || before.presence == after.presence }

      changed_keys = series_params.keys.map(&:to_s)
      changed_keys |= ["pref_genitalia"] if changed_keys.include?("model_mode")
      shared_attrs = @series.attributes.slice(*(changed_keys & RequestSeries::SHARED_ATTRIBUTES))
      if shared_attrs.present?
        @series.faculty_requests.where("starts_at > ?", Time.current).where.not(status: :archived).update_all(shared_attrs)
      end

      if slots
        @series.assign_model_slots!(slots)
      elsif shared_attrs.key?("models_needed")
        @series.resize_model_slots!
      end

      if shared_attrs.key?("models_needed")
        @series.faculty_requests.where.not(status: :archived).find_each(&:refresh_match_status!)
      end
      @series.update_status!
    end

    edited["model_slots"] = true if @series.model_slots.reload.map { |s| s.attributes.slice(*PREFERENCE_FIELDS) } != slots_before
    described = describe_edits(edited)
    record_history("edited", "Edited #{@series.class_name}: #{described.join('; ')}.", series_id: @series.id) if described.any?

    render json: @series
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # Admins only: releases every booked model from the class's remaining dates so they can be
  # rebooked. Each released model is told.
  def release_remaining
    @series = RequestSeries.find(params[:id])
    booked = Notifier.confirmed_gigs_on(@series.faculty_requests.where("starts_at > ?", Time.current))
    @series.release_remaining_for_rematch!
    released = Notifier.now_cancelled(booked)
    Notifier.released(released, actor: current_user)
    record_history("released", "Released #{HistoryEntry.count_of(released.size, 'booking')} from the remaining dates " \
      "of #{@series.class_name}.", series_id: @series.id)
    render json: @series
  end

  # Cancels every date of the class that hasn't started yet. Booked models are told,
  # and so is the faculty member when an admin cancelled it.
  def destroy
    @series = RequestSeries.find(params[:id])

    require_admin_or_owner(@series)

    upcoming = @series.faculty_requests.where.not(status: :archived).where("starts_at > ?", Time.current).to_a
    booked = Notifier.confirmed_gigs_on(upcoming)
    @series.cancel_entire_series!
    released = Notifier.now_cancelled(booked)
    Notifier.dates_cancelled(upcoming, released, actor: current_user)
    summary = "Cancelled #{@series.class_name} (#{HistoryEntry.count_of(upcoming.size, 'date')} still to come)."
    summary += " #{HistoryEntry.count_of(released.size, 'booked model')} released." if released.any?
    record_history("cancelled", summary, series_id: @series.id)
    head :no_content
  end

  private

  # The changes to a class in words, for History, like "room changed from 201 to 305".
  def describe_edits(edited)
    EDITED_FIELDS.filter_map do |fields, label, kind|
      key = fields.find { |field| edited.key?(field) }
      next unless key

      before, after = edited[key]
      case kind
      when :changed then "#{label} changed"
      when :people
        "#{label} changed from #{HistoryEntry.name_of(User.find_by(id: before))} to #{HistoryEntry.name_of(User.find_by(id: after))}"
      else "#{label} changed from #{before.presence || '(none)'} to #{after.presence || '(none)'}"
      end
    end
  end

  # Names of models booked on the class who only pose clothed.
  def clothed_only_models_booked_on(series)
    User.joins(art_model_availabilities: { gigs: :faculty_request })
      .where(gigs: { status: Gig.statuses[:confirmed] })
      .where(faculty_requests: { request_series_id: series.id })
      .where.not(faculty_requests: { status: FacultyRequest.statuses[:archived] })
      .where(willing_to_model_nude: false)
      .distinct
      .map { |u| "#{u.first_name} #{u.last_name}" }
  end

  # Per-model preferences sent with the request, or nil when none were sent.
  def model_slot_params
    return nil unless params.key?(:model_slots)

    Array(params[:model_slots]).map do |slot|
      slot.permit(:pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia).to_h
    end
  end

  # The message for per-model preferences that don't match the number of models.
  def slot_count_error(needed)
    "Give preferences for each of the #{needed} models, or choose \"Same for every model\"."
  end

  # Allowed class fields; admins may also set the owner.
  def series_params
    permitted = [
      :class_name, :department, :building, :model_mode,
      :pref_skin_tone, :pref_gender, :pref_body_type, :pref_genitalia,
      :models_needed, :notes, :room_number
    ]
    permitted << :user_id if current_user.role_admin?
    params.require(:request_series).permit(permitted)
  end
end
