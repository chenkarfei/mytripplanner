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
  crowdAdvice?: string;
  familyTip?: string;
}

interface DayPlan {
  dayNumber: number;
  dateTheme: string;
  city: string;
  activities: ActivityItem[];
}

interface ItineraryResult {
  title: string;
  description: string;
  routeSequence: string[];
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
  const [mustSee, setMustSee] = useState('');
  const [vibe, setVibe] = useState('Adventure & Action');
  const [pacing, setPacing] = useState('Medium (Balanced)');
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState('');
  const [refinementNotes, setRefinementNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ItineraryResult | null>(null);

  const generateItinerary = async (e?: React.FormEvent, isRefining: boolean = false) => {
    if (e) e.preventDefault();
    if (!destination) {
      setError('Please enter at least one destination.');
      return;
    }
    
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError('Gemini API Key is missing. Please configure it in your secrets.');
      return;
    }

    setLoading(true);
    setError('');
    
    // Only reset result if we are NOT refining
    if (!isRefining) {
      setResult(null);
    }

    let prompt = `Create a detailed travel itinerary for a trip visiting these cities/destinations: ${destination}. 
      
      CRITICAL INSTRUCTIONS:
      1. Route Optimization: Analyze the list of cities and sequence them in the most logical, efficient geographic order to minimize total travel time.
      2. Multi-City Logic: If multiple cities are provided, clearly define the "base city" for each day.
      3. Inter-city Travel: Explicitly include transit blocks (train, flight, bus) for days when traveling between cities.
      
      TRIP SPECIFICATIONS:
      Vibe/Style: ${vibe}
      Pacing: ${pacing}
      Duration: ${days} days
      ${startDate ? `Proposed Start Date: ${startDate}` : ''}
      
      CURRENCY: Provide all estimated costs and budgets in Malaysian Ringgit (RM).

      SPECIFIC CROWD & FAMILY INSTRUCTIONS:
      1. Crowd Avoidance: For every activity, suggest the best specific day of the week or time of day to avoid heavy crowds (e.g., weekends vs weekdays, early mornings).
      2. Public Holidays: Check if the trip overlaps with any major local public holidays or school holidays for ${destination} and warn the user in the prompt output or tips.
      3. Family & Stroller Comfort: Provide a "Family Tip" for attractions, noting if they are stroller-friendly or if there are specific challenges for families (like the West Lake bus situation or Disney holiday surges).`;

    if (mustSee) {
      prompt += `\n\nMUST-SEE SPOTS: The user explicitly wants to visit these places: ${mustSee}. Ensure these are included in the itinerary.`;
    }

    if (isRefining && refinementNotes && result) {
      prompt += `\n\nUSER FEEDBACK / REFINEMENT: The user has previously seen an itinerary titled "${result.title}" but wants changes: "${refinementNotes}". Please adjust the itinerary based on this feedback while keeping the core destination and constraints.`;
    }

    prompt += `\n\nInclude hidden gems, realistic travel times, local food recommendations, and practical logistics for inter-city movement.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              routeSequence: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "The optimized order of cities to visit"
              },
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
                    city: { type: Type.STRING, description: "The city where the user is based on this day" },
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
                          type: { type: Type.STRING, description: "e.g., Attraction, Food, Hotel, Transit, Hidden Gem" },
                          crowdAdvice: { type: Type.STRING, description: "Best time/day to avoid crowds for this specific spot" },
                          familyTip: { type: Type.STRING, description: "Advice for families with kids/strollers" }
                        },
                        required: ['time', 'activityName', 'description', 'location', 'estimatedCost', 'travelTimeFromPrevious', 'type']
                      }
                    }
                  },
                  required: ['dayNumber', 'dateTheme', 'city', 'activities']
                }
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['title', 'description', 'routeSequence', 'tripDetails', 'days', 'tips']
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
                <MapPin className="w-4 h-4 mr-2 text-neon-cyan" /> Destinations / Cities
              </label>
              <input 
                type="text" 
                placeholder="e.g. Tokyo, Kyoto, Osaka"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan transition-colors"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-neon-green" /> Must-See Spots (Optional)
              </label>
              <input 
                type="text" 
                placeholder="e.g. DisneySea, TeamLab, Ghibli Museum"
                value={mustSee}
                onChange={(e) => setMustSee(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-green transition-colors"
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
                max="21"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-neon-cyan" /> Tentative Start Date (Optional)
              </label>
              <input 
                type="text" 
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onFocus={(e) => (e.currentTarget.type = 'date')}
                onBlur={(e) => {
                  if (!e.currentTarget.value) e.currentTarget.type = 'text';
                }}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan transition-colors"
                style={{ colorScheme: 'dark' }}
              />
              <p className="text-[10px] text-gray-500">Helps AI check for local holidays & events</p>
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
            <p className="text-gray-400 max-w-2xl mx-auto">{renderString(result.description)}</p>
            
            {/* Refinement Shortcut */}
            <div className="max-w-xl mx-auto pt-4">
              <div className="relative group">
                <input 
                  type="text"
                  placeholder="Don't like something? Tell us (e.g. 'Exclude hiking', 'Add more local food')"
                  value={refinementNotes}
                  onChange={(e) => setRefinementNotes(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-full px-6 py-3 pr-24 text-sm text-white focus:outline-none focus:border-neon-cyan transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && refinementNotes) generateItinerary(undefined, true);
                  }}
                />
                <button
                  onClick={() => generateItinerary(undefined, true)}
                  disabled={loading || !refinementNotes}
                  className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan hover:text-black rounded-full text-xs font-bold transition-all disabled:opacity-50"
                >
                  Refine
                </button>
              </div>
            </div>

            {Array.isArray(result.routeSequence) && result.routeSequence.length > 1 && (
              <div className="flex items-center justify-center gap-2 text-sm font-mono py-2">
                {result.routeSequence.map((city, idx) => (
                  <span key={idx} className="flex items-center group">
                    <span className="text-white group-hover:text-neon-cyan transition-colors">{renderString(city)}</span>
                    {idx < result.routeSequence.length - 1 && (
                      <span className="mx-2 text-gray-600">→</span>
                    )}
                  </span>
                ))}
              </div>
            )}

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
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-white">Day {renderString(day.dayNumber)}</h3>
                      <div className="flex items-center text-neon-cyan font-mono text-xs">
                        <MapPin className="w-3 h-3 mr-1" />
                        {renderString(day.city)}
                      </div>
                    </div>
                    {day.dateTheme && <span className="text-sm text-gray-500 font-mono italic">{renderString(day.dateTheme)}</span>}
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
                          
                          {(activity.crowdAdvice || activity.familyTip) && (
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {activity.crowdAdvice && (
                                <div className="p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 text-xs">
                                  <div className="flex items-center text-neon-cyan font-bold mb-1 uppercase tracking-tighter">
                                    <Activity className="w-3 h-3 mr-1" /> Crowd Alert
                                  </div>
                                  <span className="text-gray-300">{renderString(activity.crowdAdvice)}</span>
                                </div>
                              )}
                              {activity.familyTip && (
                                <div className="p-3 rounded-lg bg-neon-purple/5 border border-neon-purple/20 text-xs">
                                  <div className="flex items-center text-neon-purple font-bold mb-1 uppercase tracking-tighter">
                                    <Sparkles className="w-3 h-3 mr-1" /> Family Logic
                                  </div>
                                  <span className="text-gray-300">{renderString(activity.familyTip)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-mono mt-2 pt-3 border-t border-dark-border/50">
                            {activity.location && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {renderString(activity.location)}</span>}
                            {activity.estimatedCost && <span>{renderString(activity.estimatedCost)}</span>}
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
