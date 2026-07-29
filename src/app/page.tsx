import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import HeroSection from '@/components/landing/HeroSection'
import ProblemSection from '@/components/landing/ProblemSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import TrackingSection from '@/components/landing/TrackingSection'
import RecursosSection from '@/components/landing/RecursosSection'
import PricingSection from '@/components/landing/PricingSection'
import FaqSection from '@/components/landing/FaqSection'
import CtaSection from '@/components/landing/CtaSection'
import Footer from '@/components/landing/Footer'
import ChatWidget from '@/components/landing/ChatWidget'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <TrackingSection />
      <RecursosSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <Footer />
      <ChatWidget />
    </main>
  )
}
