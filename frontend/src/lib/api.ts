import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auto refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(error.config);
      } catch {
        // Redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const teamApi = {
  listInvites: () => api.get('/team/invites'),
  invite: (email: string, role: string) => api.post('/team/invite', { email, role }),
  deleteInvite: (id: number) => api.delete(`/team/invites/${id}`),
};

export default api;

export const schedulingApi = {
  listWeek: (date: string) => api.get('/scheduling/week', { params: { date } }),
  list: (dateFrom?: string, dateTo?: string) => api.get('/scheduling', { params: { date_from: dateFrom, date_to: dateTo } }),
  create: (data: Record<string, unknown>) => api.post('/scheduling', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/scheduling/${id}`, data),
  delete: (id: number) => api.delete(`/scheduling/${id}`),
  getWorkers: () => api.get('/scheduling/workers'),
}
