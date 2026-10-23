# One row of preferences per requested model ("Model 1", "Model 2", ...) for classes
# where faculty want a specific mix. Classes with the same preferences for every
# model have no rows here and keep using the series' own preferences.
class CreateModelSlots < ActiveRecord::Migration[8.0]
  def change
    create_table :model_slots do |t|
      t.references :request_series, null: false, foreign_key: true
      t.integer :position, null: false
      t.string :pref_skin_tone, null: false, default: "Any"
      t.string :pref_gender, null: false, default: "Any"
      t.string :pref_body_type, null: false, default: "Any"
      t.string :pref_genitalia, null: false, default: "Any"
      t.timestamps
    end
    add_index :model_slots, [:request_series_id, :position], unique: true

    # Which slot a booking fills (nil for classes without per-model preferences)
    add_column :gigs, :model_slot_position, :integer
  end
end