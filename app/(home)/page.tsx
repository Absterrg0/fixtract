import HeroSection from '@/components/HeroSection'
import HowItWorksSection from '@/components/HowItWorksSection'
import FeaturesSection from '@/components/FeaturesSection'
import CTASection from '@/components/CTASection'
import ProfessionalsSection from '@/components/ProfessionalsSection'
import { getPopularProjects, getPopularServices } from '@/lib/server/popular'

export const revalidate = 60

export default function Home() {
  const popularServicesPromise = getPopularServices(5)
  const popularProjectsPromise = getPopularProjects({ limit: 10 })

  return (
    <main className="min-h-screen bg-white">
      <HeroSection
        popularServicesPromise={popularServicesPromise}
        popularProjectsPromise={popularProjectsPromise}
      />
      <HowItWorksSection />
      <FeaturesSection />
      <ProfessionalsSection/>
      <CTASection />
    </main>
  )
}
