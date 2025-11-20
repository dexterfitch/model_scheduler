class AddUniqueApprovedPerAvailability < ActiveRecord::Migration[8.0]
  def change
    # Partial unique index: at most one approved request per availability
    add_index :booking_requests,
              [:availability_id, :status],
              unique: true,
              where: "status = 1", # 1 = approved
              name: "index_booking_requests_unique_approved_per_availability"
  end
end