# Adds the Error Log: unexpected errors from the server and from people's browsers.
class CreateErrorReports < ActiveRecord::Migration[8.0]
  # The error_reports table: what went wrong, where, for whom, and how often.
  def change
    create_table :error_reports do |t|
      t.string :source, null: false
      t.text :message, null: false
      t.text :details
      t.string :path
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :fingerprint, null: false
      t.integer :count, null: false, default: 1
      t.datetime :last_seen_at, null: false
      t.timestamps
    end
    add_index :error_reports, :fingerprint
    add_index :error_reports, :last_seen_at
  end
end
