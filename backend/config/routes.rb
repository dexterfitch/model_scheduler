Rails.application.routes.draw do
  resources :users, only: [:index, :show]
  resources :art_model_availabilities, only: [:index, :create, :destroy]
  resources :faculty_requests, only: [:index, :create, :destroy]
  resources :gigs, only: [:index, :create, :destroy, :update]
end