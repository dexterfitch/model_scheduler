class AddBillableToGigs < ActiveRecord::Migration[8.0]
  def change
    add_column :gigs, :billable, :boolean
  end
end
