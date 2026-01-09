class UsersController < ApplicationController
  # GET /users
  def index
    render json: User.all
  end

  # GET /users/:id
  def show
    user = User.find(params[:id])
    render json: user
  end

  # PATCH/PUT /users/:id
  # This is what SelectRole.jsx calls
  def update
    user = User.find(params[:id])
    
    if user.update(user_params)
      render json: user
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  # Strong parameters: prevent users from changing sensitive fields (like ID)
  # but allow them to change their role and profile info.
  def user_params
    params.require(:user).permit(
      :first_name, 
      :last_name, 
      :role,  # <--- Essential for your new feature
      :phone, 
      :bio,
      # Model specific fields:
      :stage_name,
      :pronouns,
      :gender_identity,
      :skin_tone,
      :willing_to_model_nude
    )
  end
end