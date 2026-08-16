import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, ApproveUserResponse, RejectUserResponse, BlockUserResponse, SetAdminResponse, PaginatedUsersResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Request deduplication cache - stores the axios promise for in-flight requests
const pendingRequests = new Map<string, Promise<AxiosResponse<any>>>();

const getRequestKey = (config: InternalAxiosRequestConfig): string => {
  const method = config.method?.toUpperCase() || 'GET';
  const url = config.url || '';
  // Only deduplicate GET requests and idempotent mutations
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    // For mutations, include idempotency key if present
    const idempotencyKey = config.headers['Idempotency-Key'];
    if (idempotencyKey) {
      return `${method}:${url}:${idempotencyKey}`;
    }
    // Don't deduplicate mutations without idempotency key
    return '';
  }
  // For GET, include query params
  const params = JSON.stringify(config.params || {});
  return `${method}:${url}:${params}`;
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
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

// Request deduplication interceptor - wraps the actual request to enable deduplication
api.interceptors.request.use(
  (config) => {
    const key = getRequestKey(config);
    if (key && pendingRequests.has(key)) {
      console.log('[API] Deduplicating request:', key);
      // Throw a special error that will be caught and replaced with the existing promise
      throw { __deduplicate: true, key };
    }
    return config;
  },
  (error) => {
    if (error?.__deduplicate) {
      // Return the existing promise for this deduplicated request
      return pendingRequests.get(error.key)!;
    }
    return Promise.reject(error);
  }
);

// Response interceptor for error handling + cache management
api.interceptors.response.use(
  (response) => {
    // Clean up pending request cache
    const key = getRequestKey(response.config);
    if (key) {
      pendingRequests.delete(key);
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    // Clean up pending request cache on error
    if (error.config) {
      const key = getRequestKey(error.config);
      if (key) {
        pendingRequests.delete(key);
      }
    }
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Wrap the actual request methods to track pending requests
const originalRequest = api.request.bind(api);
api.request = async (config: InternalAxiosRequestConfig) => {
  const key = getRequestKey(config);
  if (key) {
    const promise = originalRequest(config);
    pendingRequests.set(key, promise);
    try {
      return await promise;
    } finally {
      pendingRequests.delete(key);
    }
  }
  return originalRequest(config);
};

// Generate a stable idempotency key for create operations based on data content
const generateCreateIdempotencyKey = (data: any): string => {
  const relevantFields = [
    data.title,
    data.description,
    data.date,
    data.bookingStartTime,
    data.bookingEndTime,
    data.cancellationDeadline,
    data.departureTime,
    data.returnTime,
    data.maxBookings
  ];
  const hash = relevantFields.filter(Boolean).join('|');
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    hashValue = ((hashValue << 5) - hashValue) + hash.charCodeAt(i);
    hashValue |= 0;
  }
  return `create-trip-${Math.abs(hashValue).toString(36)}`;
};

// Generate a stable idempotency key for delete operations based on resource ID
const generateDeleteIdempotencyKey = (resourceType: string, id: string): string => {
  return `delete-${resourceType}-${id}`;
};

// Generate a unique idempotency key for other operations
const generateIdempotencyKey = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Generic API methods
export const apiClient = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await api.get<ApiResponse<T>>(url, config);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  post: async <T>(url: string, data?: any, config?: AxiosRequestConfig & { idempotencyKey?: string }): Promise<T> => {
    const { idempotencyKey, ...axiosConfig } = config || {};
    const headers = {
      ...axiosConfig.headers,
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey })
    };
    const response = await api.post<ApiResponse<T>>(url, data, { ...axiosConfig, headers });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  patch: async <T>(url: string, data?: any, config?: AxiosRequestConfig & { idempotencyKey?: string }): Promise<T> => {
    const { idempotencyKey, ...axiosConfig } = config || {};
    const headers = {
      ...axiosConfig.headers,
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey })
    };
    const response = await api.patch<ApiResponse<T>>(url, data, { ...axiosConfig, headers });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig & { idempotencyKey?: string }): Promise<T> => {
    const { idempotencyKey, ...axiosConfig } = config || {};
    const headers = {
      ...axiosConfig.headers,
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey })
    };
    const response = await api.delete<ApiResponse<T>>(url, { ...axiosConfig, headers });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data.data as T;
  }
};

// Auth API
export const authApi = {
  syncUser: () => apiClient.post<{ user: any }>('/auth/sync-user', undefined, { idempotencyKey: 'sync-user' }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
  signup: async (data: { emailPrefix: string; name: string; phone: string; rollNumber: string; department: string }) => {
    const response: AxiosResponse<ApiResponse<{ user: any }>> = await api.post('/auth/signup', data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Request failed');
    }
    return response.data;
  }
};

// User API
export const userApi = {
  getDashboardStats: () => apiClient.get('/users/dashboard'),
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data: any) => apiClient.patch('/users/profile', data),
  getAllUsers: (params?: any) => apiClient.get<PaginatedUsersResponse>('/users', { params }),
  blockUser: (id: string, isBlocked: boolean) => 
    apiClient.patch<BlockUserResponse>(`/users/${id}/block`, { isBlocked }, { idempotencyKey: generateIdempotencyKey(`block-${id}`) }),
  setAdmin: (id: string, isAdmin: boolean) => 
    apiClient.patch<SetAdminResponse>(`/users/${id}/admin`, { isAdmin }, { idempotencyKey: generateIdempotencyKey(`admin-${id}`) }),
  approveUser: (id: string) => 
    apiClient.post<ApproveUserResponse>(`/auth/admin/users/${id}/approve`, undefined, { idempotencyKey: generateIdempotencyKey(`approve-${id}`) }),
  rejectUser: (id: string, reason?: string) => 
    apiClient.post<RejectUserResponse>(`/auth/admin/users/${id}/reject`, { reason }, { idempotencyKey: generateIdempotencyKey(`reject-${id}`) }),
};

// Trip API
export const tripApi = {
  getAll: (params?: any) => apiClient.get('/trips', { params }),
  getById: (id: string) => apiClient.get(`/trips/${id}`),
  create: (data: any) => apiClient.post('/trips', data, { idempotencyKey: generateCreateIdempotencyKey(data) }),
  update: (id: string, data: any) => apiClient.patch(`/trips/${id}`, data, { idempotencyKey: generateIdempotencyKey(`update-trip-${id}`) }),
  cancel: (id: string) => apiClient.patch(`/trips/${id}/cancel`, undefined, { idempotencyKey: generateIdempotencyKey(`cancel-trip-${id}`) }),
  togglePaymentWindow: (id: string, action: 'open' | 'close', totalCost?: number) => 
    apiClient.patch(`/trips/${id}/payment-window`, { action, totalCost }, { idempotencyKey: generateIdempotencyKey(`trip-payment-window-${id}-${action}`) }),
  delete: (id: string) => apiClient.delete(`/trips/${id}`, { idempotencyKey: generateDeleteIdempotencyKey('trip', id) })
};

// Booking API
export const bookingApi = {
  getMyBookings: (params?: any) => apiClient.get('/bookings/my-bookings', { params }),
  getById: (id: string) => apiClient.get(`/bookings/${id}`),
  create: (tripId: string) => apiClient.post('/bookings', { tripId }, { idempotencyKey: generateIdempotencyKey(`book-${tripId}`) }),
  cancel: (id: string) => apiClient.patch(`/bookings/${id}/cancel`, undefined, { idempotencyKey: generateIdempotencyKey(`cancel-booking-${id}`) }),
  markAttendance: (id: string, attended: boolean) => apiClient.patch(`/bookings/${id}/attendance`, { attended }, { idempotencyKey: generateIdempotencyKey(`attendance-${id}`) }),
  bulkAttendance: (tripId: string, attended: boolean) => apiClient.post('/bookings/bulk-attendance', { tripId, attended }, { idempotencyKey: generateIdempotencyKey(`bulk-attendance-${tripId}`) })
};

// Payment API
export const paymentApi = {
  getMyPayments: (params?: any) => apiClient.get('/payments/my-payments', { params }),
  getById: (id: string) => apiClient.get(`/payments/${id}`),
  createOrder: (tripId: string) => apiClient.post('/payments/create-order', { tripId }, { idempotencyKey: generateIdempotencyKey(`create-order-${tripId}`) }),
  verify: (data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => 
    apiClient.post('/payments/verify', data, { idempotencyKey: generateIdempotencyKey(`verify-payment-${data.razorpayOrderId}`) }),
  getAll: (params?: any) => apiClient.get('/payments', { params }),
  exportReport: (params?: any) => apiClient.get('/payments/report/export', { params })
};

// Admin API
export const adminApi = {
  getDashboardStats: () => apiClient.get('/admin/dashboard'),
  getCabs: (tripId: string) => apiClient.get(`/admin/trips/${tripId}/cabs`),
  createCab: (data: any) => apiClient.post('/admin/cabs', data, { idempotencyKey: generateIdempotencyKey('create-cab') }),
  updateCab: (id: string, data: any) => apiClient.patch(`/admin/cabs/${id}`, data, { idempotencyKey: generateIdempotencyKey(`update-cab-${id}`) }),
  deleteCab: (id: string) => apiClient.delete(`/admin/cabs/${id}`, { idempotencyKey: generateIdempotencyKey(`delete-cab-${id}`) }),
  autoAssignCabs: (tripId: string) => apiClient.post(`/admin/trips/${tripId}/auto-assign`, undefined, { idempotencyKey: generateIdempotencyKey(`auto-assign-${tripId}`) }),
  assignCab: (data: { cabId: string; bookingId: string }) => apiClient.post('/admin/assign-cab', data, { idempotencyKey: generateIdempotencyKey(`assign-cab-${data.cabId}-${data.bookingId}`) }),
  removeAssignment: (id: string) => apiClient.delete(`/admin/assignments/${id}`, { idempotencyKey: generateIdempotencyKey(`remove-assignment-${id}`) }),
  getPendingPayments: () => apiClient.get('/admin/payments/pending-summary'),
  getTripBookingsForPayment: (tripId: string) => apiClient.get(`/admin/trips/${tripId}/bookings-for-payment`)
};

// Analytics API
export const analyticsApi = {
  getAnalytics: (params?: any) => apiClient.get('/analytics', { params }),
  getProfitLoss: (params?: any) => apiClient.get('/analytics/profit-loss', { params }),
  getUserAnalytics: (params?: any) => apiClient.get('/analytics/users', { params }),
  getMonthlyComparison: (params?: any) => apiClient.get('/analytics/monthly-comparison', { params })
};

export default api;
