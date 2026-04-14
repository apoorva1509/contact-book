import type { Stats } from "@/lib/types";

interface StatsBarProps {
  stats: Stats | undefined;
  onDuplicatesClick: () => void;
}

export default function StatsBar({ stats, onDuplicatesClick }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white/80 backdrop-blur rounded-xl shadow-sm border border-blue-100 p-5 text-center">
        <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
          {stats?.total_contacts ?? "—"}
        </p>
        <p className="text-sm text-gray-500 mt-1 font-medium">Total Contacts</p>
      </div>
      <div className="bg-white/80 backdrop-blur rounded-xl shadow-sm border border-green-100 p-5 text-center">
        <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">
          {stats?.recent_contacts ?? "—"}
        </p>
        <p className="text-sm text-gray-500 mt-1 font-medium">Added This Week</p>
      </div>
      <button
        onClick={onDuplicatesClick}
        className="bg-white/80 backdrop-blur rounded-xl shadow-sm border border-orange-100 p-5 text-center hover:shadow-md hover:border-orange-300 transition-all duration-200"
      >
        <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-400 bg-clip-text text-transparent">
          {stats?.duplicate_groups ?? "—"}
        </p>
        <p className="text-sm text-gray-500 mt-1 font-medium">Duplicates Found</p>
      </button>
    </div>
  );
}
