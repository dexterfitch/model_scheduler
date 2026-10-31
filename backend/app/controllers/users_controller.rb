class UsersController < ApplicationController
  ALLOWED_ROLES = %w[admin faculty model].freeze
  SELECTABLE_ROLES = %w[faculty model].freeze

  before_action -> { require_role(:admin) }, only: [:index, :promote, :create, :promote_to_superuser]
  before_action :require_self_or_admin, only: [:show, :update]

  def index
    render json: User.all.order(:id)
  end

  def show
    render json: @target_user
  end

  def create
    user = User.new(user_params)
    user.role = 'model'
    if user.save
      render json: user, status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    if @target_user.role_admin? && @target_user != current_user && !current_user.superuser?
      return render json: { error: "Only a SuperUser can change another admin's profile." }, status: :forbidden
    end

    safe_params = user_params.except(:role)
    safe_params = safe_params.except(:email) unless can_change_email_of?(@target_user)

    if @target_user.update(safe_params)
      render json: @target_user
    else
      render json: { errors: @target_user.errors.full_messages }, status: :unprocessable_content
    end
  end

  def promote
    target_role = params[:role]

    unless ALLOWED_ROLES.include?(target_role)
      return render json: { error: "Invalid role" }, status: :unprocessable_content
    end

    user = User.find(params[:id])

    # Only a SuperUser can make someone an admin, or change an admin's role
    if (target_role == "admin" || user.role_admin?) && !current_user.superuser?
      return render json: { error: "Only a SuperUser can make someone an admin or change an admin's role." }, status: :forbidden
    end

    user.role = target_role

    apply_model_defaults(user, skin_tone: params[:skin_tone]) if user.role_model?
    
    if user.save
      render json: user
    else
      Rails.logger.error("Promote Failed: #{user.errors.full_messages}")
      render json: { errors: user.errors.full_messages }, status: :unprocessable_content
    end
  end

  def promote_to_superuser
    unless current_user.superuser?
      return render json: { error: "Only superusers can grant superuser status" }, status: :forbidden
    end

    user = User.find(params[:id])

    unless user.role_admin?
      return render json: { error: "User must be an admin before becoming a superuser" }, status: :unprocessable_content
    end
    
    user.update(superuser: true)
    render json: user
  end

  def select_role
    target_role = params[:role]

    unless SELECTABLE_ROLES.include?(target_role)
      return render json: { error: "Invalid role" }, status: :unprocessable_content
    end

    if current_user.role.present?
      return render json: { error: "Role already set" }, status: :forbidden
    end

    current_user.role = target_role

    apply_model_defaults(current_user, skin_tone: params[:skin_tone]) if current_user.role_model?

    if current_user.save
      render json: current_user
    else
      render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
    end
  end

  private

  def require_self_or_admin
    @target_user = User.find(params[:id])
    return if current_user.role_admin? || @target_user.id == current_user.id
    render json: { error: "Not authorized" }, status: :forbidden
  end

  def can_change_email_of?(target)
    current_user.superuser? || (current_user.role_admin? && !target.role_admin?)
  end

  def user_params
    permitted = [
      :first_name, :last_name, :phone,
      :stage_name, :pronouns, :gender_identity, :skin_tone, :willing_to_model_nude,
      :body_type, :genitalia
    ]
    permitted << :email if current_user.role_admin?
    params.require(:user).permit(permitted)
  end

  # Bring a profile up to date before it becomes a model profile: match old
  # spellings (like "Non-Binary") to today's options, and fill in what can be.
  # Skin tone is never guessed: it comes from the request or the profile, and
  # if neither has one the save fails and says so.
  def apply_model_defaults(user, skin_tone: nil)
    user.gender_identity = User.current_option(user.gender_identity, User::GENDER_IDENTITIES) || "Prefer not to say"
    user.skin_tone       = User.current_option(skin_tone, User::SKIN_TONE_ANSWERS) || User.current_option(user.skin_tone, User::SKIN_TONE_ANSWERS)
    user.body_type       = User.current_option(user.body_type, User::BODY_TYPES)
    user.genitalia       = User.current_option(user.genitalia, User::GENITALIA)
    user.willing_to_model_nude = false if user.willing_to_model_nude.nil?
  end
end
