export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex-shrink-0 space-y-2">
        <div className="h-7 bg-gray-200 rounded-lg w-40" />
        <div className="h-4 bg-gray-100 rounded w-72" />
      </div>

      {/* Split pane skeleton */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar list skeleton */}
        <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0 divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="h-4 bg-gray-200 rounded flex-1" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-4/5 ml-10" />
              <div className="h-3 bg-gray-100 rounded w-1/3 ml-10" />
            </div>
          ))}
        </div>

        {/* Detail area skeleton */}
        <div className="flex-1 p-6 space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-12 bg-gray-100 rounded-xl ${i % 2 === 0 ? "w-3/4" : "w-1/2 ml-auto"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
