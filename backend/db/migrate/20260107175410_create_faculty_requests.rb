class CreateFacultyRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :faculty_requests do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :starts_at
      t.datetime :ends_at
      t.string :class_name
      t.string :pref_skin_tone
      t.string :pref_gender
      t.string :pref_disability
      t.integer :status

      t.timestamps
    end
  end
end
