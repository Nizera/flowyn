import Nav from "./_landing/Nav";
import Hero from "./_landing/Hero";
import LogoWall from "./_landing/LogoWall";
import Pain from "./_landing/Pain";
import HowItWorks from "./_landing/HowItWorks";
import Benefits from "./_landing/Benefits";
import Integrations from "./_landing/Integrations";
import Testimonials from "./_landing/Testimonials";
import Stats from "./_landing/Stats";
import Rates from "./_landing/Rates";
import FinalCTA from "./_landing/FinalCTA";
import Footer from "./_landing/Footer";

export const metadata = {
  title: "Flowyn — Marketplace de Afiliados para Infoprodutos e MicroSaaS",
  description: "Publique cursos, e-books e mentorias ou afilie-se aos MicroSaaS da Flowyn. Checkout nativo, order bumps, split automático via Asaas e área de membros integrada.",
};

export default function Home() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <Nav />
      <main>
        <Hero />
        <LogoWall />
        <Pain />
        <HowItWorks />
        <Benefits />
        <Integrations />
        <Testimonials />
        <Rates />
        <Stats />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
