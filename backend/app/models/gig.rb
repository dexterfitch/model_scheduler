# A model booked into a class date, through one of their blocks of free time.
# Status: confirmed, or cancelled (billable says whether it's still paid). After
# the class, an admin's corrections can mark a no-show, change pay or record the
# hours really worked; each correction is kept in gig_corrections.
class Gig < ApplicationRecord
  belongs_to :faculty_request
  belongs_to :art_model_availability
  belongs_to :confirmed_by, class_name: 'User', optional: true
  has_many :gig_corrections, -> { order(:created_at) }, dependent: :destroy

  attr_accessor :recording_past

  enum :status, { confirmed: 0, completed: 1, cancelled: 2 }

  validate :request_must_fit_availability
  validate :no_overlap_for_model
  validate :model_must_be_nudity_compatible
  validate :request_must_have_open_slot, on: :create
  validate :model_not_already_on_request, on: :create
  validate :must_be_bookable, on: :create

  # A gig with its class (and faculty member) and its model's free time (and the model).
  def as_json(options = {})
    super(options.merge(include: {
      faculty_request: { include: :user },
      art_model_availability: { include: :user }
    }))
  end

  # The corrections made after the class, oldest first. Admins only.
  def corrections
    gig_corrections.map(&:as_json)
  end

  private
  
  # New bookings need active free time and a class date that isn't cancelled and
  # hasn't started (unless an admin is recording someone who covered).
  def must_be_bookable
    return unless faculty_request && art_model_availability

    if art_model_availability.cancelled?
      errors.add(:base, "This model cancelled that availability, so they can't be booked into it")
    end
    if faculty_request.archived?
      errors.add(:base, "This class has been cancelled")
    end
    if !recording_past && faculty_request.starts_at && faculty_request.starts_at <= Time.current
      errors.add(:base, "This class has already started, so a model can't be booked into it")
    end
  end

  # The class must fall entirely inside the model's free time.
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

  # A model can't be booked into two classes at the same time.
  def no_overlap_for_model
    return unless faculty_request && art_model_availability
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

  # Clothed-only models can't be booked into nude classes.
  def model_must_be_nudity_compatible
    return unless faculty_request && art_model_availability&.user

    if faculty_request.model_mode == 'nude' && !art_model_availability.user.willing_to_model_nude
      errors.add(:base, "This model is not willing to model nude, and the class requires a nude session")
    end
  end

  # A class can't get more models than it asked for.
  def request_must_have_open_slot
    return unless faculty_request

    if faculty_request.confirmed_gigs.count >= faculty_request.models_needed
      errors.add(:base, "This class already has all #{faculty_request.models_needed} model(s) it requested")
    end
  end

  # A model can't be booked twice on the same date.
  def model_not_already_on_request
    return unless faculty_request && art_model_availability

    already_booked = faculty_request.confirmed_gigs
      .joins(:art_model_availability)
      .where(art_model_availabilities: { user_id: art_model_availability.user_id })
      .exists?

    errors.add(:base, "This model is already booked for this class") if already_booked
  end
end
