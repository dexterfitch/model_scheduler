FactoryBot.define do
  factory :user do
    first_name { "Test" }
    last_name { "User" }
    sequence(:email) { |n| "user#{n}@mica.edu" }
    role { :faculty }

    trait :admin do
      role { :admin }
    end

    trait :model do
      role { :model }
      gender_identity { "Woman" }
      skin_tone { "Medium" }
      willing_to_model_nude { false }
    end

    trait :nude_ok do
      willing_to_model_nude { true }
    end
  end
end