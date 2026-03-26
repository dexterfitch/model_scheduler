class InitialSchema < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :email, null: false
      t.integer :role, default: 0, null: false
      t.boolean :superuser, default: false
      t.string :password_digest
      t.string :phone
      t.string :stage_name
      t.string :pronouns
      t.string :skin_tone
      t.string :gender_identity
      t.boolean :willing_to_model_nude, default: false, null: false
      t.string :image_url
      t.timestamps
    end
    add_index :users, :email, unique: true

    create_table :art_model_availabilities do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.text :notes
      t.integer :status, default: 0, null: false
      t.timestamps
    end
    add_index :art_model_availabilities, [:user_id, :starts_at, :ends_at], name: "idx_availability_lookup"

    create_table :faculty_requests do |t|
      t.references :user, null: false, foreign_key: true
      t.string :department
      t.string :class_name
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.integer :model_mode, default: 0
      t.string :pref_skin_tone
      t.string :pref_gender
      t.integer :status, default: 0, null: false
      t.timestamps
    end

    create_table :gigs do |t|
      t.references :faculty_request, null: false, foreign_key: true
      t.references :art_model_availability, null: false, foreign_key: true
      t.integer :status, default: 0, null: false
      t.boolean :billable, default: false, null: false
      t.timestamps
    end
  end
end