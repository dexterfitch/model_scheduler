class OpenCallsController < ApplicationController
  
  # GET /open_calls
  def index
    user = User.find_by(email: params[:email])
    return render json: { error: "User not found" }, status: :not_found unless user

    if user.role_faculty?
      # Faculty see their own history
      calls = OpenCall.where(user_id: user.id).includes(:bids).order(starts_at: :desc)
      render json: calls.as_json(include: { bids: { include: :model } })
      
    elsif user.role_admin?
      # Admin sees ALL calls (so they can approve bids)
      calls = OpenCall.includes(:faculty, :bids).order(starts_at: :desc)
      
      render json: calls.map { |c| 
        c.as_json(include: :faculty).merge({
          bids: c.bids.map { |b| 
            b.as_json.merge(model_name: "#{b.model.first_name} #{b.model.last_name}") 
          }
        })
      }

    elsif user.role_model?
      # Models see open jobs in the future
      # CHANGED: Anonymized for User Story (Models shouldn't see who Faculty is yet)
      calls = OpenCall.where(status: :open)
                      .where("starts_at > ?", Time.current)
                      .order(:starts_at)
      
      data = calls.map do |c|
        {
          id: c.id,
          class_name: c.class_name,
          starts_at: c.starts_at,
          ends_at: c.ends_at,
          is_nude: c.is_nude, # Exposed new field
          notes: c.notes,     # Faculty preferences
          my_bid: c.bids.find_by(user_id: user.id) # Returns the bid object or nil
        }
      end
      render json: data
    else
      render json: { error: "Unauthorized" }, status: :forbidden
    end
  end

  # POST /open_calls (Faculty only)
  def create
    user = User.find_by(email: params[:email])
    return render json: { error: "Unauthorized" }, status: :forbidden unless user&.role_faculty?

    open_call = OpenCall.new(
      user_id: user.id,
      class_name: params[:class_name],
      starts_at: params[:starts_at],
      ends_at: params[:ends_at],
      notes: params[:notes],
      is_nude: params[:is_nude], # New Param
      status: :open
    )

    if open_call.save
      render json: open_call, status: :created
    else
      render json: { errors: open_call.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /open_calls/:id
  def destroy
    # Placeholder
  end
end