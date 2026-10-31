# Test bookings: a confirmed gig of a model into a class date.

FactoryBot.define do
  factory :gig do
    association :faculty_request
    association :art_model_availability
    status { :confirmed }
  end
end
