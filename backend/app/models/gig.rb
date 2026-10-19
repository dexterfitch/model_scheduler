class Gig < ApplicationRecord
  belongs_to :faculty_request
  belongs_to :art_model_availability
  belongs_to :confirmed_by, class_name: 'User', optional: true

  enum :status, { confirmed: 0, completed: 1, cancelled: 2 }

  validate :request_must_fit_availability
  validate :no_overlap_for_model
  validate :model_must_be_nudity_compatible
  validate :request_must_have_open_slot, on: :create
  validate :model_not_already_on_request, on: :create

  def as_json(options = {})
    super(options.merge(include: {
      faculty_request: { include: :user },
      art_model_availability: { include: :user }
    }))
  end

  private

  def request_must_fit_availability
    return unless faculty_request && art_model_availability

    req_start = faculty_request.starts_at
    req_end   = faculty_request.ends_at
    avail_start = art_model_availability.starts_at
    avail_end   = art_model_availability.ends_at

    if req_start < avail_start || req_end > avail_end
      errors.add(:base, "The class time is outside the model's availability window")
    end
  end

  def no_overlap_for_model
    return unless faculty_request && art_model_availability
    # Only a confirmed gig can clash; this lets cancellations save even if
    # older data already has an overlap
    return unless confirmed?

    overlapping_gigs = Gig.where(status: :confirmed)
      .where.not(id: id)
      .joins(:art_model_availability, :faculty_request)
      .where(art_model_availabilities: { user_id: art_model_availability.user_id })
      .where("faculty_requests.starts_at < ? AND faculty_requests.ends_at > ?",
             faculty_request.ends_at, faculty_request.starts_at)

    if overlapping_gigs.exists?
      errors.add(:base, "This model is already booked for another class during this time")
    end
  end

  def model_must_be_nudity_compatible
    return unless faculty_request && art_model_availability&.user

    if faculty_request.model_mode == 'nude' && !art_model_availability.user.willing_to_model_nude
      errors.add(:base, "This model is not willing to model nude, and the class requires a nude session")
    end
  end

  def request_must_have_open_slot
    return unless faculty_request

    if faculty_request.confirmed_gigs.count >= faculty_request.models_needed
      errors.add(:base, "This class already has all #{faculty_request.models_needed} model(s) it requested")
    end
  end

  def model_not_already_on_request
    return unless faculty_request && art_model_availability

    already_booked = faculty_request.confirmed_gigs
      .joins(:art_model_availability)
      .where(art_model_availabilities: { user_id: art_model_availability.user_id })
      .exists?

    errors.add(:base, "This model is already booked for this class") if already_booked
  end
end
