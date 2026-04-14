import type { Contact } from "@/lib/types";

interface MergePreviewProps {
  primary: Contact;
  secondary: Contact;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MergePreview({ primary, secondary, onConfirm, onCancel }: MergePreviewProps) {
  const mergedPhones = Array.from(new Set([...primary.phone_numbers, ...secondary.phone_numbers]));
  const mergedEmails = Array.from(new Set([...primary.email_addresses, ...secondary.email_addresses]));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Merge Preview</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs font-semibold text-green-700 mb-1">PRIMARY (kept)</p>
            <p className="font-medium">{primary.first_name} {primary.last_name}</p>
            {primary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
            {primary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs font-semibold text-red-700 mb-1">SECONDARY (deleted)</p>
            <p className="font-medium">{secondary.first_name} {secondary.last_name}</p>
            {secondary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
            {secondary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
          </div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">MERGED RESULT</p>
          <p className="font-medium">{primary.first_name} {primary.last_name}</p>
          {mergedPhones.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
          {mergedEmails.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Confirm Merge</button>
        </div>
      </div>
    </div>
  );
}
