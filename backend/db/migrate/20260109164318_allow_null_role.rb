class AllowNullRole < ActiveRecord::Migration[8.0]
  def change
    change_column_null :users, :role, true
  end
end
