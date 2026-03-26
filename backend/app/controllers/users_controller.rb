class UsersController < ApplicationController
  before_action -> { require_role(:admin) }, only: [:index, :promote]

  def index
    render json: User.all.order(:id)
  end

  def show
    user = User.find(params[:id])
    render json: user
  end

  def create
    user = User.new(user_params)
    user.role = 'model'
    if user.save
      render json: user, status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    user = User.find(params[:id])
    safe_params = user_params
    
    if safe_params[:role] == 'admin'
      return render json: { error: "Cannot set admin role via public API" }, status: :forbidden
    end

    if user.update(safe_params)
      render json: user
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end
  
  def promote
    user = User.find(params[:id])
    target_role = params[:role]

    user.role = target_role

    if user.role_model?
      user.skin_tone ||= "Test Skin Tone"
      user.gender_identity ||= "Test Identity"
      user.willing_to_model_nude = false if user.willing_to_model_nude.nil?
    end
    
    if user.save
      render json: user
    else
      puts "Promote Failed: #{user.errors.full_messages}"
      render json: { error: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def promote_to_superuser
    user = User.find(params[:id])
    user.update(superuser: true)
    render json: user
  end

  private

  def user_params
    params.require(:user).permit(
      :first_name, :last_name, :role, :email, :phone, :bio,
      :stage_name, :pronouns, :gender_identity, :skin_tone, :willing_to_model_nude
    )
  end
end