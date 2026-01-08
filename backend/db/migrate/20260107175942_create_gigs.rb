class CreateGigs < ActiveRecord::Migration[8.0]
  def change
    create_table :gigs do |t|
      t.references :faculty_request, null: false, foreign_key: true
      t.references :art_model_availability, null: false, foreign_key: true
      t.integer :status

      t.timestamps
    end
  end
end
