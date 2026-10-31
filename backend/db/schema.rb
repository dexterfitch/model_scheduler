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

ActiveRecord::Schema[8.0].define(version: 2026_10_31_120000) do
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
    t.index ["user_id", "starts_at", "ends_at"], name: "idx_availability_lookup"
    t.index ["user_id"], name: "index_art_model_availabilities_on_user_id"
  end

  create_table "faculty_requests", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "department"
    t.string "class_name"
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.integer "model_mode", default: 0
    t.string "pref_skin_tone"
    t.string "pref_gender"
    t.integer "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "notes"
    t.string "room_number"
    t.integer "request_series_id"
    t.string "building"
    t.boolean "needs_attention", default: false, null: false
    t.string "pref_body_type", default: "Any", null: false
    t.string "pref_genitalia", default: "Any", null: false
    t.integer "models_needed", default: 1, null: false
    t.index ["request_series_id"], name: "index_faculty_requests_on_request_series_id"
    t.index ["user_id"], name: "index_faculty_requests_on_user_id"
  end

  create_table "gig_corrections", force: :cascade do |t|
    t.bigint "gig_id", null: false
    t.bigint "user_id", null: false
    t.string "kind", null: false
    t.string "summary", null: false
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["gig_id"], name: "index_gig_corrections_on_gig_id"
    t.index ["user_id"], name: "index_gig_corrections_on_user_id"
  end

  create_table "gigs", force: :cascade do |t|
    t.bigint "faculty_request_id", null: false
    t.bigint "art_model_availability_id", null: false
    t.integer "status", default: 0, null: false
    t.boolean "billable"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "confirmed_by_id"
    t.integer "model_slot_position"
    t.boolean "no_show", default: false, null: false
    t.datetime "worked_starts_at"
    t.datetime "worked_ends_at"
    t.index ["art_model_availability_id"], name: "index_gigs_on_art_model_availability_id"
    t.index ["confirmed_by_id"], name: "index_gigs_on_confirmed_by_id"
    t.index ["faculty_request_id"], name: "index_gigs_on_faculty_request_id"
  end

  create_table "model_slots", force: :cascade do |t|
    t.bigint "request_series_id", null: false
    t.integer "position", null: false
    t.string "pref_skin_tone", default: "Any", null: false
    t.string "pref_gender", default: "Any", null: false
    t.string "pref_body_type", default: "Any", null: false
    t.string "pref_genitalia", default: "Any", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["request_series_id", "position"], name: "index_model_slots_on_request_series_id_and_position", unique: true
    t.index ["request_series_id"], name: "index_model_slots_on_request_series_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "kind", null: false
    t.string "title", null: false
    t.json "dates", default: [], null: false
    t.boolean "paid"
    t.string "about"
    t.string "group_key", null: false
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "read_at"], name: "index_notifications_on_user_id_and_read_at"
    t.index ["user_id", "updated_at"], name: "index_notifications_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "request_series", force: :cascade do |t|
    t.string "class_name", null: false
    t.string "department", null: false
    t.string "model_mode", default: "clothed", null: false
    t.string "pref_skin_tone", default: "Any", null: false
    t.string "pref_gender", default: "Any", null: false
    t.string "notes"
    t.string "room_number"
    t.integer "status", default: 0, null: false
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "building"
    t.string "pref_body_type", default: "Any", null: false
    t.string "pref_genitalia", default: "Any", null: false
    t.integer "models_needed", default: 1, null: false
    t.index ["user_id"], name: "index_request_series_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.integer "role"
    t.boolean "superuser", default: false
    t.string "phone"
    t.string "stage_name"
    t.string "pronouns"
    t.string "skin_tone"
    t.string "gender_identity"
    t.boolean "willing_to_model_nude", default: false, null: false
    t.string "image_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "body_type"
    t.string "genitalia"
    t.integer "token_version", default: 0, null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "art_model_availabilities", "users"
  add_foreign_key "faculty_requests", "users"
  add_foreign_key "gig_corrections", "gigs"
  add_foreign_key "gig_corrections", "users"
  add_foreign_key "gigs", "art_model_availabilities"
  add_foreign_key "gigs", "faculty_requests"
  add_foreign_key "gigs", "users", column: "confirmed_by_id"
  add_foreign_key "model_slots", "request_series"
  add_foreign_key "notifications", "users"
  add_foreign_key "request_series", "users"
end
