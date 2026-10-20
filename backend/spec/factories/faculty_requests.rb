FactoryBot.define do
  factory :faculty_request do
    association :user
    class_name { "Figure Drawing I" }
    department { "Drawing" }
    building { "Main" }
    model_mode { :clothed }
    status { :pending }
    starts_at { 7.days.from_now.change(hour: 10) }
    ends_at { starts_at + 2.hours }

    trait :nude do
      model_mode { :nude }
    end
  end
end