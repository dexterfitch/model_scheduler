class GigsController < ApplicationController
  before_action -> { require_role(:admin, :model) }, only: [:index]
  before_action -> { require_role(:admin) }, only: [:create, :update, :destroy]

  def index
    gigs = Gig.includes(
      faculty_request: :user,
      art_model_availability: :user
    ).all

    render json: gigs, include: {
      faculty_request: { include: :user },
      art_model_availability: { include: :user }
    }
  end

  def create
    gig = Gig.new(gig_params)
    if gig.save
      gig.art_model_availability.update(status: 'active')
      gig.faculty_request.update(status: 'matched')
      render json: gig, status: :created
    else
      render json: { errors: gig.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    gig = Gig.find(params[:id])
    if gig.update(gig_params)
      render json: gig
    else
      render json: { errors: gig.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    gig = Gig.find(params[:id])
    gig.faculty_request.update(status: 'pending')
    gig.destroy
    head :no_content
  end

  private

  def gig_params
    params.require(:gig).permit(:faculty_request_id, :art_model_availability_id)
  end
end