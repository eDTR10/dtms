/**
 * Central API service for the Document Management System.
 * Uses the Token-based auth that Djoser provides (stored in localStorage).
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:8000/api/v1/";

const api = axios.create({ baseURL: BASE_URL });

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers["Authorization"] = `Token ${token}`;
  return config;
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Office {
  officeID: number;
  name: string;
  officeMail: string;
  street: string;
  city: string;
  province: string;
  region: string;
  numUsers: number;
}

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  office: number | null;
  acc_lvl: number;
  is_active: boolean;
  is_staff: boolean;
}

/** Slim user shape returned by /users/signatories/ — safe for non-admin users */
export interface SignatoryUser {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  acc_lvl: number;
  office_id: number | null;
  office_name: string | null;
}

export interface TemplateRouting {
  id: number;
  template: number;
  order: number;
  office_id: number;
  office_name: string;
  user_id: number;
  user_name: string;
  user_email: string;
  user_position: string;
}

export interface DocumentTemplate {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  routing: TemplateRouting[];
}

export interface DocumentSignatory {
  id: number;
  document: number;
  user_id: number;
  user_email: string;
  user_name: string;
  user_office: string;
  order: number;
  status: "pending" | "signed" | "rejected";
  signed_at: string | null;
  remarks: string;
}

export interface DocumentFile {
  id: number;
  document: number;
  file: string;
  file_url: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  file_type: "original" | "signed" | "signatory_upload";
  remarks: string;
}

export interface Document {
  id: number;
  userID: number;
  tracknumber: string;
  title: string;
  type: string;
  requestor: string;
  position: string;
  to: number;
  signedBy: number;
  message: string;
  remarks: string;
  datesubmitted: string;
  status: string;
  updatedAt: string;
  template: number | null;
  file: string | null;
  file_url: string | null;
  files: DocumentFile[];
  signatories: DocumentSignatory[];
  total_signatories: number;
  signed_count: number;
  rejected_count: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ auth_token: string }>("token/login/", { email, password });
    localStorage.setItem("auth_token", data.auth_token);
    return data;
  },
  register: async (payload: {
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    re_password: string;
  }) => {
    const { data } = await api.post("users/", payload);
    return data;
  },
  logout: async () => {
    try { await api.post("token/logout/"); } catch { /* ignore */ }
    localStorage.removeItem("auth_token");
  },
  getMe: async (signal?: AbortSignal): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>("users/me/", { signal });
    return data;
  },
  isAuthenticated: () => !!localStorage.getItem("auth_token"),
};

// ── Offices ───────────────────────────────────────────────────────────────────

export const officeApi = {
  list:   (signal?: AbortSignal) => api.get<Office[]>("office/", { signal }).then(r => r.data),
  get:    (id: number, signal?: AbortSignal) => api.get<Office>(`office/${id}/`, { signal }).then(r => r.data),
  create: (data: Partial<Office>) => api.post<Office>("office/", data).then(r => r.data),
  update: (id: number, data: Partial<Office>) => api.put<Office>(`office/${id}/`, data).then(r => r.data),
  delete: (id: number) => api.delete(`office/${id}/`),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const userApi = {
  list:         (signal?: AbortSignal)         => api.get<UserProfile[]>("users/all/", { signal }).then(r => r.data),
  signatories:  (signal?: AbortSignal)         => api.get<SignatoryUser[]>("users/signatories/", { signal }).then(r => r.data),
  get:          (id: number, signal?: AbortSignal) => api.get<UserProfile>(`users/user/${id}/`, { signal }).then(r => r.data),
  update: (id: number, data: Partial<UserProfile> & { password?: string }) =>
    api.put<UserProfile>(`users/update/${id}/`, data).then(r => r.data),
  create: (data: Partial<UserProfile> & { password: string; re_password: string }) =>
    api.post<UserProfile>("users/", data).then(r => r.data),
  patchMe: (data: Partial<UserProfile>) =>
    api.patch<UserProfile>("users/me/", data).then(r => r.data),
};

// ── Document Templates ────────────────────────────────────────────────────────

export const templateApi = {
  list:   (signal?: AbortSignal) => api.get<DocumentTemplate[]>("document/templates/", { signal }).then(r => r.data),
  get:    (id: number, signal?: AbortSignal) => api.get<DocumentTemplate>(`document/templates/${id}/`, { signal }).then(r => r.data),
  create: (data: Pick<DocumentTemplate, "name" | "description">) =>
    api.post<DocumentTemplate>("document/templates/", data).then(r => r.data),
  update: (id: number, data: Partial<DocumentTemplate>) =>
    api.patch<DocumentTemplate>(`document/templates/${id}/`, data).then(r => r.data),
  delete: (id: number) => api.delete(`document/templates/${id}/`),
};

// ── Template Routing ──────────────────────────────────────────────────────────

export const templateRoutingApi = {
  list:    (templateId: number, signal?: AbortSignal) =>
    api.get<TemplateRouting[]>(`document/templates/${templateId}/routing/`, { signal }).then(r => r.data),
  add:     (templateId: number, data: Omit<TemplateRouting, 'id' | 'template'>) =>
    api.post<TemplateRouting>(`document/templates/${templateId}/routing/`, data).then(r => r.data),
  remove:  (templateId: number, stepId: number) =>
    api.delete(`document/templates/${templateId}/routing/${stepId}/`),
  reorder: (templateId: number, stepId: number, newOrder: number) =>
    api.patch<TemplateRouting>(`document/templates/${templateId}/routing/${stepId}/`, { order: newOrder }).then(r => r.data),
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentApi = {
  list:       (signal?: AbortSignal) => api.get<Document[]>("document/all/", 
    
    
    
     
     
     
    
    
    { signal }).then(r => r.data),
  myDocs:     (signal?: AbortSignal) => api.get<Document[]>("document/by_office/", { signal }).then(r => r.data),
  get:        (id: number, signal?: AbortSignal) => api.get<Document>(`document/${id}`, { signal }).then(r => r.data),
  getByTrack: (tracknumber: string, signal?: AbortSignal) =>
    api.get<Document>(`document/tracknumber/${tracknumber}`, { signal }).then(r => r.data),

  create: (formData: FormData) =>
    api.post<Document>("document/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  update: (id: number, formData: FormData) =>
    api.patch<Document>(`document/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  delete: (id: number) => api.delete(`document/${id}`),

  /** Route to office + assign signatories */
  send: (id: number, payload: {
    to_office?: number;
    signatories: Array<{ user_id: number; user_email: string; user_name: string; order: number }>;
  }) => api.post<Document>(`document/${id}/send/`, payload).then(r => r.data),

  /** Update routing — add/remove signatories while preserving signed statuses */
  updateRouting: (id: number, payload: {
    signatories: Array<{ user_id: number; user_email: string; user_name: string; order: number }>;
  }) => api.patch<Document>(`document/${id}/update_routing/`, payload).then(r => r.data),

  /** Upload signed PDF back to server (single-file, legacy) */
  uploadSigned: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.patch<Document>(`document/${id}/upload_signed/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  /**
   * Batch-sign N DocumentFile records in a single PATCH request.
   * FormData must contain file_0/file_id_0, file_1/file_id_1, … pairs.
   * Each original file is replaced in-place; total file count stays the same.
   */
  signFiles: (id: number, formData: FormData) =>
    api.patch<Document>(`document/${id}/sign_files/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  /** Upload additional file to document */
  uploadFile: (id: number, formData: FormData) =>
    api.post<DocumentFile>(`document/${id}/upload_file/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  /** List all files for a document */
  listFiles: (id: number, signal?: AbortSignal) =>
    api.get<DocumentFile[]>(`document/${id}/files/`, { signal }).then(r => r.data),

  /** Delete a file from a document */
  deleteFile: (docId: number, fileId: number) =>
    api.delete(`document/${docId}/delete_file/${fileId}/`),
};

// ── Signatory ─────────────────────────────────────────────────────────────────

export const signatoryApi = {
  update: (id: number, payload: { status: "signed" | "rejected"; remarks?: string }) =>
    api.patch<DocumentSignatory>(`document/signatory/${id}/`, payload).then(r => r.data),
};

export default api;
