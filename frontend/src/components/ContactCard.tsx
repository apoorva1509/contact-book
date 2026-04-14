import type { Contact } from "@/lib/types";

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

export default function ContactCard({
  contact,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: ContactCardProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 border-2 transition ${
        selected ? "border-blue-500" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(contact.id)}
            className="mt-1 h-4 w-4 accent-blue-600"
          />
          <div>
            <h3 className="font-semibold text-lg">{fullName}</h3>
            {contact.phone_numbers.map((p) => (
              <p key={p} className="text-sm text-gray-600">{p}</p>
            ))}
            {contact.email_addresses.map((e) => (
              <p key={e} className="text-sm text-gray-500">{e}</p>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(contact)}
            className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
          >
            Delete
          </button>
        </div>
      </div>
      {contact.merged_from.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Merged from {contact.merged_from.length} contact(s)
        </p>
      )}
    </div>
  );
}
