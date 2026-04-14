"use client";

import { useEffect, useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onAdd: () => void;
}

export default function SearchBar({ onSearch, onAdd }: SearchBarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="flex gap-3 mb-6">
      <div className="flex-1 relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white/80 backdrop-blur shadow-sm"
        />
      </div>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm font-medium"
      >
        + Add Contact
      </button>
    </div>
  );
}
