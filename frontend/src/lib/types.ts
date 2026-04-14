export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_numbers: string[];
  email_addresses: string[];
  merged_from: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}

export interface ContactCreate {
  first_name: string;
  last_name?: string;
  phone_numbers: string[];
  email_addresses: string[];
}

export interface ContactUpdate {
  first_name?: string;
  last_name?: string;
  phone_numbers?: string[];
  email_addresses?: string[];
}

export interface MergeRequest {
  primary_id: string;
  secondary_id: string;
}

export interface DuplicateGroup {
  contacts: Contact[];
  reason: string;
  similarity_score: number;
}

export interface DuplicateResponse {
  duplicate_groups: DuplicateGroup[];
}

export interface Stats {
  total_contacts: number;
  recent_contacts: number;
  duplicate_groups: number;
}
