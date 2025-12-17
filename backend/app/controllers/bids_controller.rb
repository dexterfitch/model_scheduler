class BidsController < ApplicationController
  
  # POST /open_calls/:open_call_id/bids
  def create
    user = User.find_by(email: params[:email])
    return render json: { error: "Unauthorized" }, status: :forbidden unless user&.role_model?

    open_call = OpenCall.find(params[:open_call_id])
    
    # 1. AUTO-CREATE AVAILABILITY
    # Check if the model already has a slot for this time. If not, create one.
    availability = user.availabilities.find_or_initialize_by(
      starts_at: open_call.starts_at,
      ends_at: open_call.ends_at
    )
    
    if availability.new_record?
      availability.notes = "Applying for: #{open_call.class_name}"
      availability.status = :available
      availability.save!
    end

    # 2. CREATE BID
    bid = open_call.bids.build(
      model: user, 
      message: params[:message],
      status: :pending
    )

    if bid.save
      render json: bid, status: :created
    else
      render json: { errors: bid.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /bids/:id/accept
  def accept
    user = User.find_by(email: params[:email])
    
    # CHANGED: Only Admin can accept bids now
    return render json: { error: "Unauthorized" }, status: :forbidden unless user&.role_admin?

    bid = Bid.find(params[:id])
    
    bid.accept! # triggers the logic in the Model above
    render json: { status: "accepted", open_call_status: "confirmed" }
  end
end