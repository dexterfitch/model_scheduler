Rails.application.routes.draw do
  resources :users, only: [:index, :show, :update]
  resources :art_model_availabilities, only: [:index, :create, :destroy, :update] 
  resources :faculty_requests, only: [:index, :create, :destroy]
  resources :gigs, only: [:index, :create, :destroy, :update]

  # Google Auth Routes
  get '/auth/:provider/callback', to: 'sessions#omniauth'
  get '/auth/failure', to: redirect('/') # Handle failures
end