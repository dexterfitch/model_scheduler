class Bid < ApplicationRecord
  belongs_to :open_call
  belongs_to :model, class_name: "User", foreign_key: "user_id"

  enum :status, { pending: 0, accepted: 1, rejected: 2 }

  validate :must_be_model_role

  def accept!
    transaction do
      # 1. Mark Bid as Accepted
      update!(status: :accepted)
      
      # 2. Mark Open Call as Confirmed
      open_call.update!(status: :confirmed)
      
      # 3. LINKING LOGIC: Find the Model's Availability and Book it
      # We look for the slot created automatically when they bid
      avail = model.availabilities.find_by(
        starts_at: open_call.starts_at, 
        ends_at: open_call.ends_at
      )

      if avail
        avail.update!(status: :confirmed)

        # Create the formal Booking Request so it appears on the Faculty's main schedule
        BookingRequest.create!(
          faculty: open_call.faculty,
          availability: avail,
          status: :approved,
          notes: "Matched via Job Board: #{open_call.class_name}"
        )
      end
      
      # 4. Reject all other pending bids for this job
      open_call.bids.where.not(id: id).where(status: :pending).update_all(status: :rejected)
    end
  end

  private

  def must_be_model_role
    errors.add(:user, "must be a model") unless model&.role_model?
  end
end