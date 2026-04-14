import type { Contact } from "@/lib/types";

interface MergePreviewProps {
  primary: Contact;
  secondary: Contact;
  onConfirm: () => void;
  onCancel: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function Avatar({ contact, size = "sm" }: { contact: Contact; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  const initials = `${contact.first_name[0]}${contact.last_name?.[0] ?? ""}`;
  if (contact.avatar_url) {
    return <img src={`${API_BASE}${contact.avatar_url}`} alt="" className={`${dim} rounded-full object-cover`} />;
  }
  return <div className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold`}>{initials}</div>;
}

export default function MergePreview({ primary, secondary, onConfirm, onCancel }: MergePreviewProps) {
  const mergedPhones = Array.from(new Set([...primary.phone_numbers, ...secondary.phone_numbers]));
  const mergedEmails = Array.from(new Set([...primary.email_addresses, ...secondary.email_addresses]));
  const mergedAvatar = primary.avatar_url || secondary.avatar_url;
  const mergedNotes = primary.notes && secondary.notes
    ? `${primary.notes}\n---\n${secondary.notes}`
    : primary.notes || secondary.notes || null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Merge Preview</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-xl border border-green-200">
            <p className="text-xs font-semibold text-green-700 mb-2">PRIMARY (kept)</p>
            <div className="flex items-center gap-2 mb-1">
              <Avatar contact={primary} />
              <p className="font-medium">{primary.first_name} {primary.last_name}</p>
            </div>
            {primary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600 ml-10">{p}</p>)}
            {primary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500 ml-10">{e}</p>)}
            {primary.notes && <p className="text-xs text-gray-400 italic mt-1 ml-10 line-clamp-2">{primary.notes}</p>}
          </div>
          <div className="p-3 bg-red-50 rounded-xl border border-red-200">
            <p className="text-xs font-semibold text-red-700 mb-2">SECONDARY (deleted)</p>
            <div className="flex items-center gap-2 mb-1">
              <Avatar contact={secondary} />
              <p className="font-medium">{secondary.first_name} {secondary.last_name}</p>
            </div>
            {secondary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600 ml-10">{p}</p>)}
            {secondary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500 ml-10">{e}</p>)}
            {secondary.notes && <p className="text-xs text-gray-400 italic mt-1 ml-10 line-clamp-2">{secondary.notes}</p>}
          </div>
        </div>
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">MERGED RESULT</p>
          <div className="flex items-center gap-2 mb-1">
            {mergedAvatar ? (
              <img src={`${API_BASE}${mergedAvatar}`} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold text-xs">
                {primary.first_name[0]}{primary.last_name?.[0] ?? ""}
              </div>
            )}
            <p className="font-medium">{primary.first_name} {primary.last_name}</p>
          </div>
          {mergedPhones.map((p) => <p key={p} className="text-sm text-gray-600 ml-10">{p}</p>)}
          {mergedEmails.map((e) => <p key={e} className="text-sm text-gray-500 ml-10">{e}</p>)}
          {mergedNotes && <p className="text-xs text-gray-400 italic mt-1 ml-10 line-clamp-3">{mergedNotes}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all font-medium">Confirm Merge</button>
        </div>
      </div>
    </div>
  );
}
