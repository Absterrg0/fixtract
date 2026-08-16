import { Skeleton } from '@/components/ui/skeleton'
import { PopularProjectsCarouselSkeleton } from '@/components/home/PopularProjectsCarouselSkeleton'

export default function HomePageSkeleton() {
  return (
    <main className="min-h-screen bg-white">
      <section className="py-20 pt-32 pb-24 bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Skeleton className="mx-auto mb-8 h-9 w-56 rounded-full" />

            <div className="mb-8 space-y-3">
              <Skeleton className="mx-auto h-12 sm:h-16 lg:h-20 w-full max-w-3xl" />
              <Skeleton className="mx-auto h-12 sm:h-16 lg:h-20 w-full max-w-2xl" />
            </div>

            <div className="mb-12 space-y-2 max-w-4xl mx-auto">
              <Skeleton className="mx-auto h-7 w-full max-w-3xl" />
              <Skeleton className="mx-auto h-7 w-2/3" />
            </div>

            <div className="max-w-5xl mx-auto mb-5">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-4 flex items-center px-2 min-h-12">
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <div className="lg:col-span-3 px-2 lg:border-l lg:border-gray-200 flex items-center min-h-12">
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <div className="lg:col-span-3 lg:border-l lg:border-gray-200 flex items-center px-4 min-h-12">
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <div className="lg:col-span-2">
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Skeleton className="h-4 w-14" />
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            </div>

            <PopularProjectsCarouselSkeleton />

            <div className="mt-10 pt-16 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-4 text-left">
                    <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
