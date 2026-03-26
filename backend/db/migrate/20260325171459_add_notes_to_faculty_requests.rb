class AddNotesToFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :faculty_requests, :notes, :text
  end
end
