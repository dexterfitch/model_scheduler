class RenameAvailabilitiesToArtModelAvailabilities < ActiveRecord::Migration[8.0]
  def change
    rename_table :availabilities, :art_model_availabilities
  end
end