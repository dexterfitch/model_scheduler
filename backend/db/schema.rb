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

ActiveRecord::Schema[8.0].define(version: 2025_11_20_193348) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "availabilities", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.text "notes"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "starts_at", "ends_at"], name: "index_availabilities_on_user_id_and_starts_at_and_ends_at"
    t.index ["user_id"], name: "index_availabilities_on_user_id"
  end

  create_table "bids", force: :cascade do |t|
    t.bigint "open_call_id", null: false
    t.bigint "user_id", null: false
    t.text "message"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["open_call_id", "user_id"], name: "index_bids_on_open_call_id_and_user_id", unique: true
    t.index ["open_call_id"], name: "index_bids_on_open_call_id"
    t.index ["user_id"], name: "index_bids_on_user_id"
  end

  create_table "booking_requests", force: :cascade do |t|
    t.bigint "availability_id", null: false
    t.bigint "faculty_id", null: false
    t.integer "status", default: 0, null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["availability_id", "faculty_id"], name: "index_booking_requests_unique_faculty_per_availability", unique: true
    t.index ["availability_id", "status"], name: "index_booking_requests_unique_approved_per_availability", unique: true, where: "(status = 1)"
    t.index ["availability_id"], name: "index_booking_requests_on_availability_id"
    t.index ["availability_id"], name: "index_booking_requests_on_availability_id_where_pending", unique: true, where: "(status = 0)"
    t.index ["faculty_id"], name: "index_booking_requests_on_faculty_id"
  end

  create_table "open_calls", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.string "class_name", null: false
    t.text "notes"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_nude", default: false
    t.index ["user_id"], name: "index_open_calls_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.integer "role", default: 0, null: false
    t.string "password_digest", null: false
    t.boolean "nude_model", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "headshot_url"
    t.string "full_body_url"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "availabilities", "users"
  add_foreign_key "bids", "open_calls"
  add_foreign_key "bids", "users"
  add_foreign_key "booking_requests", "availabilities"
  add_foreign_key "booking_requests", "users", column: "faculty_id"
  add_foreign_key "open_calls", "users"
end
