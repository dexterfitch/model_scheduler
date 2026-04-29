puts "🌱 Seeding Database..."

Gig.destroy_all
FacultyRequest.destroy_all
ArtModelAvailability.destroy_all
User.where.not(email: "dfitch@mica.edu").destroy_all

puts "🧹 Old data wiped."

def create_past_request(attrs)
  r = FacultyRequest.new(attrs)
  r.save(validate: false)
  r
end

def create_past_availability(attrs)
  a = ArtModelAvailability.new(attrs)
  a.save(validate: false)
  a
end

frank = User.create!(
  first_name: "Frank", last_name: "Faculty",
  email: "frank@mica.edu", role: "faculty"
)

sarah = User.create!(
  first_name: "Sarah", last_name: "Sketch",
  email: "sarah@mica.edu", role: "faculty"
)

bob = User.create!(
  first_name: "Bob", last_name: "Brushwork",
  email: "bob@mica.edu", role: "faculty"
)

ruth = User.create!(
  first_name: "Ruth", last_name: "Model",
  email: "ruth@mica.edu", role: "model",
  pronouns: "she/her",
  skin_tone: "Dark", gender_identity: "Female", willing_to_model_nude: true,
  phone: "555-123-4567", stage_name: "Ruthie"
)

mike = User.create!(
  first_name: "Mike", last_name: "Muscle",
  email: "mike@mica.edu", role: "model",
  pronouns: "he/him",
  skin_tone: "Light", gender_identity: "Male", willing_to_model_nude: false,
  phone: "555-987-6543"
)

alex = User.create!(
  first_name: "Alex", last_name: "Andro",
  email: "alex@mica.edu", role: "model",
  pronouns: "they/them",
  skin_tone: "Medium", gender_identity: "Non-Binary", willing_to_model_nude: true,
  phone: "555-555-5555", stage_name: "Alexis"
)

puts "👥 Users created."

two_weeks_ago = 2.weeks.ago

# Ruth: Confirmed - Painting Clothed (3 hrs)
req1 = create_past_request(
  user: frank, class_name: "Portrait Painting I", department: "Painting",
  starts_at: two_weeks_ago.change(hour: 10, min: 0),
  ends_at: two_weeks_ago.change(hour: 13, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail1 = create_past_availability(
  user: ruth,
  starts_at: two_weeks_ago.change(hour: 9, min: 0),
  ends_at: two_weeks_ago.change(hour: 14, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req1, art_model_availability: avail1, status: "confirmed")

# Ruth: Confirmed - Drawing Nude (2 hrs)
req2 = create_past_request(
  user: sarah, class_name: "Figure Drawing 101", department: "Drawing",
  starts_at: (two_weeks_ago + 1.day).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 1.day).change(hour: 11, min: 0),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail2 = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 1.day).change(hour: 8, min: 0),
  ends_at: (two_weeks_ago + 1.day).change(hour: 12, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req2, art_model_availability: avail2, status: "confirmed")

# Ruth: Confirmed - Painting Nude (1.5 hrs)
req3 = create_past_request(
  user: bob, class_name: "Advanced Figure", department: "Painting",
  starts_at: (two_weeks_ago + 2.days).change(hour: 14, min: 0),
  ends_at: (two_weeks_ago + 2.days).change(hour: 15, min: 30),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail3 = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 2.days).change(hour: 13, min: 0),
  ends_at: (two_weeks_ago + 2.days).change(hour: 17, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req3, art_model_availability: avail3, status: "confirmed")

# Ruth: Confirmed - Drawing Clothed (1.75 hrs → rounds to 1.75)
req_round = create_past_request(
  user: frank, class_name: "Quick Sketch Session", department: "Drawing",
  starts_at: (two_weeks_ago + 3.days).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 10, min: 45),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_round = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 3.days).change(hour: 8, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 12, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_round, art_model_availability: avail_round, status: "confirmed")

# Ruth: Confirmed - Illustration Clothed (weird time: 1hr 23min → rounds to 1.25)
req_weird = create_past_request(
  user: sarah, class_name: "Oddly Timed Session", department: "Illustration",
  starts_at: (two_weeks_ago + 3.days).change(hour: 13, min: 7),
  ends_at: (two_weeks_ago + 3.days).change(hour: 14, min: 30),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_weird = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 3.days).change(hour: 12, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 16, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_weird, art_model_availability: avail_weird, status: "confirmed")

# Ruth: Confirmed - Painting Clothed again (accumulates with req1 → total 6 hrs)
req_accum = create_past_request(
  user: bob, class_name: "Portrait Painting II", department: "Painting",
  starts_at: (two_weeks_ago + 4.days).change(hour: 13, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 16, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_accum = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 4.days).change(hour: 12, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 17, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_accum, art_model_availability: avail_accum, status: "confirmed")

# Mike: Confirmed - Sculpture Clothed (2.5 hrs)
req4 = create_past_request(
  user: frank, class_name: "Sculpture I", department: "Sculpture",
  starts_at: two_weeks_ago.change(hour: 13, min: 0),
  ends_at: two_weeks_ago.change(hour: 15, min: 30),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail4 = create_past_availability(
  user: mike,
  starts_at: two_weeks_ago.change(hour: 12, min: 0),
  ends_at: two_weeks_ago.change(hour: 17, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req4, art_model_availability: avail4, status: "confirmed")

# Mike: Confirmed - Illustration Clothed (3 hrs)
req5 = create_past_request(
  user: sarah, class_name: "Costume Drawing", department: "Illustration",
  starts_at: (two_weeks_ago + 3.days).change(hour: 10, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 13, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail5 = create_past_availability(
  user: mike,
  starts_at: (two_weeks_ago + 3.days).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 14, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req5, art_model_availability: avail5, status: "confirmed")

# Mike: Confirmed - weird time (2hr 37min → rounds to 2.75)
req_mike_weird = create_past_request(
  user: bob, class_name: "Extended Life Drawing", department: "Drawing",
  starts_at: (two_weeks_ago + 1.day).change(hour: 9, min: 11),
  ends_at: (two_weeks_ago + 1.day).change(hour: 11, min: 48),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_mike_weird = create_past_availability(
  user: mike,
  starts_at: (two_weeks_ago + 1.day).change(hour: 8, min: 0),
  ends_at: (two_weeks_ago + 1.day).change(hour: 13, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_mike_weird, art_model_availability: avail_mike_weird, status: "confirmed")

# Alex: Confirmed - Illustration Nude (2 hrs)
req6 = create_past_request(
  user: bob, class_name: "Gesture Drawing", department: "Illustration",
  starts_at: (two_weeks_ago + 1.day).change(hour: 14, min: 0),
  ends_at: (two_weeks_ago + 1.day).change(hour: 16, min: 0),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail6 = create_past_availability(
  user: alex,
  starts_at: (two_weeks_ago + 1.day).change(hour: 13, min: 0),
  ends_at: (two_weeks_ago + 1.day).change(hour: 17, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req6, art_model_availability: avail6, status: "confirmed")

# Alex: Confirmed - Drawing Clothed (1.5 hrs)
req7 = create_past_request(
  user: frank, class_name: "Life Drawing", department: "Drawing",
  starts_at: (two_weeks_ago + 4.days).change(hour: 10, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 11, min: 30),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail7 = create_past_availability(
  user: alex,
  starts_at: (two_weeks_ago + 4.days).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 13, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req7, art_model_availability: avail7, status: "confirmed")

# Alex: Confirmed - weird time (1hr 53min → rounds to 2.0)
req_alex_weird = create_past_request(
  user: sarah, class_name: "Experimental Figure", department: "FYE",
  starts_at: (two_weeks_ago + 2.days).change(hour: 10, min: 22),
  ends_at: (two_weeks_ago + 2.days).change(hour: 12, min: 15),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_alex_weird = create_past_availability(
  user: alex,
  starts_at: (two_weeks_ago + 2.days).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 2.days).change(hour: 14, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_alex_weird, art_model_availability: avail_alex_weird, status: "confirmed")

puts "✅ Past confirmed gigs created."

# --- CANCELLED GIGS ---

# Ruth: Cancelled NOT late (billable: false)
req8 = create_past_request(
  user: sarah, class_name: "Watercolor Figure", department: "Painting",
  starts_at: (two_weeks_ago + 2.days).change(hour: 10, min: 0),
  ends_at: (two_weeks_ago + 2.days).change(hour: 12, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "archived"
)
avail8 = create_past_availability(
  user: ruth,
  starts_at: (two_weeks_ago + 2.days).change(hour: 9, min: 0),
  ends_at: (two_weeks_ago + 2.days).change(hour: 13, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req8, art_model_availability: avail8, status: "cancelled", billable: false)

# Mike: Cancelled LATE (billable: true) ⚠️
req9 = create_past_request(
  user: bob, class_name: "Emergency Substitute", department: "Drawing",
  starts_at: (two_weeks_ago + 3.days).change(hour: 14, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 16, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "archived"
)
avail9 = create_past_availability(
  user: mike,
  starts_at: (two_weeks_ago + 3.days).change(hour: 13, min: 0),
  ends_at: (two_weeks_ago + 3.days).change(hour: 17, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req9, art_model_availability: avail9, status: "cancelled", billable: true)

# Alex: Cancelled LATE (billable: true) ⚠️
req10 = create_past_request(
  user: sarah, class_name: "Illustration Workshop", department: "Illustration",
  starts_at: (two_weeks_ago + 4.days).change(hour: 13, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 15, min: 0),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Any", status: "archived"
)
avail10 = create_past_availability(
  user: alex,
  starts_at: (two_weeks_ago + 4.days).change(hour: 12, min: 0),
  ends_at: (two_weeks_ago + 4.days).change(hour: 16, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req10, art_model_availability: avail10, status: "cancelled", billable: true)

puts "✅ Past cancelled gigs created."

# --- SAME-DAY BILLABLE LOGIC TESTS ---

# A Gig for TODAY (confirmed, should be billable if cancelled today)
req_today = create_past_request(
  user: frank, class_name: "Today's Class", department: "Painting",
  starts_at: Time.current.change(hour: 14, min: 0),
  ends_at: Time.current.change(hour: 17, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_today = create_past_availability(
  user: ruth,
  starts_at: Time.current.change(hour: 13, min: 0),
  ends_at: Time.current.change(hour: 18, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_today, art_model_availability: avail_today, status: "confirmed")

# A Gig for TOMORROW (confirmed, should NOT be billable if cancelled today)
req_tomorrow = create_past_request(
  user: sarah, class_name: "Tomorrow's Class", department: "Drawing",
  starts_at: 1.day.from_now.change(hour: 10, min: 0),
  ends_at: 1.day.from_now.change(hour: 13, min: 0),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Any", status: "matched"
)
avail_tomorrow = create_past_availability(
  user: ruth,
  starts_at: 1.day.from_now.change(hour: 9, min: 0),
  ends_at: 1.day.from_now.change(hour: 14, min: 0),
  status: "active"
)
Gig.create!(faculty_request: req_tomorrow, art_model_availability: avail_tomorrow, status: "confirmed")

puts "🧪 Same-day billable logic test gigs created."

# --- PENDING REQUESTS (future, unmatched) ---
FacultyRequest.create!(
  user: frank, class_name: "Figure Drawing 101", department: "Drawing",
  starts_at: DateTime.now.next_week(:monday).change(hour: 9, min: 0),
  ends_at: DateTime.now.next_week(:monday).change(hour: 12, min: 0),
  model_mode: "nude", pref_skin_tone: "Any", pref_gender: "Female", status: "pending"
)

FacultyRequest.create!(
  user: sarah, class_name: "Costume Gestures", department: "Illustration",
  starts_at: DateTime.now.next_week(:tuesday).change(hour: 14, min: 0),
  ends_at: DateTime.now.next_week(:tuesday).change(hour: 16, min: 0),
  model_mode: "clothed", pref_skin_tone: "Light", pref_gender: "Any", status: "pending"
)

puts "📝 Pending requests created."

# --- FREE AVAILABILITY (future, unbooked) ---
ArtModelAvailability.create!(
  user: mike,
  starts_at: DateTime.now.next_week(:monday).change(hour: 8, min: 0),
  ends_at: DateTime.now.next_week(:monday).change(hour: 17, min: 0),
  status: "active"
)

ArtModelAvailability.create!(
  user: alex,
  starts_at: DateTime.now.next_week(:tuesday).change(hour: 13, min: 0),
  ends_at: DateTime.now.next_week(:tuesday).change(hour: 18, min: 0),
  status: "active"
)

# --- RUTH: Future availability so she can be matched to pending requests ---
ArtModelAvailability.create!(
  user: ruth,
  starts_at: DateTime.now.next_week(:monday).change(hour: 8, min: 0),
  ends_at: DateTime.now.next_week(:monday).change(hour: 17, min: 0),
  status: "active"
)

ArtModelAvailability.create!(
  user: ruth,
  starts_at: DateTime.now.next_week(:tuesday).change(hour: 13, min: 0),
  ends_at: DateTime.now.next_week(:tuesday).change(hour: 18, min: 0),
  status: "active"
)

# --- A pending request with NO available models (to test empty match state) ---
FacultyRequest.create!(
  user: bob, class_name: "No Models Available Test", department: "Sculpture",
  starts_at: DateTime.now.next_week(:wednesday).change(hour: 9, min: 0),
  ends_at: DateTime.now.next_week(:wednesday).change(hour: 12, min: 0),
  model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", status: "pending"
)

puts "📅 Free availability created."
puts "🌿 Seeding Complete!"