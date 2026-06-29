class AddBuildingToFacultyRequestsAndRequestSeries < ActiveRecord::Migration[8.0]
  def change
    add_column :faculty_requests, :building, :string
    add_column :request_series, :building, :string
  end
end