import axios from 'axios';

const API_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
});

// --- EXISTING API ACTIONS (Keep these) ---

export const createAvailability = (data) => api.post('/availabilities', data);

export const getMySchedule = (email) => api.get(`/availabilities?email=${email}`);

export const getOpenSlots = (email) => api.get(`/availabilities/open?email=${email}`);

export const createBookingRequest = (email, availabilityId, notes) => {
  return api.post('/booking_requests', {
    email: email,
    availability_id: availabilityId,
    notes: notes
  });
};

export const getBookingRequests = (email) => api.get(`/booking_requests?email=${email}`);

export const approveRequest = (email, requestId) => {
  return api.post(`/booking_requests/${requestId}/approve`, { email });
};

export const denyRequest = (email, requestId) => {
  return api.post(`/booking_requests/${requestId}/deny`, { email });
};

export const deleteAvailability = (email, availabilityId) => {
  return api.delete(`/availabilities/${availabilityId}`, {
    data: { email: email }
  });
};

// --- NEW: OPEN CALLS (JOB BOARD) ---

// 1. Get Jobs (Faculty sees their own posts; Models see open market)
export const getOpenCalls = (email) => api.get(`/open_calls?email=${email}`);

// 2. Faculty: Post a new Job
export const createOpenCall = (data) => api.post('/open_calls', data);

// 3. Model: Bid on a Job
export const createBid = (email, openCallId, message) => {
  return api.post(`/open_calls/${openCallId}/bids`, {
    email,
    message
  });
};

// 4. Faculty: Accept a Bid
export const acceptBid = (email, bidId) => {
  return api.post(`/bids/${bidId}/accept`, { email });
};

export default api;