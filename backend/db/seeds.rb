# 1. Clean the slate
Gig.destroy_all
FacultyRequest.destroy_all
ArtModelAvailability.destroy_all
User.destroy_all

puts "--- Creating Users ---"

# --- ADMIN ---
admin = User.create!(
  first_name: "Anita",
  last_name: "Admin",
  email: "admin@example.com",
  password: "password",
  role: :admin
)

# --- FACULTY ---
frank = User.create!(
  first_name: "Frank",
  last_name: "Faculty",
  email: "frank@example.com",
  password: "password",
  role: :faculty
)

sarah = User.create!(
  first_name: "Sarah",
  last_name: "Sketch",
  email: "sarah@example.com",
  password: "password",
  role: :faculty
)

# --- MODELS ---
# Ruth: Dark Skin, Female, WILLING to do nude
ruth = User.create!(
  first_name: "Ruth",
  last_name: "Model",
  email: "ruth@example.com",
  password: "password",
  role: :model,
  skin_tone: "Dark",
  gender_identity: "Female",
  disability_status: "None",
  willing_to_model_nude: true
)

# Bob: Light Skin, Male, WILLING to do nude
bob = User.create!(
  first_name: "Bob",
  last_name: "Model",
  email: "bob@example.com",
  password: "password",
  role: :model,
  skin_tone: "Light",
  gender_identity: "Male",
  disability_status: "Amputee",
  willing_to_model_nude: true
)

# Alex: Medium Skin, Non-binary, CLOTHED ONLY
alex = User.create!(
  first_name: "Alex",
  last_name: "Model",
  email: "alex@example.com",
  password: "password",
  role: :model,
  skin_tone: "Medium",
  gender_identity: "Non-Binary",
  disability_status: "None",
  willing_to_model_nude: false
)

puts "--- Creating Availabilities (Next Monday) ---"
next_monday = DateTime.now.next_week.monday

# Ruth is free all day
ArtModelAvailability.create!(user: ruth, starts_at: next_monday.change(hour: 9), ends_at: next_monday.change(hour: 17), status: :active)

# Bob is free in the morning
ArtModelAvailability.create!(user: bob, starts_at: next_monday.change(hour: 9), ends_at: next_monday.change(hour: 12), status: :active)

# Alex is free in the afternoon
ArtModelAvailability.create!(user: alex, starts_at: next_monday.change(hour: 13), ends_at: next_monday.change(hour: 17), status: :active)

puts "--- Creating Faculty Requests (Next Monday) ---"

# Frank needs a NUDE model
FacultyRequest.create!(
  user: frank,
  starts_at: next_monday.change(hour: 10),
  ends_at: next_monday.change(hour: 12),
  class_name: "Portrait Painting I",
  pref_skin_tone: "Dark",
  pref_gender: "Male",
  model_mode: :nude,
  status: :pending
)

# Sarah needs a CLOTHED model (Costume Drawing)
FacultyRequest.create!(
  user: sarah,
  starts_at: next_monday.change(hour: 14),
  ends_at: next_monday.change(hour: 16),
  class_name: "Costume Drawing II",
  pref_skin_tone: "Light",
  pref_gender: "Female",
  model_mode: :clothed,
  status: :pending
)

puts "Seeding complete!"