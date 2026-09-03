import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import StatsStrip from './components/StatsStrip.jsx';
import Footer from './components/Footer.jsx';
import { NoiseOverlay } from './components/Chrome.jsx';

// The landing page holds for ten seconds, then hands over to the simulator.
// These are separate documents, so the crossfade is done in two halves: this
// page fades UP to a dark cover and navigates underneath it, and the
// simulator opens under the same dark cover and fades it back down. The seam
// lands while the screen is solid, so it reads as one transition.
const HOLD_MS = 10000;
const FADE_MS = 900;

export default function Landing() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const toFade = setTimeout(() => setLeaving(true), HOLD_MS);
    const toGo = setTimeout(() => {
      window.location.href = `${import.meta.env.BASE_URL}simulator.html`;
    }, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(toFade);
      clearTimeout(toGo);
    };
  }, []);

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

      {/* A hairline at the very top of the page counts the hold down. Ten
          seconds of apparently nothing followed by a jump would read as a
          glitch; this makes the handover something the room can see coming. */}
      <motion.div
        className="fixed inset-x-0 top-0 z-40 h-[3px] origin-left"
        style={{ background: 'var(--accent)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
        aria-hidden="true"
      />

      <motion.div
        className="pointer-events-none fixed inset-0 z-50 bg-[#05080f]"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 1 : 0 }}
        transition={{ duration: FADE_MS / 1000, ease: 'easeIn' }}
        aria-hidden="true"
      />
    </div>
  );
}
