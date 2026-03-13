export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 space-y-2">
        <div className="h-7 bg-gray-200 rounded-lg w-44" />
        <div className="h-4 bg-gray-100 rounded w-72" />
      </div>

      <div className="p-8 space-y-6">
        {/* Tabs skeleton */}
        <div className="flex gap-1 border-b border-gray-200 pb-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-9 rounded-t-lg px-4 ${i === 0 ? "w-28 bg-gray-300" : "w-24 bg-gray-100"}`}
            />
          ))}
        </div>

        {/* Form section skeleton */}
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-100 rounded w-64" />
        </div>

        {/* Form fields skeleton */}
        <div className="space-y-4 max-w-lg">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-10 bg-gray-100 rounded-lg w-full" />
            </div>
          ))}
          <div className="h-10 bg-gray-200 rounded-lg w-32 mt-2" />
        </div>

        {/* Table/list skeleton */}
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
