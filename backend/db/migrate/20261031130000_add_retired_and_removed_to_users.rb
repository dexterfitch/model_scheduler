# Adds when a model retired from the pool, and when a person's data was removed.
class AddRetiredAndRemovedToUsers < ActiveRecord::Migration[8.0]
  # The two dates on users; empty means still active, and data still held.
  def change
    add_column :users, :retired_at, :datetime
    add_column :users, :removed_at, :datetime
  end
end
