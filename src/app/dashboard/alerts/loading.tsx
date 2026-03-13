export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 space-y-2">
        <div className="h-7 bg-gray-200 rounded-lg w-32" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>

      <div className="p-8 space-y-6">
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>

        {/* Section label skeleton */}
        <div className="h-4 bg-gray-200 rounded w-28" />

        {/* Alert list items skeleton — each with icon + text + button */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white border-l-4 border-l-gray-200 rounded-lg p-4 flex gap-4 shadow-sm"
            >
              {/* Icon placeholder */}
              <div className="w-9 h-9 bg-gray-200 rounded-lg flex-shrink-0" />
              {/* Text block */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 rounded-full w-20" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              {/* Button placeholder */}
              <div className="w-24 h-8 bg-gray-100 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
