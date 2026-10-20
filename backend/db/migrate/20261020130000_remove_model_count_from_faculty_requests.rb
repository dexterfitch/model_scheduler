class RemoveModelCountFromFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    remove_column :faculty_requests, :model_count, :integer, default: 1, null: false
  end
end