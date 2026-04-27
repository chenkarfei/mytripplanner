import Navigation from '@/components/Navigation';
import ItineraryPlannerClient from '@/components/ItineraryPlannerClient';

export default function PlannerPage() {
  return (
    <>
      <Navigation />
      <main className="flex-1 flex flex-col p-4 sm:p-8 bg-dark-bg min-h-screen">
        <div className="max-w-5xl w-full mx-auto space-y-8">
          <div className="text-center space-y-4 pt-8">
            <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-tighter">
              AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple text-glow-cyan">Itinerary Planner</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light">
              Craft the perfect trip. Tell us where, your vibe, and your pacing, and we&apos;ll generate a day-by-day masterpiece.
            </p>
          </div>
          
          <ItineraryPlannerClient />
        </div>
      </main>
    </>
  );
}
