class CreateBookingRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :booking_requests do |t|
      t.references :availability, null: false, foreign_key: true
      t.bigint :faculty_id, null: false
      t.integer :status, null: false, default: 0  # 0=pending, 1=approved, 2=denied
      t.text :notes
      t.timestamps
    end

    add_index :booking_requests, :faculty_id
    add_foreign_key :booking_requests, :users, column: :faculty_id
  end
end