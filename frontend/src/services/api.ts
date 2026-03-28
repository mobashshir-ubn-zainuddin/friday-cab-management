import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generic API methods
export const apiClient = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await api.get<ApiResponse<T>>(url, config);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  post: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await api.post<ApiResponse<T>>(url, data, config);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  patch: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await api.patch<ApiResponse<T>>(url, data, config);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await api.delete<ApiResponse<T>>(url, config);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  }
};

// Auth API
export const authApi = {
  login: (data: any) => apiClient.post<{ token: string; user: any }>('/auth/login', data),
  register: (data: any) => apiClient.post<{ token: string; user: any }>('/auth/register', data),
  getCurrentUser: () => apiClient.get('/auth/me'),
  refreshToken: () => apiClient.post('/auth/refresh'),
  logout: () => apiClient.post('/auth/logout')
};

// User API
export const userApi = {
  getDashboardStats: () => apiClient.get('/users/dashboard'),
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data: any) => apiClient.patch('/users/profile', data),
  getAllUsers: (params?: any) => apiClient.get('/users', { params }),
  blockUser: (id: string, isBlocked: boolean) => apiClient.patch(`/users/${id}/block`, { isBlocked }),
  setAdmin: (id: string, isAdmin: boolean) => apiClient.patch(`/users/${id}/admin`, { isAdmin })
};

// Trip API
export const tripApi = {
  getAll: (params?: any) => apiClient.get('/trips', { params }),
  getById: (id: string) => apiClient.get(`/trips/${id}`),
  create: (data: any) => apiClient.post('/trips', data),
  update: (id: string, data: any) => apiClient.patch(`/trips/${id}`, data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/trips/${id}/status`, { status }),
  toggleBookingWindow: (id: string, action: 'open' | 'close') => 
    apiClient.patch(`/trips/${id}/booking-window`, { action }),
  togglePaymentWindow: (id: string, action: 'open' | 'close', totalCost?: number) => 
    apiClient.patch(`/trips/${id}/payment-window`, { action, totalCost }),
  delete: (id: string) => apiClient.delete(`/trips/${id}`)
};

// Booking API
export const bookingApi = {
  getMyBookings: (params?: any) => apiClient.get('/bookings/my-bookings', { params }),
  getById: (id: string) => apiClient.get(`/bookings/${id}`),
  create: (tripId: string) => apiClient.post('/bookings', { tripId }),
  cancel: (id: string) => apiClient.patch(`/bookings/${id}/cancel`),
  markAttendance: (id: string, attended: boolean) => apiClient.patch(`/bookings/${id}/attendance`, { attended }),
  bulkAttendance: (tripId: string, attended: boolean) => apiClient.post('/bookings/bulk-attendance', { tripId, attended })
};

// Payment API
export const paymentApi = {
  getMyPayments: (params?: any) => apiClient.get('/payments/my-payments', { params }),
  getById: (id: string) => apiClient.get(`/payments/${id}`),
  createOrder: (tripId: string) => apiClient.post('/payments/create-order', { tripId }),
  verify: (data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => 
    apiClient.post('/payments/verify', data),
  getAll: (params?: any) => apiClient.get('/payments', { params }),
  exportReport: (params?: any) => apiClient.get('/payments/report/export', { params })
};

// Admin API
export const adminApi = {
  getDashboardStats: () => apiClient.get('/admin/dashboard'),
  getCabs: (tripId: string) => apiClient.get(`/admin/trips/${tripId}/cabs`),
  createCab: (data: any) => apiClient.post('/admin/cabs', data),
  updateCab: (id: string, data: any) => apiClient.patch(`/admin/cabs/${id}`, data),
  deleteCab: (id: string) => apiClient.delete(`/admin/cabs/${id}`),
  autoAssignCabs: (tripId: string) => apiClient.post(`/admin/trips/${tripId}/auto-assign`),
  assignCab: (data: { cabId: string; bookingId: string }) => apiClient.post('/admin/assign-cab', data),
  removeAssignment: (id: string) => apiClient.delete(`/admin/assignments/${id}`),
  getPendingPayments: () => apiClient.get('/admin/payments/pending-summary')
};

// Analytics API
export const analyticsApi = {
  getAnalytics: (params?: any) => apiClient.get('/analytics', { params }),
  getProfitLoss: (params?: any) => apiClient.get('/analytics/profit-loss', { params }),
  getUserAnalytics: (params?: any) => apiClient.get('/analytics/users', { params }),
  getMonthlyComparison: (params?: any) => apiClient.get('/analytics/monthly-comparison', { params })
};

export default api;
