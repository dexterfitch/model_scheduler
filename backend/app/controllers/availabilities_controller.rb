class AvailabilitiesController < ApplicationController
  
  # POST /availabilities
  # Params: email (auth), starts_at, ends_at, notes
  def create
    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    # Guard: Only models can create slots
    unless user.role_model?
      return render json: { error: "Only models can create availability slots" }, status: :forbidden
    end

    availability = user.availabilities.build(
      starts_at: params[:starts_at],
      ends_at: params[:ends_at],
      notes: params[:notes],
      status: :pending # Default
    )

    if availability.save
      render json: availability_json(availability), status: :created
    else
      render json: { errors: availability.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # GET /availabilities/open
  def open
    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    unless user.role_faculty? || user.role_admin?
      return render json: { error: "Unauthorized" }, status: :forbidden
    end

    # --- NEW LOGIC ---
    # 1. Find IDs of availabilities that have PENDING requests
    busy_availability_ids = BookingRequest.where(status: :pending).pluck(:availability_id)

    # 2. Query: Not confirmed AND Not in the pending list
    availabilities = Availability.where.not(status: :confirmed)
                                 .where.not(id: busy_availability_ids) # <--- Exclude pending slots
                                 .where("starts_at > ?", Time.current)
                                 .includes(:user)
                                 .order(:starts_at)

    data = availabilities.map do |a|
      availability_json(a).merge({
        model_name: "#{a.user.first_name} #{a.user.last_name}",
        model_id: a.user_id
      })
    end

    render json: data
  end

  # GET /availabilities
  # Params: email, status (optional)
  def index
    return render json: { error: "Email parameter required" }, status: :bad_request unless params[:email].present?
    
    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    # 1. Determine the Base Scope
    if user.role_admin?
      # Admin sees ALL records
      scope = Availability.includes(:user)
    elsif user.role_model?
      # Model sees ONLY their own records
      scope = user.availabilities
    else
      return render json: { error: "Forbidden" }, status: :forbidden
    end

    # 2. Apply Status Filter (if provided)
    # Works for 'pending', 'confirmed', etc. because of the Enum
    if params[:status].present?
      scope = scope.where(status: params[:status])
    end

    # 3. Apply Ordering & Render
    if user.role_admin?
      # Admin: Recent to Oldest
      availabilities = scope.order(starts_at: :desc)
      
      render json: availabilities.map { |a| 
        availability_json(a).merge({
          model_name: "#{a.user.first_name} #{a.user.last_name}",
          model_email: a.user.email
        })
      }
    else
      # Model: Soonest to Furthest (Standard calendar view)
      availabilities = scope.order(:starts_at)
      render json: availabilities.map { |a| availability_json(a) }
    end
  end

  # DELETE /availabilities/:id
  def destroy
    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    # Security: Only look within THIS user's availabilities
    availability = user.availabilities.find_by(id: params[:id])
    return render json: { error: "Availability not found or access denied" }, status: :not_found unless availability

    # Business Logic: Cannot delete if confirmed
    if availability.confirmed?
      return render json: { error: "Cannot delete a confirmed booking." }, status: :unprocessable_entity
    end

    availability.destroy
    render json: { ok: true }, status: :ok
  end

  private

  def availability_json(a)
    {
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      notes: a.notes
    }
  end
end