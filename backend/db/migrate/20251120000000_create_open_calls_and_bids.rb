class CreateOpenCallsAndBids < ActiveRecord::Migration[8.0]
  def change
    # 1. The Job Postings (created by Faculty)
    create_table :open_calls do |t|
      t.references :user, null: false, foreign_key: true # The Faculty member
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.string :class_name, null: false
      t.text :notes
      t.integer :status, default: 0, null: false # 0=open, 1=confirmed, 2=cancelled
      
      t.timestamps
    end

    # 2. The Applications (created by Models)
    create_table :bids do |t|
      t.references :open_call, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true # The Model
      t.text :message
      t.integer :status, default: 0, null: false # 0=pending, 1=accepted, 2=rejected

      t.timestamps
    end

    # Enforce that a model can't bid on the same job twice
    add_index :bids, [:open_call_id, :user_id], unique: true
  end
end