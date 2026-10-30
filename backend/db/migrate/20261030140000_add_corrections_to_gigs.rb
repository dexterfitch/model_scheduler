# Lets an admin fix the record of a gig after the class has happened:
# a no-show, paid or not paid, the hours really worked, or who covered.
class AddCorrectionsToGigs < ActiveRecord::Migration[8.0]
  def change
    add_column :gigs, :no_show, :boolean, default: false, null: false
    # Set only when the hours worked differ from the class's booked times
    add_column :gigs, :worked_starts_at, :datetime
    add_column :gigs, :worked_ends_at, :datetime

    # One row per correction, so there's a history of who changed what and why
    create_table :gig_corrections do |t|
      t.references :gig, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :summary, null: false
      t.text :note
      t.timestamps
    end
  end
end
