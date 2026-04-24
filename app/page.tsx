import Link from 'next/link';
import { Map, Utensils, Navigation as NavIcon, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';

export default function Home() {
  const features = [
    {
      title: 'AI Itinerary Planner',
      description: 'Generate hyper-personalized day-by-day schedules with tips, hidden gems, and travel times based on your trip vibe.',
      iconName: 'map',
      href: '/planner',
      glowClass: 'shadow-glow-cyan hover:border-neon-cyan/50',
      textGlow: 'group-hover:text-glow-cyan group-hover:text-neon-cyan',
      iconClass: 'text-neon-cyan',
    },
    {
      title: 'Route Food Hunter',
      description: 'Input your start and end points. Discover incredible restaurants along your exact route without massive detours.',
      iconName: 'utensils',
      href: '/food',
      glowClass: 'shadow-glow-pink hover:border-neon-pink/50',
      textGlow: 'group-hover:text-glow-pink group-hover:text-neon-pink',
      iconClass: 'text-neon-pink',
    },
    {
      title: 'Nearby Essentials',
      description: 'Emergency? Late night cravings? Find the closest strictly open ATMs, hospitals, and food spots instantly.',
      iconName: 'nav',
      href: '/nearby',
      glowClass: 'shadow-glow-purple hover:border-neon-purple/50',
      textGlow: 'group-hover:text-glow-purple group-hover:text-neon-purple',
      iconClass: 'text-neon-purple',
    },
  ];

  const renderIcon = (name: string, className: string) => {
    if (name === 'map') return <Map className={`w-8 h-8 ${className}`} />;
    if (name === 'utensils') return <Utensils className={`w-8 h-8 ${className}`} />;
    return <NavIcon className={`w-8 h-8 ${className}`} />;
  };

  return (
    <>
      <Navigation />
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 mt-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-dark-card via-dark-bg to-dark-bg">
        <div className="max-w-5xl w-full space-y-12 mb-16">
          <div className="text-center space-y-4">
            <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tighter">
              Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-neon-pink to-neon-purple">Explore?</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto font-light">
              Your intelligent co-pilot for predicting the perfect route, the ultimate itinerary, and whatever you need right now.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Link 
                key={i} 
                href={feature.href}
                className={`group relative flex flex-col bg-dark-card border border-dark-border p-8 rounded-2xl transition-all duration-300 hover:-translate-y-2 ${feature.glowClass}`}
              >
                <div className="mb-6 p-4 bg-dark-bg rounded-xl inline-flex self-start border border-dark-border">
                  {renderIcon(feature.iconName, feature.iconClass)}
                </div>
                <h3 className={`text-2xl font-mono font-semibold mb-3 text-white transition-colors duration-300 ${feature.textGlow}`}>
                  {feature.title}
                </h3>
                <p className="text-gray-400 flex-grow text-sm leading-relaxed mb-8">
                  {feature.description}
                </p>
                <div className="flex items-center text-sm font-medium text-gray-300 group-hover:text-white transition-colors mt-auto">
                  Launch module <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}