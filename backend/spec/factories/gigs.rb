FactoryBot.define do
  factory :gig do
    association :faculty_request
    association :art_model_availability
    status { :confirmed }
  end
end