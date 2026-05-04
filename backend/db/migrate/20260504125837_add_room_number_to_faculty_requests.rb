class AddRoomNumberToFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :faculty_requests, :room_number, :string
  end
end
