# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_01_08_184042) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "art_model_availabilities", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.text "notes"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "starts_at", "ends_at"], name: "idx_on_user_id_starts_at_ends_at_19e655ab12"
    t.index ["user_id"], name: "index_art_model_availabilities_on_user_id"
  end

  create_table "faculty_requests", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.string "class_name"
    t.string "pref_skin_tone"
    t.string "pref_gender"
    t.string "pref_disability"
    t.integer "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "model_mode", default: 0
    t.string "department"
    t.index ["user_id"], name: "index_faculty_requests_on_user_id"
  end

  create_table "gigs", force: :cascade do |t|
    t.bigint "faculty_request_id", null: false
    t.bigint "art_model_availability_id", null: false
    t.integer "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["art_model_availability_id"], name: "index_gigs_on_art_model_availability_id"
    t.index ["faculty_request_id"], name: "index_gigs_on_faculty_request_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.integer "role", default: 0, null: false
    t.string "password_digest", null: false
    t.boolean "willing_to_model_nude", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "headshot_url"
    t.string "full_body_url"
    t.string "skin_tone"
    t.string "gender_identity"
    t.string "disability_status"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "art_model_availabilities", "users"
  add_foreign_key "faculty_requests", "users"
  add_foreign_key "gigs", "art_model_availabilities"
  add_foreign_key "gigs", "faculty_requests"
end
