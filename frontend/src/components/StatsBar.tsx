import type { Stats } from "@/lib/types";

interface StatsBarProps {
  stats: Stats | undefined;
  onDuplicatesClick: () => void;
}

export default function StatsBar({ stats, onDuplicatesClick }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <p className="text-3xl font-bold text-blue-600">{stats?.total_contacts ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Total Contacts</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <p className="text-3xl font-bold text-green-600">{stats?.recent_contacts ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Added This Week</p>
      </div>
      <button
        onClick={onDuplicatesClick}
        className="bg-white rounded-lg shadow p-4 text-center hover:ring-2 hover:ring-orange-300 transition"
      >
        <p className="text-3xl font-bold text-orange-600">{stats?.duplicate_groups ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Duplicates Found</p>
      </button>
    </div>
  );
}
