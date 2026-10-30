Rails.application.routes.draw do
  resources :users, only: [:index, :show, :update, :create] do
    member do
      post "promote"
      post "promote_to_superuser"
    end
  end

  resources :art_model_availabilities, only: [:index, :create, :destroy, :update] do
    member do
      post "cancel"
    end
  end

  resources :faculty_requests, only: [:index, :create, :update, :destroy]
  resources :gigs, only: [:index, :create, :destroy]
  # Fixing the record of a gig after its class happened
  post "gigs/:id/corrections", to: "gigs#correct"

  # A SuperUser clearing the classes and availability they made while testing
  get "test_data", to: "test_data#show"
  delete "test_data", to: "test_data#destroy"

  resources :request_series, only: [:index, :create, :destroy, :update] do
    collection do
      get "available_for_model"
    end
    member do
      post "release_remaining"
    end
  end

  get "/auth/:provider/callback", to: "sessions#omniauth"
  get "/auth/failure", to: redirect("/")
  get "/me", to: "sessions#me"
  delete "/logout", to: "sessions#destroy"
  post "/select_role", to: "users#select_role"

  if Rails.env.development?
    post "/test_login", to: "sessions#test_login"
    get "/test_login", to: "sessions#test_login"
  end
end
