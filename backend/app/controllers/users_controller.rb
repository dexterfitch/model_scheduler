class UsersController < ApplicationController
  ALLOWED_ROLES = %w[admin faculty model].freeze

  before_action -> { require_role(:admin) }, only: [:index, :promote, :create, :promote_to_superuser]

  def index
    render json: User.all.order(:id)
  end

  def show
    user = User.find(params[:id])
    unless current_user.role_admin? || user.id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end
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

    unless current_user.role_admin? || user.id == current_user.id
      return render json: { error: "Not authorized" }, status: :forbidden
    end

    safe_params = user_params.except(:role)

    if user.update(safe_params)
      render json: user
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end
  

  def promote
    target_role = params[:role]

    unless ALLOWED_ROLES.include?(target_role)
      return render json: { error: "Invalid role" }, status: :unprocessable_entity
    end

    user = User.find(params[:id])
    user.role = target_role

    if user.role_model?
      user.skin_tone ||= "Test Skin Tone"
      user.gender_identity ||= "Test Identity"
      user.willing_to_model_nude = false if user.willing_to_model_nude.nil?
    end
    
    if user.save
      render json: user
    else
      Rails.logger.error("Promote Failed: #{user.errors.full_messages}")
      render json: { error: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def promote_to_superuser
    unless current_user.superuser?
      return render json: { error: "Only superusers can grant superuser status" }, status: :forbidden
    end

    user = User.find(params[:id])

    unless user.role_admin?
      return render json: { error: "User must be an admin before becoming a superuser" }, status: :unprocessable_entity
    end
    
    user.update(superuser: true)
    render json: user
  end

  private

  def user_params
    params.require(:user).permit(
      :first_name, :last_name, :email, :phone, :bio,
      :stage_name, :pronouns, :gender_identity, :skin_tone, :willing_to_model_nude
    )
  end
end