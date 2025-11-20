import axios from 'axios';

const API_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
});

// --- API ACTIONS ---

// 1. FOR MODELS: Create a new availability slot
export const createAvailability = (data) => {
  // We need to check who is logged in to send the email param
  const user = JSON.parse(localStorage.getItem('currentUser')); 
  // Note: In a real app, we wouldn't rely on localStorage for the email param like this, 
  // but for this 'Login as...' dev setup, we need to pass the email manually.
  
  // If you haven't saved the user to localStorage in App.jsx (we aren't currently), 
  // we need to assume the component passed the email in 'data' or handle it differently.
  // Let's stick to the pattern we used in App.jsx: passing data directly.
  
  return api.post('/availabilities', data); 
  // Note: Ensure 'data' object includes { email: '...', starts_at: '...', ... }
};

// 2. FOR MODELS: Get my own schedule
export const getMySchedule = (email) => {
  return api.get(`/availabilities?email=${email}`);
};

// 3. FOR FACULTY/ADMIN: Get open slots (Marketplace)
export const getOpenSlots = (email) => {
  return api.get(`/availabilities/open?email=${email}`);
};

// 4. FOR FACULTY: Request a booking
export const createBookingRequest = (email, availabilityId, notes) => {
  return api.post('/booking_requests', {
    email: email,
    availability_id: availabilityId,
    notes: notes
  });
};

// 5. FOR ADMIN: Get all booking requests
export const getBookingRequests = (email) => {
  return api.get(`/booking_requests?email=${email}`);
};

// 6. FOR ADMIN: Approve a request
export const approveRequest = (email, requestId) => {
  return api.post(`/booking_requests/${requestId}/approve`, { email });
};

// 7. FOR ADMIN: Deny a request
export const denyRequest = (email, requestId) => {
  return api.post(`/booking_requests/${requestId}/deny`, { email });
};

// 8. FOR MODELS: Delete an availability slot
export const deleteAvailability = (email, availabilityId) => {
  // Axios DELETE requires the body to be inside a 'data' key
  return api.delete(`/availabilities/${availabilityId}`, {
    data: { email: email }
  });
};

export default api;