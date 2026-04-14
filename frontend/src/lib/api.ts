import type {
  Contact,
  ContactCreate,
  ContactUpdate,
  ContactListResponse,
  DuplicateResponse,
  MergeRequest,
  Stats,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listContacts: (page = 1, limit = 20) =>
    request<ContactListResponse>(`/api/contacts?page=${page}&limit=${limit}`),

  getContact: (id: string) => request<Contact>(`/api/contacts/${id}`),

  createContact: (data: ContactCreate) =>
    request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) }),

  updateContact: (id: string, data: ContactUpdate) =>
    request<Contact>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteContact: (id: string) =>
    request<void>(`/api/contacts/${id}`, { method: "DELETE" }),

  searchContacts: (q: string) => request<Contact[]>(`/api/contacts/search?q=${encodeURIComponent(q)}`),

  getDuplicates: () => request<DuplicateResponse>("/api/contacts/duplicates"),

  mergeContacts: (data: MergeRequest) =>
    request<Contact>("/api/contacts/merge", { method: "POST", body: JSON.stringify(data) }),

  getStats: () => request<Stats>("/api/contacts/stats"),
};
