import type { Contact } from "@/lib/types";
import ContactCard from "./ContactCard";

interface ContactListProps {
  contacts: Contact[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onMerge: () => void;
}

export default function ContactList({
  contacts,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
  onMerge,
}: ContactListProps) {
  return (
    <div>
      {selectedIds.size === 2 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-700">2 contacts selected</span>
          <button
            onClick={onMerge}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            Merge Selected
          </button>
        </div>
      )}
      <div className="grid gap-3">
        {contacts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No contacts found</p>
        ) : (
          contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              selected={selectedIds.has(c.id)}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
