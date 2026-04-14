"use client";

import { useState, useEffect } from "react";
import type { Contact, ContactCreate, ContactUpdate } from "@/lib/types";

interface ContactModalProps {
  contact: Contact | null;
  onSave: (data: ContactCreate | ContactUpdate, pendingAvatar?: File) => void;
  onAvatarUpload?: (contactId: string, file: File) => void;
  onClose: () => void;
}

interface FieldErrors {
  firstName?: string;
  phones?: Record<number, string>;
  emails?: Record<number, string>;
  general?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,}$/;

function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (!PHONE_REGEX.test(trimmed)) return "Invalid phone format (e.g. +1 555 123 4567)";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return "Phone number too short";
  if (digits.length > 15) return "Phone number too long";
  return null;
}

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (!EMAIL_REGEX.test(trimmed)) return "Invalid email format";
  return null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ContactModal({ contact, onSave, onAvatarUpload, onClose }: ContactModalProps) {
  const [firstName, setFirstName] = useState(contact?.first_name ?? "");
  const [lastName, setLastName] = useState(contact?.last_name ?? "");
  const [phones, setPhones] = useState<string[]>(contact?.phone_numbers ?? [""]);
  const [emails, setEmails] = useState<string[]>(contact?.email_addresses ?? [""]);
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    const phoneErrors: Record<number, string> = {};
    phones.forEach((p, i) => {
      const err = validatePhone(p);
      if (err) phoneErrors[i] = err;
    });
    if (Object.keys(phoneErrors).length > 0) newErrors.phones = phoneErrors;

    const emailErrors: Record<number, string> = {};
    emails.forEach((e, i) => {
      const err = validateEmail(e);
      if (err) emailErrors[i] = err;
    });
    if (Object.keys(emailErrors).length > 0) newErrors.emails = emailErrors;

    const hasPhone = phones.some((p) => p.trim());
    const hasEmail = emails.some((e) => e.trim());
    if (!hasPhone && !hasEmail) {
      newErrors.general = "At least one phone number or email is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      phone_numbers: phones.filter((p) => p.trim()),
      email_addresses: emails.filter((em) => em.trim()),
      notes: notes.trim() || undefined,
    };
    onSave(data, pendingAvatar ?? undefined);
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {contact ? "Edit Contact" : "Add Contact"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-200" />
            ) : contact?.avatar_url ? (
              <img src={`${API_BASE}${contact.avatar_url}`} alt="Avatar" className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xl font-semibold">
                {firstName ? firstName[0].toUpperCase() : "?"}{lastName ? lastName[0].toUpperCase() : ""}
              </div>
            )}
            <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
              {contact?.avatar_url || avatarPreview ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (contact) {
                    if (onAvatarUpload) onAvatarUpload(contact.id, file);
                  } else {
                    setPendingAvatar(file);
                    setAvatarPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
          </div>
          {errors.general && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errors.general}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setErrors((prev) => ({ ...prev, firstName: undefined })); }}
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none focus:border-transparent ${errors.firstName ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Numbers</label>
            {phones.map((phone, i) => (
              <div key={i} className="mb-2">
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => { updateField(i, e.target.value, setPhones); setErrors((prev) => { const p = { ...prev.phones }; delete p[i]; return { ...prev, phones: Object.keys(p).length ? p : undefined, general: undefined }; }); }}
                    placeholder="+1 555 123 4567"
                    className={`flex-1 px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none focus:border-transparent ${errors.phones?.[i] ? "border-red-400" : "border-gray-200"}`}
                  />
                  {phones.length > 1 && (
                    <button type="button" onClick={() => removeField(i, setPhones)} className="text-red-400 hover:text-red-600 px-2 transition">x</button>
                  )}
                </div>
                {errors.phones?.[i] && <p className="text-xs text-red-500 mt-1">{errors.phones[i]}</p>}
              </div>
            ))}
            <button type="button" onClick={() => addField(setPhones)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add phone</button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
            {emails.map((email, i) => (
              <div key={i} className="mb-2">
                <div className="flex gap-2">
                  <input
                    value={email}
                    onChange={(e) => { updateField(i, e.target.value, setEmails); setErrors((prev) => { const em = { ...prev.emails }; delete em[i]; return { ...prev, emails: Object.keys(em).length ? em : undefined, general: undefined }; }); }}
                    placeholder="john@example.com"
                    className={`flex-1 px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none focus:border-transparent ${errors.emails?.[i] ? "border-red-400" : "border-gray-200"}`}
                  />
                  {emails.length > 1 && (
                    <button type="button" onClick={() => removeField(i, setEmails)} className="text-red-400 hover:text-red-600 px-2 transition">x</button>
                  )}
                </div>
                {errors.emails?.[i] && <p className="text-xs text-red-500 mt-1">{errors.emails[i]}</p>}
              </div>
            ))}
            <button type="button" onClick={() => addField(setEmails)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add email</button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a personal note about this contact..."
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{notes.length}/2000</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all font-medium">{contact ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
