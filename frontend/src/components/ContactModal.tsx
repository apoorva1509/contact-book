"use client";

import { useState, useEffect } from "react";
import type { Contact, ContactCreate, ContactUpdate } from "@/lib/types";

interface ContactModalProps {
  contact: Contact | null;
  onSave: (data: ContactCreate | ContactUpdate) => void;
  onClose: () => void;
}

export default function ContactModal({ contact, onSave, onClose }: ContactModalProps) {
  const [firstName, setFirstName] = useState(contact?.first_name ?? "");
  const [lastName, setLastName] = useState(contact?.last_name ?? "");
  const [phones, setPhones] = useState<string[]>(contact?.phone_numbers ?? [""]);
  const [emails, setEmails] = useState<string[]>(contact?.email_addresses ?? [""]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      first_name: firstName,
      last_name: lastName || undefined,
      phone_numbers: phones.filter((p) => p.trim()),
      email_addresses: emails.filter((e) => e.trim()),
    };
    onSave(data);
  };

  const addField = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const updateField = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const removeField = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {contact ? "Edit Contact" : "Add Contact"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Numbers</label>
            {phones.map((phone, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={phone}
                  onChange={(e) => updateField(i, e.target.value, setPhones)}
                  placeholder="+1 555 123 4567"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                {phones.length > 1 && (
                  <button type="button" onClick={() => removeField(i, setPhones)} className="text-red-500 hover:text-red-700 px-2">x</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addField(setPhones)} className="text-sm text-blue-600 hover:text-blue-800">+ Add phone</button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
            {emails.map((email, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={email}
                  onChange={(e) => updateField(i, e.target.value, setEmails)}
                  placeholder="john@example.com"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                {emails.length > 1 && (
                  <button type="button" onClick={() => removeField(i, setEmails)} className="text-red-500 hover:text-red-700 px-2">x</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addField(setEmails)} className="text-sm text-blue-600 hover:text-blue-800">+ Add email</button>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">{contact ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
