class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string  :first_name,      null: false
      t.string  :last_name,       null: false
      t.string  :email,           null: false
      t.integer :role,            null: false, default: 0   # 0=model, 1=faculty, 2=admin
      t.string  :password_digest, null: false
      t.boolean :nude_model,      null: false, default: false
      t.timestamps
    end

    add_index :users, :email, unique: true
  end
end