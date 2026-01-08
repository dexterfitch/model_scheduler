class SetupNudeModelLogic < ActiveRecord::Migration[8.0]
  def change
    # 1. Rename the existing column to be more descriptive
    rename_column :users, :nude_model, :willing_to_model_nude

    # 2. Add the column to Faculty Requests (0=clothed, 1=nude)
    add_column :faculty_requests, :model_mode, :integer, default: 0
  end
end
