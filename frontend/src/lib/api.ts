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

export const archiveApi = {
  list: (params?: { search?: string; document_type?: string; year?: number; skip?: number; limit?: number }) =>
    api.get('/archive', { params }),
  stats: () => api.get('/archive/stats'),
  documentTypes: () => api.get('/archive/document-types'),
  get: (id: number) => api.get(`/archive/${id}`),
  upload: (file: File, meta: Record<string, string | number | undefined>) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v));
    });
    return api.post('/archive', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadUrl: (id: number) => `${API_URL}/archive/${id}/download`,
  verify: (id: number) => api.get(`/archive/${id}/verify`),
}

export const siteReportsApi = {
  list: () => api.get('/site-reports'),
  get: (id: number) => api.get(`/site-reports/${id}`),
  create: (data: Record<string, unknown>) => api.post('/site-reports', data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/site-reports/${id}`, data),
  delete: (id: number) => api.delete(`/site-reports/${id}`),
  sign: (id: number, customerName: string, signature: string) =>
    api.post(`/site-reports/${id}/sign`, { customer_name: customerName, signature }),
  uploadPhoto: (id: number, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return api.post(`/site-reports/${id}/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deletePhoto: (reportId: number, photoId: number) =>
    api.delete(`/site-reports/${reportId}/photos/${photoId}`),
}
