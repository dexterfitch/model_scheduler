# People's profiles and roles. Everyone edits their own profile; admins list
# everyone, create offline model accounts, change roles and retire models. Only a
# SuperUser can make admins, change an admin's role or profile, grant SuperUser
# status, or remove a person's data.
class UsersController < ApplicationController
  ALLOWED_ROLES = %w[admin faculty model].freeze
  SELECTABLE_ROLES = %w[faculty model].freeze

  before_action -> { require_role(:admin) }, only: [:index, :promote, :create, :promote_to_superuser, :retire, :reinstate, :remove_data]
  before_action :require_self_or_admin, only: [:show, :update]

  # Admins only: everyone.
  def index
    render json: User.all.order(:id)
  end

  # One profile, for the person themselves or an admin.
  def show
    render json: @target_user
  end

  # Admins only: creates an offline sock model account (for a model without a MICA sign-in). New
  # accounts are always models.
  def create
    user = User.new(user_params)
    user.role = 'model'
    if user.save
      record_history("created_account", "Created the sock account #{HistoryEntry.name_of(user)}.")
      render json: user, status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_content
    end
  end

  # Saves profile changes. Nobody changes a role here. Only a SuperUser can edit
  # another admin, and only a SuperUser can change an admin's email (admins can
  # change a faculty member's or model's email).
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

  # Changes someone's role. Making someone an admin, or changing an admin's role,
  # is for SuperUsers only. Becoming a model brings old profile values up to date and
  # needs a skin tone answer.
  def promote
    target_role = params[:role]

    unless ALLOWED_ROLES.include?(target_role)
      return render json: { error: "Invalid role" }, status: :unprocessable_content
    end

    user = User.find(params[:id])

    if (target_role == "admin" || user.role_admin?) && !current_user.superuser?
      return render json: { error: "Only a SuperUser can make someone an admin or change an admin's role." }, status: :forbidden
    end

    old_role = user.role
    user.role = target_role

    apply_model_defaults(user, skin_tone: params[:skin_tone]) if user.role_model?
    
    if user.save
      if old_role != user.role
        record_history("changed_role", "Changed #{HistoryEntry.name_of(user)}'s role from #{old_role || 'none'} to #{user.role}.")
      end
      render json: user
    else
      Rails.logger.error("Promote Failed: #{user.errors.full_messages}")
      render json: { errors: user.errors.full_messages }, status: :unprocessable_content
    end
  end

  # SuperUsers only: makes an admin a SuperUser.
  def promote_to_superuser
    unless current_user.superuser?
      return render json: { error: "Only superusers can grant superuser status" }, status: :forbidden
    end

    user = User.find(params[:id])

    unless user.role_admin?
      return render json: { error: "User must be an admin before becoming a superuser" }, status: :unprocessable_content
    end
    
    user.update(superuser: true)
    record_history("made_superuser", "Made #{HistoryEntry.name_of(user)} a SuperUser.")
    render json: user
  end

  # Admins only: retires a model, so they're no longer offered for classes, counted
  # or emailed. Their free time still to come is taken away; past gigs stay.
  def retire
    user = User.find(params[:id])
    unless user.role_model?
      return render json: { error: "Only models can be retired." }, status: :unprocessable_content
    end

    user.retire!
    record_history("retired", "Retired #{HistoryEntry.name_of(user)}.")
    render json: user
  rescue User::NotYet => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # Admins only: brings a retired model back into the pool.
  def reinstate
    user = User.find(params[:id])
    if user.removed_at
      return render json: { error: "This person's data was removed, so they can't be brought back." }, status: :unprocessable_content
    end

    user.update_columns(retired_at: nil, updated_at: Time.current)
    record_history("reinstated", "Brought #{HistoryEntry.name_of(user)} back.")
    render json: user
  end

  # SuperUsers only: removes a person's data on request (see User#remove_data!).
  # Not for the SuperUser themselves or another SuperUser.
  def remove_data
    unless current_user.superuser?
      return render json: { error: "Only a SuperUser can remove someone's data." }, status: :forbidden
    end

    user = User.find(params[:id])
    if user == current_user || user.superuser?
      return render json: { error: "A SuperUser's data can't be removed here." }, status: :unprocessable_content
    end

    user.remove_data!
    record_history("removed_data", "Removed a person's data (account ##{user.id}).")
    render json: user
  rescue User::NotYet => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # A new user's one-time choice of faculty or model.
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

  # Finds the profile and allows only the person themselves or an admin.
  def require_self_or_admin
    @target_user = User.find(params[:id])
    return if current_user.role_admin? || @target_user.id == current_user.id
    render json: { error: "Not authorized" }, status: :forbidden
  end

  # Whether the signed-in person may change this person's email.
  def can_change_email_of?(target)
    current_user.superuser? || (current_user.role_admin? && !target.role_admin?)
  end

  # Allowed profile fields; email is listed for admins and checked in #update.
  def user_params
    permitted = [
      :first_name, :last_name, :phone,
      :stage_name, :pronouns, :gender_identity, :skin_tone, :willing_to_model_nude,
      :body_type, :genitalia
    ]
    permitted << :email if current_user.role_admin?
    params.require(:user).permit(permitted)
  end

  # Brings a profile up to date before it becomes a model profile: old spellings
  # (like "Non-Binary") become today's options. Skin tone is never guessed; it comes
  # from the request or the profile, and the save fails if neither has one.
  def apply_model_defaults(user, skin_tone: nil)
    user.gender_identity = User.current_option(user.gender_identity, User::GENDER_IDENTITIES) || "Prefer not to say"
    user.skin_tone       = User.current_option(skin_tone, User::SKIN_TONE_ANSWERS) || User.current_option(user.skin_tone, User::SKIN_TONE_ANSWERS)
    user.body_type       = User.current_option(user.body_type, User::BODY_TYPES)
    user.genitalia       = User.current_option(user.genitalia, User::GENITALIA)
    user.willing_to_model_nude = false if user.willing_to_model_nude.nil?
  end
end
