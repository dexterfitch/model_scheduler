class AddRequestSeriesToFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :faculty_requests, :request_series_id, :integer
    add_index :faculty_requests, :request_series_id
  end
end