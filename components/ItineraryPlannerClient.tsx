'use client';

import { useState } from 'react';
import { MapPin, Calendar, Compass, Activity, Loader2, Sparkles, Map } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

interface ActivityItem {
  time: string;
  activityName: string;
  description: string;
  location: string;
  estimatedCost: string;
  travelTimeFromPrevious: string;
  type: string;
}

interface DayPlan {
  dayNumber: number;
  dateTheme: string;
  activities: ActivityItem[];
}

interface ItineraryResult {
  title: string;
  description: string;
  tripDetails: {
    vibe: string;
    pacing: string;
    durationDays: number;
    bestTimeToVisit: string;
    budgetEstimate: string;
  };
  days: DayPlan[];
  tips: string[];
}

export default function ItineraryPlannerClient() {
  // Initialize Gemini API
  // Note: NEXT_PUBLIC_GEMINI_API_KEY must be configured in AI Studio Secrets
  const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
  const [destination, setDestination] = useState('');
  const [vibe, setVibe] = useState('Adventure');
  const [pacing, setPacing] = useState('Medium');
  const [days, setDays] = useState('3');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ItineraryResult | null>(null);

  const generateItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) {
      setError('Please enter a destination.');
      return;
    }
    
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError('Gemini API Key is missing. Please configure it in your secrets.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const prompt = `Create a detailed travel itinerary for a trip to ${destination}. 
      Vibe/Style: ${vibe}
      Pacing: ${pacing} (Packed means lots of activities, Chill means relaxed with plenty of downtime)
      Duration: ${days} days
      
      Include hidden gems, realistic travel times between places, local food recommendations, and practical tips.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tripDetails: {
                type: Type.OBJECT,
                properties: {
                  vibe: { type: Type.STRING },
                  pacing: { type: Type.STRING },
                  durationDays: { type: Type.INTEGER },
                  bestTimeToVisit: { type: Type.STRING },
                  budgetEstimate: { type: Type.STRING },
                },
                required: ['vibe', 'pacing', 'durationDays', 'bestTimeToVisit', 'budgetEstimate']
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayNumber: { type: Type.INTEGER },
                    dateTheme: { type: Type.STRING },
                    activities: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING },
                          activityName: { type: Type.STRING },
                          description: { type: Type.STRING },
                          location: { type: Type.STRING },
                          estimatedCost: { type: Type.STRING },
                          travelTimeFromPrevious: { type: Type.STRING },
                          type: { type: Type.STRING, description: "e.g., Attraction, Food, Hotel, Transit, Hidden Gem" }
                        },
                        required: ['time', 'activityName', 'description', 'location', 'estimatedCost', 'travelTimeFromPrevious', 'type']
                      }
                    }
                  },
                  required: ['dayNumber', 'dateTheme', 'activities']
                }
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['title', 'description', 'tripDetails', 'days', 'tips']
          }
        }
      });

      const rawText = typeof response.text === 'string' ? response.text : String(response.text ?? '');
      if (rawText) {
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed: ItineraryResult = JSON.parse(cleaned);
        const safe: ItineraryResult = JSON.parse(JSON.stringify(parsed));
        setResult(safe);
      } else {
        setError('Received empty response from the AI.');
      }
    } catch (err: unknown) {
      let errorMessage = 'An error occurred while generating the itinerary.';
      if (err instanceof Error) {
         errorMessage = err.message;
      } else if (typeof err === 'string') {
         errorMessage = err;
      }
      console.error('Itinerary generation error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '[Complex Object]';
  };

  return (
    <div className="space-y-12">
      {/* Input Form */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 md:p-8 shadow-glow-cyan max-w-4xl mx-auto w-full">
        <form onSubmit={generateItinerary} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-neon-cyan" /> Destination
              </label>
              <input 
                type="text" 
                placeholder="e.g. Tokyo, Japan"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan transition-colors"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <Compass className="w-4 h-4 mr-2 text-neon-purple" /> Trip Vibe
              </label>
              <select 
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-purple transition-colors appearance-none"
              >
                <option value="Adventure & Action">Adventure & Action</option>
                <option value="Romantic & Relaxing">Romantic & Relaxing</option>
                <option value="Budget Backpacker">Budget Backpacker</option>
                <option value="Family with Kids">Family with Kids</option>
                <option value="Luxury & Indulgence">Luxury & Indulgence</option>
                <option value="Culture & History">Culture & History</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-neon-pink" /> Pacing
              </label>
              <select 
                value={pacing}
                onChange={(e) => setPacing(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-pink transition-colors appearance-none"
              >
                <option value="Packed (See everything)">Packed (See everything)</option>
                <option value="Medium (Balanced)">Medium (Balanced)</option>
                <option value="Chill (1-2 main events a day)">Chill (1-2 main events a day)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-neon-cyan" /> Duration (Days)
              </label>
              <input 
                type="number" 
                min="1"
                max="14"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-transparent border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black font-bold py-4 rounded-lg transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Calculating best routes & gems...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-3 group-hover:animate-pulse" />
                Generate My Itinerary
              </>
            )}
          </button>
        </form>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white">{renderString(result.title)}</h2>
            <p className="text-gray-400">{renderString(result.description)}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {result.tripDetails?.durationDays && (
                <span className="px-3 py-1 bg-dark-card border border-dark-border rounded-full text-xs font-mono text-neon-cyan">
                  {renderString(result.tripDetails.durationDays)} Days
                </span>
              )}
              {result.tripDetails?.vibe && (
                <span className="px-3 py-1 bg-dark-card border border-dark-border rounded-full text-xs font-mono text-neon-purple">
                  {renderString(result.tripDetails.vibe)}
                </span>
              )}
              {result.tripDetails?.pacing && (
                <span className="px-3 py-1 bg-dark-card border border-dark-border rounded-full text-xs font-mono text-neon-pink">
                  {renderString(result.tripDetails.pacing)} Pacing
                </span>
              )}
              {result.tripDetails?.budgetEstimate && (
                <span className="px-3 py-1 bg-dark-card border border-dark-border rounded-full text-xs font-mono text-neon-green">
                  Budget: {renderString(result.tripDetails.budgetEstimate)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {Array.isArray(result.days) && result.days.map((day, dIdx) => (
                <div key={day.dayNumber != null ? String(day.dayNumber) : `day-${dIdx}`} className="bg-dark-card border border-dark-border rounded-2xl p-6 md:p-8">
                  <div className="flex items-baseline justify-between mb-6 border-b border-dark-border pb-4">
                    <h3 className="text-2xl font-bold text-white">Day {renderString(day.dayNumber)}</h3>
                    {day.dateTheme && <span className="text-sm text-neon-cyan font-mono">{renderString(day.dateTheme)}</span>}
                  </div>
                  
                  <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-[2.25rem] before:md:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-dark-border before:to-transparent">
                    {Array.isArray(day.activities) && day.activities.map((activity, idx) => (
                      <div key={idx} className="relative flex items-start md:items-center justify-between group">
                        <div className="font-mono text-sm text-gray-400 w-20 flex-shrink-0 pt-1 md:pt-0">
                          {renderString(activity.time)}
                        </div>
                        
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-dark-border bg-dark-bg absolute left-[1.125rem] md:left-[4.5rem] transform -translate-x-1/2 group-hover:border-neon-cyan transition-colors z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 group-hover:bg-neon-cyan transition-colors" />
                        </div>
                        
                        <div className="ml-8 md:ml-12 p-4 bg-dark-bg border border-dark-border rounded-xl w-full group-hover:border-dark-border/80 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white text-lg">{renderString(activity.activityName)}</h4>
                            {activity.type && (
                              <span className="text-xs px-2 py-1 bg-dark-card rounded font-mono text-gray-400">
                                {renderString(activity.type).substring(0, 15)}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-400 mb-3">{renderString(activity.description)}</p>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-mono mt-2 pt-3 border-t border-dark-border/50">
                            {activity.location && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {renderString(activity.location)}</span>}
                            {activity.estimatedCost && <span>💰 {renderString(activity.estimatedCost)}</span>}
                            {activity.travelTimeFromPrevious && activity.travelTimeFromPrevious !== "0" && activity.travelTimeFromPrevious !== "N/A" && (
                              <span className="text-neon-pink flex items-center">
                                🚗 +{renderString(activity.travelTimeFromPrevious)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sticky top-24">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Map className="w-5 h-5 mr-2 text-neon-purple" /> Trip Intelligence
                </h3>
                
                {result.tripDetails?.bestTimeToVisit && (
                  <div className="mb-6 space-y-2">
                    <h4 className="text-sm text-gray-400 uppercase tracking-wider font-bold">Best Time to Visit</h4>
                    <p className="text-sm text-white">{renderString(result.tripDetails.bestTimeToVisit)}</p>
                  </div>
                )}
                
                {Array.isArray(result.tips) && result.tips.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm text-gray-400 uppercase tracking-wider font-bold">Pro Tips</h4>
                    <ul className="space-y-3">
                      {result.tips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-gray-300 flex items-start">
                          <span className="text-neon-cyan mr-2">•</span>
                          {renderString(tip)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}