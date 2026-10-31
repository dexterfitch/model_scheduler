# Test free time: a model's 9 AM to 5 PM block a week from now.

FactoryBot.define do
  factory :art_model_availability do
    association :user, factory: [:user, :model]
    starts_at { 7.days.from_now.change(hour: 9) }
    ends_at { starts_at + 8.hours }
    status { :active }
  end
end
