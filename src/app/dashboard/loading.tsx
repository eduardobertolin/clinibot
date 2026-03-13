export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 bg-gray-200 rounded-lg w-48" />
      <div className="h-4 bg-gray-100 rounded w-64" />

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>

      {/* Calendar skeleton */}
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}
