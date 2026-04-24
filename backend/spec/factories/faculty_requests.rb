FactoryBot.define do
  factory :faculty_request do
    association :user, factory: [:user, :faculty]
    class_name { "Figure Drawing 101" }
    department { "Drawing" }
    starts_at { 1.week.from_now.change(hour: 10, min: 0) }
    ends_at   { 1.week.from_now.change(hour: 12, min: 0) }
    model_mode { :clothed }
    pref_skin_tone { "Any" }
    pref_gender { "Any" }
    status { :pending }
  end
end