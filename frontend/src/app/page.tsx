"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { Contact, ContactCreate, ContactUpdate } from "@/lib/types";
import StatsBar from "@/components/StatsBar";
import SearchBar from "@/components/SearchBar";
import ContactList from "@/components/ContactList";
import ContactModal from "@/components/ContactModal";
import DuplicatePanel from "@/components/DuplicatePanel";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<Contact | null | "new">(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const { data: contactsData, mutate: mutateContacts } = useSWR(
    searchQuery ? null : "contacts",
    () => api.listContacts(1, 100)
  );

  const { data: searchResults, mutate: mutateSearch } = useSWR(
    searchQuery ? `search-${searchQuery}` : null,
    () => api.searchContacts(searchQuery)
  );

  const { data: stats, mutate: mutateStats } = useSWR("stats", api.getStats);

  const { data: duplicates, mutate: mutateDuplicates } = useSWR(
    showDuplicates ? "duplicates" : null,
    api.getDuplicates
  );

  const contacts = searchQuery
    ? searchResults ?? []
    : contactsData?.contacts ?? [];

  const refreshAll = useCallback(() => {
    mutateContacts();
    mutateSearch();
    mutateStats();
    mutateDuplicates();
  }, [mutateContacts, mutateSearch, mutateStats, mutateDuplicates]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSave = async (data: ContactCreate | ContactUpdate, pendingAvatar?: File) => {
    try {
      if (editingContact && editingContact !== "new") {
        await api.updateContact(editingContact.id, data as ContactUpdate);
        toast.success("Contact updated");
      } else {
        const created = await api.createContact(data as ContactCreate);
        if (pendingAvatar) {
          await api.uploadAvatar(created.id, pendingAvatar);
        }
        toast.success("Contact created");
      }
      setEditingContact(null);
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save contact");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await api.deleteContact(id);
      toast.success("Contact deleted");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refreshAll();
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const handleMerge = async (primaryId?: string, secondaryId?: string) => {
    const ids = primaryId && secondaryId
      ? [primaryId, secondaryId]
      : Array.from(selectedIds);
    if (ids.length !== 2) return;

    try {
      await api.mergeContacts({ primary_id: ids[0], secondary_id: ids[1] });
      toast.success("Contacts merged");
      setSelectedIds(new Set());
      setShowDuplicates(false);
      refreshAll();
    } catch {
      toast.error("Failed to merge contacts");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-700 via-purple-600 to-blue-500 bg-clip-text text-transparent">Contact Book</h1>
      <StatsBar stats={stats} onDuplicatesClick={() => setShowDuplicates(true)} />
      <SearchBar onSearch={handleSearch} onAdd={() => setEditingContact("new")} />
      <ContactList
        contacts={contacts}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onEdit={setEditingContact}
        onDelete={handleDelete}
        onMerge={() => handleMerge()}
      />

      {editingContact !== null && (
        <ContactModal
          contact={editingContact === "new" ? null : editingContact}
          onSave={handleSave}
          onAvatarUpload={async (contactId, file) => {
            try {
              await api.uploadAvatar(contactId, file);
              toast.success("Photo updated");
              refreshAll();
            } catch {
              toast.error("Failed to upload photo");
            }
          }}
          onClose={() => setEditingContact(null)}
        />
      )}

      {showDuplicates && (
        <DuplicatePanel
          groups={duplicates?.duplicate_groups ?? []}
          onMerge={(p, s) => handleMerge(p, s)}
          onClose={() => setShowDuplicates(false)}
        />
      )}
    </div>
  );
}
