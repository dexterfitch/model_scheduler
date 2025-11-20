class BookingRequest < ApplicationRecord
  belongs_to :availability
  belongs_to :faculty, class_name: "User"
  
  enum :status, { pending: 0, approved: 1, denied: 2, withdrawn: 3 }
  
  validates :status, presence: true
  validate  :faculty_must_be_faculty_role
  validate  :availability_must_belong_to_model
  validate  :availability_not_already_confirmed, on: :create
  validate  :overlaps_confirmed_slot_for_same_model, on: :create
  validate  :no_other_pending_request_for_this_availability, on: :create

  # ---- Admin actions ----
  def approve!
    transaction do
      update!(status: :approved)
      # Lock the slot
      availability.update!(status: :confirmed)
      # Auto-deny others for the same availability
      availability.booking_requests
        .where.not(id: id)
        .where.not(status: [:denied, :withdrawn])
        .update_all(status: BookingRequest.statuses[:denied], updated_at: Time.current)
    end
    self
  end

  def deny!
    update!(status: :denied)
  end
  # -----------------------

  private

  def faculty_must_be_faculty_role
    errors.add(:faculty, "must be a faculty user") unless faculty&.role_faculty?
  end

  def availability_must_belong_to_model
    model_user = availability&.user
    errors.add(:availability, "must belong to an art model") unless model_user&.role_model?
  end


  def availability_not_already_confirmed
    if availability&.status == "confirmed"
      errors.add(:availability, "is already confirmed; cannot accept new requests")
    end
  end

  def overlaps_confirmed_slot_for_same_model
    return unless availability

    model_id = availability.user_id
    start_t  = availability.starts_at
    end_t    = availability.ends_at

    # Overlap condition: (A starts before B ends) AND (A ends after B starts)
    overlap_exists = Availability
                      .where(user_id: model_id, status: :confirmed)
                      .where("starts_at < ? AND ends_at > ?", end_t, start_t)
                      .exists?

    if overlap_exists
      errors.add(:availability, "overlaps an already confirmed slot for this model")
    end
  end

  def no_other_pending_request_for_this_availability
    return unless availability_id.present?

    exists_pending = BookingRequest
      .where(availability_id: availability_id, status: :pending)
      .where.not(id: id)
      .exists?

    if exists_pending
      errors.add(:availability, "already has a pending request")
    end
  end
end