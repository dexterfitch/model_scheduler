Rails.application.routes.draw do
  resources :users, only: [:index, :show, :update, :create] do
    member do
      post "promote"
      post "promote_to_superuser"
    end
  end

  resources :art_model_availabilities, only: [:index, :create, :destroy, :update]
  resources :faculty_requests, only: [:index, :create, :destroy]
  resources :gigs, only: [:index, :create, :destroy, :update]

  get "/auth/:provider/callback", to: "sessions#omniauth"
  get "/auth/failure", to: redirect("/")
  get "/me", to: "sessions#me"
  delete "/logout", to: "sessions#destroy"
  post "/select_role", to: "users#select_role"

  if Rails.env.development?
    post "/test_login", to: "sessions#test_login"
  end
end