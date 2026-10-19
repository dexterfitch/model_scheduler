class AddBodyTypeGenitaliaAndModelsNeeded < ActiveRecord::Migration[8.0]
  def change
    # Model profile attributes (optional; genitalia only kept for nude-willing models)
    add_column :users, :body_type, :string
    add_column :users, :genitalia, :string

    # Faculty preferences + how many models should sit the session
    add_column :faculty_requests, :pref_body_type, :string, default: "Any", null: false
    add_column :faculty_requests, :pref_genitalia, :string, default: "Any", null: false
    add_column :faculty_requests, :models_needed, :integer, default: 1, null: false

    add_column :request_series, :pref_body_type, :string, default: "Any", null: false
    add_column :request_series, :pref_genitalia, :string, default: "Any", null: false
    add_column :request_series, :models_needed, :integer, default: 1, null: false
  end
end
