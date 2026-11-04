# Removes the old model count from dates. Some databases (like the live one) never
# had it, so it's only removed where it exists.
class RemoveModelCountFromFacultyRequests < ActiveRecord::Migration[8.0]
  def up
    remove_column :faculty_requests, :model_count if column_exists?(:faculty_requests, :model_count)
  end

  def down
    add_column :faculty_requests, :model_count, :integer, default: 1, null: false unless column_exists?(:faculty_requests, :model_count)
  end
end
