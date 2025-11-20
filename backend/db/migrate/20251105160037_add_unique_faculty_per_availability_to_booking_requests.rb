class AddUniqueFacultyPerAvailabilityToBookingRequests < ActiveRecord::Migration[8.0]
  def change
    add_index :booking_requests,
              [:availability_id, :faculty_id],
              unique: true,
              name: "index_booking_requests_unique_faculty_per_availability"
  end
end