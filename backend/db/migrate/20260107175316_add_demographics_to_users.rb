class AddDemographicsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :skin_tone, :string
    add_column :users, :gender_identity, :string
    add_column :users, :disability_status, :string
  end
end
