class DropOldTables < ActiveRecord::Migration[8.0]
  def change
    drop_table :booking_requests
    drop_table :bids
    drop_table :open_calls
  end
end