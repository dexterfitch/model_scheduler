# db/seeds.rb

puts "🌱 Seeding Database..."

# 1. Clean up (Order matters due to foreign keys)
Gig.destroy_all
FacultyRequest.destroy_all
ArtModelAvailability.destroy_all
User.destroy_all

puts "🧹 Old data wiped."

# 2. Create Users
anita = User.create!(
  first_name: "Anita", last_name: "Admin", 
  email: "admin@artschool.edu", password: "password", role: 'admin'
)

frank = User.create!(
  first_name: "Frank", last_name: "Faculty", 
  email: "frank@artschool.edu", password: "password", role: 'faculty'
)

sarah = User.create!(
  first_name: "Sarah", last_name: "Sketch", 
  email: "sarah@artschool.edu", password: "password", role: 'faculty'
)

ruth = User.create!(
  first_name: "Ruth", last_name: "Model", 
  email: "ruth@artschool.edu", password: "password", role: 'model', 
  skin_tone: "Dark", gender_identity: "Female", willing_to_model_nude: true
)

mike = User.create!(
  first_name: "Mike", last_name: "Muscle", 
  email: "mike@artschool.edu", password: "password", role: 'model',
  skin_tone: "Light", gender_identity: "Male", willing_to_model_nude: false
)

alex = User.create!(
  first_name: "Alex", last_name: "Andro", 
  email: "alex@artschool.edu", password: "password", role: 'model',
  skin_tone: "Medium", gender_identity: "Non-Binary", willing_to_model_nude: true
)

puts "👥 Users created."

# 3. Create Pending Requests (Unmatched)
# Frank needs a model next Monday
FacultyRequest.create!(
  user: frank,
  class_name: "Figure Drawing 101",
  department: "Drawing",
  starts_at: DateTime.now.next_week(:monday).change(hour: 9, min: 0),
  ends_at: DateTime.now.next_week(:monday).change(hour: 12, min: 0),
  model_mode: 'nude',
  pref_skin_tone: 'Any',
  pref_gender: 'Female',
  pref_disability: 'Any', # <--- ADDED
  status: 'pending'
)

# Sarah needs a model next Tuesday - PREFERS DISABILITY VISIBILITY
FacultyRequest.create!(
  user: sarah,
  class_name: "Costume Gestures",
  department: "Illustration",
  starts_at: DateTime.now.next_week(:tuesday).change(hour: 14, min: 0),
  ends_at: DateTime.now.next_week(:tuesday).change(hour: 16, min: 0),
  model_mode: 'clothed',
  pref_skin_tone: 'Light',
  pref_gender: 'Any',
  pref_disability: 'Yes', # <--- ADDED (Specific Preference)
  status: 'pending'
)

puts "📝 Pending requests created."

# 4. Create Free Availability (Unbooked)
# Mike is free all day Monday
ArtModelAvailability.create!(
  user: mike,
  starts_at: DateTime.now.next_week(:monday).change(hour: 8, min: 0),
  ends_at: DateTime.now.next_week(:monday).change(hour: 17, min: 0),
  status: 'active'
)

# Alex is free Tuesday afternoon
ArtModelAvailability.create!(
  user: alex,
  starts_at: DateTime.now.next_week(:tuesday).change(hour: 13, min: 0),
  ends_at: DateTime.now.next_week(:tuesday).change(hour: 18, min: 0),
  status: 'active'
)

puts "📅 Free availability created."

# 5. Create CONFIRMED GIGS
# Frank has a "Portrait Painting" class next Friday
req = FacultyRequest.create!(
  user: frank,
  class_name: "Portrait Painting I",
  department: "Painting",
  starts_at: DateTime.now.next_week(:friday).change(hour: 10, min: 0),
  ends_at: DateTime.now.next_week(:friday).change(hour: 13, min: 0),
  model_mode: 'clothed',
  pref_skin_tone: 'Dark',
  pref_gender: 'Female',
  pref_disability: 'Any', # <--- ADDED
  status: 'matched'
)

avail = ArtModelAvailability.create!(
  user: ruth,
  starts_at: DateTime.now.next_week(:friday).change(hour: 10, min: 0),
  ends_at: DateTime.now.next_week(:friday).change(hour: 13, min: 0),
  status: 'active'
)

Gig.create!(
  faculty_request: req,
  art_model_availability: avail,
  status: 'confirmed'
)

puts "✅ Confirmed Gigs created."
puts "🌿 Seeding Complete!"