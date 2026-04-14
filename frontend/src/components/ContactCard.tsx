import type { Contact } from "@/lib/types";

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ContactCard({
  contact,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: ContactCardProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const initials = `${contact.first_name[0]}${contact.last_name?.[0] ?? ""}`;

  return (
    <div
      className={`bg-white/80 backdrop-blur rounded-xl shadow-sm p-4 border-2 transition-all duration-200 hover:shadow-md ${
        selected ? "border-blue-400 bg-blue-50/50" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(contact.id)}
            className="mt-1 h-4 w-4 accent-blue-600 rounded"
          />
          {contact.avatar_url ? (
            <img
              src={`${API_BASE}${contact.avatar_url}`}
              alt={fullName}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0 shadow-sm">
              {initials}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-base">{fullName}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {contact.phone_numbers.map((p) => (
                <span key={p} className="text-sm text-gray-600 flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {p}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {contact.email_addresses.map((e) => (
                <span key={e} className="text-sm text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {e}
                </span>
              ))}
            </div>
            {contact.notes && (
              <p className="text-xs text-gray-400 mt-1.5 italic line-clamp-2">
                {contact.notes}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(contact)}
            className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="text-sm px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>
      {contact.merged_from.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 ml-[4.25rem] flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          Merged from {contact.merged_from.length} contact(s)
        </p>
      )}
    </div>
  );
}
