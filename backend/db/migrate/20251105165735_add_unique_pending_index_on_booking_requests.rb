class AddUniquePendingIndexOnBookingRequests < ActiveRecord::Migration[7.1]
  def change
    add_index :booking_requests,
              [:availability_id],
              unique: true,
              where: "status = 0",  # 0 == 'pending' in the enum
              name: "index_booking_requests_on_availability_id_where_pending"
  end
end