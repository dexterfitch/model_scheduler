FactoryBot.define do
  factory :user do
    first_name { "Test" }
    last_name  { "User" }
    sequence(:email) { |n| "test#{n}@mica.edu" }
    role { :faculty }
    superuser { false }

    trait :admin do
      role { :admin }
    end

    trait :superuser do
      role { :admin }
      superuser { true }
    end

    trait :model do
      role { :model }
      skin_tone { "Medium" }
      gender_identity { "Non-Binary" }
      willing_to_model_nude { false }
    end

    trait :nude_model do
      role { :model }
      skin_tone { "Medium" }
      gender_identity { "Woman" }
      willing_to_model_nude { true }
    end
  end
end