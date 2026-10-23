# One-time cleanup: profiles saved under older option lists (like "Non-Binary")
# are brought up to today's options, so they can be edited and matched again.
class BringProfileValuesUpToDate < ActiveRecord::Migration[8.0]
  def up
    User.reset_column_information
    User.bring_all_profile_values_up_to_date!
  end

  def down
    # Nothing to undo: the old spellings aren't needed
  end
end