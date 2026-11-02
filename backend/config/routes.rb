# The API's addresses and which controller action answers each.

Rails.application.routes.draw do
  resources :users, only: [:index, :show, :update, :create] do
    member do
      post "promote"
      post "promote_to_superuser"
      post "retire"
      post "reinstate"
      post "remove_data"
    end
  end

  resources :art_model_availabilities, only: [:index, :create, :destroy, :update] do
    member do
      post "cancel"
    end
  end

  resources :faculty_requests, only: [:index, :create, :update, :destroy]
  resources :gigs, only: [:index, :create, :destroy]
  post "gigs/:id/corrections", to: "gigs#correct"

  get "calendar_link", to: "calendar_feeds#link"
  post "calendar_link/reset", to: "calendar_feeds#reset"
  get "calendar/:token", to: "calendar_feeds#show"

  get "notifications", to: "notifications#index"
  post "notifications/read", to: "notifications#read"

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
