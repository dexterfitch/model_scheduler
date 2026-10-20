FactoryBot.define do
  factory :request_series do
    association :user
    class_name { "Figure Drawing I" }
    department { "Drawing" }
    building { "Main" }
    model_mode { "clothed" }
    status { :pending }
  end
end