import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import StatsStrip from './components/StatsStrip.jsx';
import Footer from './components/Footer.jsx';
import { NoiseOverlay } from './components/Chrome.jsx';

export default function Landing() {
  return (
    <div className="relative min-h-full">
      <NoiseOverlay />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <StatsStrip />
        </main>
        <Footer />
      </div>
    </div>
  );
}
