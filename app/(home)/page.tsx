import HeroSection from '@/components/HeroSection'
import HowItWorksSection from '@/components/HowItWorksSection'
import FeaturesSection from '@/components/FeaturesSection'
import CTASection from '@/components/CTASection'
import ProfessionalsSection from '@/components/ProfessionalsSection'
import { getPopularProjects, getPopularServices } from '@/lib/server/popular'

export const revalidate = 60

export default async function Home() {
  const [popularServices, popularProjects] = await Promise.all([
    getPopularServices(5),
    getPopularProjects({ limit: 10 }),
  ])

  return (
    <main className="min-h-screen bg-white">
      <HeroSection
        popularServices={popularServices}
        popularProjects={popularProjects}
      />
      <HowItWorksSection />
      <FeaturesSection />
      <ProfessionalsSection/>
      <CTASection />
    </main>
  )
}
