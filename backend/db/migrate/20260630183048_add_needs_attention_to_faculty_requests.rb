class AddNeedsAttentionToFacultyRequests < ActiveRecord::Migration[7.1]
  def change
    add_column :faculty_requests, :needs_attention, :boolean, default: false, null: false
  end
end