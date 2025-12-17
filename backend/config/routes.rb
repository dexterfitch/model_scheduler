Rails.application.routes.draw do
  # --- Booking Requests ---
  get "/booking_requests", to: "booking_requests#index"
  post "/booking_requests", to: "booking_requests#create"
  delete "/booking_requests/:id", to: "booking_requests#destroy"
  
  # New routes for Approve/Deny pointing to the MAIN controller
  post "/booking_requests/:id/approve", to: "booking_requests#approve"
  post "/booking_requests/:id/deny",    to: "booking_requests#deny"

  # --- Availabilities ---
  get "/availabilities/open", to: "availabilities#open"
  get "/availabilities", to: "availabilities#index"
  post "/availabilities", to: "availabilities#create"
  delete "/availabilities/:id", to: "availabilities#destroy"

  # --- Open Calls & Bids ---
  get  "/open_calls", to: "open_calls#index"
  post "/open_calls", to: "open_calls#create"
  
  post "/open_calls/:open_call_id/bids", to: "bids#create"
  post "/bids/:id/accept", to: "bids#accept"
end