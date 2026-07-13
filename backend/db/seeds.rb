puts "🌱 Seeding Database..."

Gig.delete_all
FacultyRequest.delete_all
RequestSeries.delete_all
ArtModelAvailability.delete_all
User.where.not(email: "dfitch@mica.edu").delete_all

puts "🧹 Old data wiped."

puts "Creating users..."

# --- Admins ---
superadmin = User.find_or_create_by(email: "dfitch@mica.edu") do |u|
  u.first_name = "Dexter"
  u.last_name = "Fitch"
  u.role = :admin
  u.superuser = true
end
superadmin.update!(role: :admin, superuser: true)

admin2 = User.create!(
  first_name: "Pat", last_name: "Reyes", email: "preyes@mica.edu",
  role: :admin
)

# --- Faculty ---
faculty1 = User.create!(
  first_name: "Alice", last_name: "Chen", email: "achen@mica.edu", role: :faculty
)
faculty2 = User.create!(
  first_name: "Marcus", last_name: "Bell", email: "mbell@mica.edu", role: :faculty
)
faculty3 = User.create!(
  first_name: "Priya", last_name: "Nair", email: "pnair@mica.edu", role: :faculty
)

# --- Models ---
model1 = User.create!(
  first_name: "Jordan", last_name: "Ellis", email: "jellis@mica.edu", role: :model,
  skin_tone: "Medium", gender_identity: "Non-binary", willing_to_model_nude: true,
  stage_name: "Jae", pronouns: "they/them"
)
model2 = User.create!(
  first_name: "Sofia", last_name: "Marsh", email: "smarsh@mica.edu", role: :model,
  skin_tone: "Light", gender_identity: "Woman", willing_to_model_nude: false,
  pronouns: "she/her"
)
model3 = User.create!(
  first_name: "Devon", last_name: "Price", email: "dprice@mica.edu", role: :model,
  skin_tone: "Dark", gender_identity: "Man", willing_to_model_nude: true,
  pronouns: "he/him"
)
model4 = User.create!(
  first_name: "Riley", last_name: "Okafor", email: "rokafor@mica.edu", role: :model,
  skin_tone: "Medium", gender_identity: "Prefer not to say", willing_to_model_nude: false
)
model5 = User.create!(
  first_name: "Sam", last_name: "Woods", email: "swoods@mica.edu", role: :model,
  skin_tone: "Light", gender_identity: "Man", willing_to_model_nude: true,
  pronouns: "he/him"
)
sock_model = User.create!(
  first_name: "🧦 Test", last_name: "Tester", email: "socktester@mica.edu", role: :model,
  skin_tone: "Medium", gender_identity: "Woman", willing_to_model_nude: false,
  stage_name: "Offline Test Account"
)

puts "Building scenarios..."

# Helper to create a matched gig cleanly (mirrors gigs_controller#create side effects)
def book!(faculty_request, availability, confirmed_by:)
  gig = Gig.create!(faculty_request: faculty_request, art_model_availability: availability, confirmed_by: confirmed_by)
  faculty_request.update!(status: :matched, needs_attention: false)
  faculty_request.request_series&.update_status!
  gig
end

# ============================================================
# SCENARIO A: Fresh pending single-date request (standalone, no series)
# ============================================================
FacultyRequest.create!(
  user: faculty1, class_name: "Figure Drawing 101", department: "Drawing",
  building: "Fox", room_number: "201", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any",
  starts_at: 5.days.from_now.change(hour: 10, min: 0),
  ends_at: 5.days.from_now.change(hour: 12, min: 0),
  status: :pending
)

# ============================================================
# SCENARIO B: Fresh pending multi-date series (3 dates, all pending)
# ============================================================
series_b = RequestSeries.create!(
  user: faculty2, class_name: "Painting II", department: "Painting",
  building: "Main", room_number: "412", model_mode: :nude,
  pref_skin_tone: "Any", pref_gender: "Any", status: :pending
)
[7, 9, 11].each do |days_out|
  FacultyRequest.create!(
    request_series: series_b, user: faculty2, class_name: series_b.class_name,
    department: series_b.department, building: series_b.building, room_number: series_b.room_number,
    model_mode: series_b.model_mode, pref_skin_tone: series_b.pref_skin_tone, pref_gender: series_b.pref_gender,
    starts_at: days_out.days.from_now.change(hour: 9, min: 0),
    ends_at: days_out.days.from_now.change(hour: 12, min: 0),
    status: :pending
  )
end

# ============================================================
# SCENARIO C: Fully matched single-date request (isSingle labels test)
# ============================================================
fr_c = FacultyRequest.create!(
  user: faculty3, class_name: "Sculpture Studio", department: "Sculpture",
  building: "Station", room_number: "5", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any",
  starts_at: 6.days.from_now.change(hour: 13, min: 0),
  ends_at: 6.days.from_now.change(hour: 16, min: 0),
  status: :pending
)
avail_c = ArtModelAvailability.create!(
  user: model3, starts_at: fr_c.starts_at, ends_at: fr_c.ends_at, status: :active
)
book!(fr_c, avail_c, confirmed_by: superadmin)

# ============================================================
# SCENARIO D: Fully matched multi-date series (Edit/Cancel Series plural labels)
# ============================================================
series_d = RequestSeries.create!(
  user: faculty1, class_name: "Illustration Portfolio", department: "Illustration",
  building: "Lazarus", room_number: "300", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any", status: :pending
)
[8, 10].each do |days_out|
  fr = FacultyRequest.create!(
    request_series: series_d, user: faculty1, class_name: series_d.class_name,
    department: series_d.department, building: series_d.building, room_number: series_d.room_number,
    model_mode: series_d.model_mode, pref_skin_tone: series_d.pref_skin_tone, pref_gender: series_d.pref_gender,
    starts_at: days_out.days.from_now.change(hour: 9, min: 0),
    ends_at: days_out.days.from_now.change(hour: 11, min: 0),
    status: :pending
  )
  avail = ArtModelAvailability.create!(user: model2, starts_at: fr.starts_at, ends_at: fr.ends_at, status: :active)
  book!(fr, avail, confirmed_by: admin2)
end

# ============================================================
# SCENARIO E: Mixed series (some matched, some pending) — badges + "Release Model and Rematch"
# ============================================================
series_e = RequestSeries.create!(
  user: faculty2, class_name: "Open Studies Life Drawing", department: "Open Studies",
  building: "Main", room_number: "110", model_mode: :nude,
  pref_skin_tone: "Any", pref_gender: "Any", status: :pending
)
fr_e_matched = FacultyRequest.create!(
  request_series: series_e, user: faculty2, class_name: series_e.class_name,
  department: series_e.department, building: series_e.building, room_number: series_e.room_number,
  model_mode: series_e.model_mode, pref_skin_tone: series_e.pref_skin_tone, pref_gender: series_e.pref_gender,
  starts_at: 4.days.from_now.change(hour: 9, min: 0), ends_at: 4.days.from_now.change(hour: 12, min: 0),
  status: :pending
)
avail_e = ArtModelAvailability.create!(user: model1, starts_at: fr_e_matched.starts_at, ends_at: fr_e_matched.ends_at, status: :active)
book!(fr_e_matched, avail_e, confirmed_by: superadmin)

FacultyRequest.create!(
  request_series: series_e, user: faculty2, class_name: series_e.class_name,
  department: series_e.department, building: series_e.building, room_number: series_e.room_number,
  model_mode: series_e.model_mode, pref_skin_tone: series_e.pref_skin_tone, pref_gender: series_e.pref_gender,
  starts_at: 6.days.from_now.change(hour: 9, min: 0), ends_at: 6.days.from_now.change(hour: 12, min: 0),
  status: :pending
)
series_e.update_status!

# ============================================================
# SCENARIO F: needs_attention flagged pending date (simulates a model cancellation)
# ============================================================
series_f = RequestSeries.create!(
  user: faculty3, class_name: "Anatomy for Artists", department: "Drawing",
  building: "Fox", room_number: "150", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any", status: :pending
)
FacultyRequest.create!(
  request_series: series_f, user: faculty3, class_name: series_f.class_name,
  department: series_f.department, building: series_f.building, room_number: series_f.room_number,
  model_mode: series_f.model_mode, pref_skin_tone: series_f.pref_skin_tone, pref_gender: series_f.pref_gender,
  starts_at: 3.days.from_now.change(hour: 10, min: 0), ends_at: 3.days.from_now.change(hour: 12, min: 0),
  status: :pending, needs_attention: true
)

# ============================================================
# SCENARIO G: Cancelled/archived series, non-billable (cancelled well ahead of time)
# ============================================================
series_g = RequestSeries.create!(
  user: faculty1, class_name: "Ceramics Fundamentals", department: "Sculpture",
  building: "Station", room_number: "12", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any", status: :pending
)
fr_g = FacultyRequest.create!(
  request_series: series_g, user: faculty1, class_name: series_g.class_name,
  department: series_g.department, building: series_g.building, room_number: series_g.room_number,
  model_mode: series_g.model_mode, pref_skin_tone: series_g.pref_skin_tone, pref_gender: series_g.pref_gender,
  starts_at: 9.days.from_now.change(hour: 9, min: 0), ends_at: 9.days.from_now.change(hour: 11, min: 0),
  status: :pending
)
avail_g = ArtModelAvailability.create!(user: model4, starts_at: fr_g.starts_at, ends_at: fr_g.ends_at, status: :active)
gig_g = book!(fr_g, avail_g, confirmed_by: admin2)
fr_g.update!(status: :archived)
gig_g.update!(status: :cancelled, billable: false)
avail_g.update!(status: :active)
series_g.update_status!

# ============================================================
# SCENARIO H: Cancelled gig, billable (same-day late cancellation) — for Reports testing
# ============================================================
fr_h = FacultyRequest.create!(
  user: faculty2, class_name: "Portrait Painting", department: "Painting",
  building: "Main", room_number: "220", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any",
  starts_at: 3.days.from_now.change(hour: 9, min: 0),
  ends_at: 3.days.from_now.change(hour: 12, min: 0),
  status: :pending
)
avail_h = ArtModelAvailability.create!(user: model5, starts_at: fr_h.starts_at, ends_at: fr_h.ends_at, status: :active)
gig_h = book!(fr_h, avail_h, confirmed_by: superadmin)
# Backdate to "today" to simulate a same-day cancellation, bypassing create-time future-date validation
today_start = Time.current.change(hour: 14, min: 0)
today_end = today_start + 2.hours
fr_h.update_columns(starts_at: today_start, ends_at: today_end)
avail_h.update_columns(starts_at: today_start, ends_at: today_end)
gig_h.update_columns(status: Gig.statuses[:cancelled], billable: true)
fr_h.update_columns(status: FacultyRequest.statuses[:archived])
avail_h.update_columns(status: ArtModelAvailability.statuses[:active])

# ============================================================
# SCENARIO I: Standalone pending request with lingering cancelled-gig history
# (tests the FK-safe archive-instead-of-destroy path on FacultyRequestsController#destroy)
# ============================================================
fr_i = FacultyRequest.create!(
  user: faculty3, class_name: "Intro to Figure Modeling", department: "FYE",
  building: "Lazarus", room_number: "101", model_mode: :clothed,
  pref_skin_tone: "Any", pref_gender: "Any",
  starts_at: 7.days.from_now.change(hour: 9, min: 0),
  ends_at: 7.days.from_now.change(hour: 11, min: 0),
  status: :pending
)
avail_i = ArtModelAvailability.create!(user: model1, starts_at: fr_i.starts_at, ends_at: fr_i.ends_at, status: :active)
gig_i = book!(fr_i, avail_i, confirmed_by: admin2)
# Release it the same way gigs_controller#destroy does — preserves the gig, request returns to pending
gig_i.update!(status: :cancelled, billable: false)
fr_i.update!(status: :pending)
avail_i.update!(status: :active)
# fr_i is now pending again, but Gig id=gig_i.id still references it — exactly the scenario that used to crash

# ============================================================
# SCENARIO J: Free/unbooked availability slots on a model's calendar
# ============================================================
[2, 4, 6, 8].each do |days_out|
  ArtModelAvailability.create!(
    user: model2, starts_at: days_out.days.from_now.change(hour: 9, min: 0),
    ends_at: days_out.days.from_now.change(hour: 17, min: 0), status: :active
  )
end
ArtModelAvailability.create!(
  user: model4, starts_at: 3.days.from_now.change(hour: 10, min: 0),
  ends_at: 3.days.from_now.change(hour: 15, min: 0), status: :active
)

# ============================================================
# SCENARIO K: Sock (offline) model with admin-managed availability
# ============================================================
ArtModelAvailability.create!(
  user: sock_model, starts_at: 5.days.from_now.change(hour: 9, min: 0),
  ends_at: 5.days.from_now.change(hour: 17, min: 0), status: :active
)

puts "Done!"
puts "-" * 60
puts "Users created:"
puts "  SuperUser Admin: #{superadmin.email}"
puts "  Admin:           #{admin2.email}"
puts "  Faculty:         #{[faculty1, faculty2, faculty3].map(&:email).join(', ')}"
puts "  Models:          #{[model1, model2, model3, model4, model5].map(&:email).join(', ')}"
puts "  Sock model:      #{sock_model.email}"
puts "-" * 60
puts "RequestSeries: #{RequestSeries.count} | FacultyRequests: #{FacultyRequest.count} | Gigs: #{Gig.count} | Availabilities: #{ArtModelAvailability.count}"
puts "-" * 60
puts "Log in via /test_login?email=<address> in development to become any of the above."

puts "🌿 Seeding Complete!"