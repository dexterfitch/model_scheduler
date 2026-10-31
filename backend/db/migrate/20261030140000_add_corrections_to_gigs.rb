# Lets an admin fix the record of a gig after its class happened: a no-show flag,
# the hours really worked, and a log of every correction.
class AddCorrectionsToGigs < ActiveRecord::Migration[8.0]
  # Adds the no-show flag and worked hours to gigs, and the gig_corrections table.
  def change
    add_column :gigs, :no_show, :boolean, default: false, null: false
    add_column :gigs, :worked_starts_at, :datetime
    add_column :gigs, :worked_ends_at, :datetime

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
