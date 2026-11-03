# Adds History: who changed what in the app, when, and the note they gave.
class CreateHistoryEntries < ActiveRecord::Migration[8.0]
  # The history_entries table. The class is kept as a plain id so entries outlive it.
  def change
    create_table :history_entries do |t|
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :action, null: false
      t.text :summary, null: false
      t.text :note
      t.bigint :request_series_id
      t.timestamps
    end
    add_index :history_entries, :request_series_id
  end
end
