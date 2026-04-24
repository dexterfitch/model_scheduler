FactoryBot.define do
  factory :art_model_availability do
    association :user, factory: [:user, :model]
    starts_at { 1.week.from_now.change(hour: 8, min: 0) }
    ends_at   { 1.week.from_now.change(hour: 17, min: 0) }
    status { :active }
  end
end