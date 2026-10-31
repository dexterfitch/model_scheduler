# Adds updates: what each person is told when their gigs or classes change.
class CreateNotifications < ActiveRecord::Migration[8.0]
  # The notifications table: who it's for, what happened, which class and dates,
  # and when it was read.
  def change
    create_table :notifications do |t|
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :title, null: false
      t.json :dates, null: false, default: []
      t.boolean :paid
      t.string :about
      t.string :group_key, null: false
      t.datetime :read_at
      t.timestamps
    end
    add_index :notifications, [:user_id, :read_at]
    add_index :notifications, [:user_id, :updated_at]
  end
end
