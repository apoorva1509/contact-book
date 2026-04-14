"use client";

import type { DuplicateGroup, Contact } from "@/lib/types";
import { useState } from "react";
import MergePreview from "./MergePreview";

interface DuplicatePanelProps {
  groups: DuplicateGroup[];
  onMerge: (primaryId: string, secondaryId: string) => void;
  onClose: () => void;
}

export default function DuplicatePanel({ groups, onMerge, onClose }: DuplicatePanelProps) {
  const [merging, setMerging] = useState<{ primary: Contact; secondary: Contact } | null>(null);

  const reasonLabel = (reason: string, score: number) => {
    if (reason === "similar_name") return `Similar name (${Math.round(score * 100)}% match)`;
    if (reason === "shared_phone") return "Shared phone number";
    if (reason === "shared_email") return "Shared email address";
    return reason;
  };

  if (merging) {
    return (
      <MergePreview
        primary={merging.primary}
        secondary={merging.secondary}
        onConfirm={() => {
          onMerge(merging.primary.id, merging.secondary.id);
          setMerging(null);
        }}
        onCancel={() => setMerging(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Potential Duplicates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>
        {groups.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No duplicates detected</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group, i) => (
              <div key={i} className="border rounded-lg p-4">
                <p className="text-xs font-medium text-orange-600 mb-2">
                  {reasonLabel(group.reason, group.similarity_score)}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {group.contacts.map((c) => (
                    <div key={c.id} className="text-sm">
                      <p className="font-medium">{c.first_name} {c.last_name}</p>
                      {c.phone_numbers.map((p) => <p key={p} className="text-gray-600">{p}</p>)}
                      {c.email_addresses.map((e) => <p key={e} className="text-gray-500">{e}</p>)}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setMerging({ primary: group.contacts[0], secondary: group.contacts[1] })}
                  className="w-full py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
                >
                  Review & Merge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
