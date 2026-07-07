class AddConfirmedByToGigs < ActiveRecord::Migration[7.1]
  def change
    add_reference :gigs, :confirmed_by, foreign_key: { to_table: :users }, null: true
  end
end