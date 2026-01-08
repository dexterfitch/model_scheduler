class AddDepartmentToFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :faculty_requests, :department, :string
  end
end
