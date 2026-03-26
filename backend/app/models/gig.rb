class Gig < ApplicationRecord
  belongs_to :faculty_request
  belongs_to :art_model_availability

  enum :status, { confirmed: 0, completed: 1, cancelled: 2 }

  validate :request_must_fit_availability
  validate :no_overlap_for_model

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
    
    overlapping_gigs = art_model_availability.gigs
      .where.not(id: id)
      .where(status: :confirmed)
      .joins(:faculty_request)
      .where("faculty_requests.starts_at < ? AND faculty_requests.ends_at > ?", 
             faculty_request.ends_at, faculty_request.starts_at)

    if overlapping_gigs.exists?
      errors.add(:base, "This model is already booked for another class during this time")
    end
  end
end