import HeroSection from '@/components/landing/HeroSection'
import ProblemSection from '@/components/landing/ProblemSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import RecursosSection from '@/components/landing/RecursosSection'
import PricingSection from '@/components/landing/PricingSection'
import FaqSection from '@/components/landing/FaqSection'
import CtaSection from '@/components/landing/CtaSection'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <RecursosSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </main>
  )
}
