'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Utensils, Navigation as NavIcon, Menu, X } from 'lucide-react';
import { useState } from 'react';
import * as motion from 'motion/react-client';

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', href: '/', iconName: null },
    { name: 'Itinerary Planner', href: '/planner', iconName: 'map' },
    { name: 'Food Hunter', href: '/food', iconName: 'utensils' },
    { name: 'Nearby Me', href: '/nearby', iconName: 'nav' },
  ];

  const renderNavIcon = (name: string | null) => {
    if (!name) return null;
    if (name === 'map') return <Map className="w-4 h-4 mr-2" />;
    if (name === 'utensils') return <Utensils className="w-4 h-4 mr-2" />;
    return <NavIcon className="w-4 h-4 mr-2" />;
  };

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-dark-bg/80 border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="font-mono text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple text-glow-cyan">
                MyTripPlanner
              </span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                      ${isActive 
                        ? 'text-white bg-dark-card border border-dark-border shadow-glow-purple' 
                        : 'text-gray-400 hover:text-white hover:bg-dark-card'
                      }
                    `}
                  >
                    {renderNavIcon(link.iconName)}
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-dark-card focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-dark-card border-b border-dark-border"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium
                    ${isActive 
                      ? 'text-white bg-dark-border shadow-glow-purple' 
                      : 'text-gray-400 hover:text-white hover:bg-dark-border'
                    }
                  `}
                >
                  {renderNavIcon(link.iconName)}
                  {link.name}
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </nav>
  );
}