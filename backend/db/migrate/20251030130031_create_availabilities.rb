class CreateAvailabilities < ActiveRecord::Migration[8.0]
  def change
    create_table :availabilities do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.text :notes
      t.integer :status, default: 0, null: false  # 0=pending, 1=requested, 2=confirmed

      t.timestamps
    end

    add_index :availabilities, [:user_id, :starts_at, :ends_at]
  end
end