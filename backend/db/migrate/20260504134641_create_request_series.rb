class CreateRequestSeries < ActiveRecord::Migration[8.0]
  def change
    create_table :request_series do |t|
      t.string :class_name, null: false
      t.string :department, null: false
      t.string :model_mode, null: false, default: 'clothed'
      t.string :pref_skin_tone, null: false, default: 'Any'
      t.string :pref_gender, null: false, default: 'Any'
      t.string :notes
      t.string :room_number
      t.integer :status, null: false, default: 0
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end