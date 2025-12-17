class UpdateSchemaForUserStories < ActiveRecord::Migration[8.0]
  def change
    # 1. For Models: Photos and Profile Images
    # Storing as string URLs for MVP.
    add_column :users, :headshot_url, :string
    add_column :users, :full_body_url, :string
    
    # 2. For Faculty: Flag if the Open Call requires nudity
    add_column :open_calls, :is_nude, :boolean, default: false
  end
end