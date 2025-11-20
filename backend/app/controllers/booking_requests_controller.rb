class BookingRequestsController < ApplicationController
  
  # GET /booking_requests
  # Params: email, status (optional)
  def index
    return render json: { error: "Email parameter required" }, status: :bad_request unless params[:email].present?

    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    # 1. Define Scope based on Role
    if user.role_admin?
      # Admin sees EVERYTHING
      scope = BookingRequest.all
    elsif user.role_faculty?
      # Faculty sees requests THEY made
      scope = user.faculty_booking_requests
    elsif user.role_model?
      # Models see requests for THEIR slots
      scope = BookingRequest.joins(:availability).where(availabilities: { user_id: user.id })
    end

    # 2. Apply Filter (Optional)
    if params[:status].present?
      scope = scope.where(status: params[:status])
    end

    # 3. Preload & Render
    scope = scope.includes(:availability, :faculty)
    render json: scope.order(created_at: :desc).map { |br| booking_request_json(br) }
  end

  # POST /booking_requests
  def create
    availability = Availability.find_by(id: params[:availability_id])
    return render json: { error: "Availability not found" }, status: :not_found unless availability

    faculty = User.find_by(email: params[:email])
    return render json: { error: "Faculty not found" }, status: :not_found unless faculty

    br = BookingRequest.create(availability: availability, faculty: faculty, notes: params[:notes])

    if br.persisted?
      render json: { id: br.id, status: br.status, availability_id: br.availability_id, faculty_id: br.faculty_id }, status: :created
    else
      render json: { errors: br.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /booking_requests/:id
  def destroy
    br = BookingRequest.find_by(id: params[:id])
    return render json: { error: "BookingRequest not found" }, status: :not_found unless br

    faculty = User.find_by(email: params[:email])
    return render json: { error: "Faculty not found" }, status: :not_found unless faculty
    
    # Security Checks
    return render json: { error: "User is not a faculty member" }, status: :forbidden unless faculty.role == "faculty"
    return render json: { error: "You can only withdraw your own requests." }, status: :forbidden unless br.faculty_id == faculty.id
    return render json: { error: "Only pending requests can be withdrawn." }, status: :unprocessable_entity unless br.status == "pending"

    br.update!(status: "withdrawn")
    render json: { ok: true, id: br.id, status: br.status }, status: :ok
  end

  # ---------------------------------------------------------
  # Admin Actions
  # ---------------------------------------------------------

  # POST /booking_requests/:id/approve
  def approve
    # 1. Auth Check (Must be Admin)
    user = User.find_by(email: params[:email])
    return render json: { error: "Unauthorized" }, status: :forbidden unless user&.role_admin?

    br = BookingRequest.find_by(id: params[:id])
    return render json: { error: "BookingRequest not found" }, status: :not_found unless br

    begin
      br.approve!
      # Return the full object so the UI can update immediately
      render json: booking_request_json(br)
    rescue ActiveRecord::RecordInvalid => e
      render json: { ok: false, errors: br.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /booking_requests/:id/deny
  def deny
    # 1. Auth Check (Must be Admin)
    user = User.find_by(email: params[:email])
    return render json: { error: "Unauthorized" }, status: :forbidden unless user&.role_admin?

    br = BookingRequest.find_by(id: params[:id])
    return render json: { error: "BookingRequest not found" }, status: :not_found unless br

    br.deny!
    render json: booking_request_json(br)
  end

  private

  def booking_request_json(br)
    {
      id: br.id,
      status: br.status,
      notes: br.notes,
      created_at: br.created_at,
      faculty_name: "#{br.faculty.first_name} #{br.faculty.last_name}",
      faculty_email: br.faculty.email,
      availability: {
        starts_at: br.availability.starts_at,
        ends_at: br.availability.ends_at
      }
    }
  end
end