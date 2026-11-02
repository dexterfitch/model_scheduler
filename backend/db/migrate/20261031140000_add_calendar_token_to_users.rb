# Adds each person's private calendar link token.
class AddCalendarTokenToUsers < ActiveRecord::Migration[8.0]
  # The token column, unique so a link always finds one person.
  def change
    add_column :users, :calendar_token, :string
    add_index :users, :calendar_token, unique: true
  end
end
