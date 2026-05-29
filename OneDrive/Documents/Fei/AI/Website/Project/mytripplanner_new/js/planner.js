(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────────────────── */
  const GEMINI_API_KEY = 'AIzaSyBHrV0pkicEU-B4fHuC-52DM2HqH5TXnOo';
  const GEMINI_MODEL   = 'gemini-2.0-flash-lite';
  const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const REQUEST_TIMEOUT_MS = 90000; // 90 seconds

  /* ── State ─────────────────────────────────────────────────────────── */
  let mustSeeSpots       = [];
  let spotSuggestions    = [];
  let loadingSuggestions = false;
  let avoidCrowds        = false;
  let accommodationTier  = 'No Preference';
  let activeTab          = 'itinerary';
  let loading            = false;
  let refreshingAccom    = false;
  let refreshingDays     = new Set();
  let result             = null;

  /* ── DOM refs ──────────────────────────────────────────────────────── */
  let destinationEl, startDateEl, spotInputEl, spotTagsEl;
  let suggestionsDropdown, suggestionsList, suggestionsLabel;
  let vibeEl, companionEl, pacingEl, daysEl;
  let crowdToggle, crowdLabel;
  let tierButtons;
  let errorBox, generateBtn, generateLabel;
  let resultsEl, tripHeaderEl;
  let tabBtns, tabPanels;

  /* ── Helpers ───────────────────────────────────────────────────────── */
  function renderString(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '';
  }

  function esc(str) {
    return String(renderString(str))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStars(rating) {
    const num = parseFloat(rating);
    if (isNaN(num)) return '';
    const full = Math.floor(num);
    let html = '<span class="stars">';
    for (let i = 0; i < 5; i++) {
      html += i < full
        ? '<svg class="star-filled" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        : '<svg class="star-empty" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    html += `<span style="font-size:0.75rem;color:var(--color-text-muted);margin-left:0.25rem">${esc(rating)}</span></span>`;
    return html;
  }

  function getActivityBadgeClass(type) {
    const t = String(type).toLowerCase();
    if (t.includes('food') || t.includes('dining') || t.includes('restaurant') || t.includes('cafe') || t.includes('hawker'))
      return 'badge-emerald';
    if (t.includes('transit') || t.includes('travel') || t.includes('flight') || t.includes('train') || t.includes('bus') || t.includes('transfer'))
      return 'badge-rose';
    if (t.includes('hotel') || t.includes('accommodation') || t.includes('check') || t.includes('hostel') || t.includes('hidden') || t.includes('gem') || t.includes('local'))
      return 'badge-gold';
    if (t.includes('attraction') || t.includes('landmark') || t.includes('museum') || t.includes('temple') || t.includes('park'))
      return 'badge-sky';
    return 'badge-gray';
  }

  /* ── Gemini API ────────────────────────────────────────────────────── */
  async function geminiRequest(prompt, schema) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    };

    let res;
    try {
      res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out after 90 seconds. The API may be slow — please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini.');
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  }

  /* ── Spot suggestions ──────────────────────────────────────────────── */
  async function fetchSpotSuggestions() {
    const destination = destinationEl.value.trim();
    if (!destination || spotSuggestions.length > 0 || loadingSuggestions) return;
    loadingSuggestions = true;
    spotInputEl.placeholder = 'Loading suggestions...';

    try {
      const schema = {
        type: 'object',
        properties: { spots: { type: 'array', items: { type: 'string' } } },
        required: ['spots']
      };
      const res = await geminiRequest(
        `List 18 famous tourist attractions, hidden gems, and must-visit spots in: ${destination}. Return ONLY a JSON array of short English strings, no explanations.`,
        schema
      );
      spotSuggestions = Array.isArray(res.spots) ? res.spots : [];
    } catch {
      // silently fail — user can still type manually
    } finally {
      loadingSuggestions = false;
      spotInputEl.placeholder = 'Type a spot or pick from suggestions below';
      renderSuggestions();
    }
  }

  function renderSuggestions() {
    const destination = destinationEl.value.trim();
    const visible = spotSuggestions.filter(s => !mustSeeSpots.includes(s));
    if (!visible.length) { suggestionsDropdown.style.display = 'none'; return; }
    suggestionsLabel.textContent = `Suggested for ${destination}`;
    suggestionsList.innerHTML = visible.map(s =>
      `<button type="button" class="suggestion-btn" data-spot="${esc(s)}">+ ${esc(s)}</button>`
    ).join('');
    suggestionsDropdown.style.display = 'block';
  }

  function addSpot(name) {
    const trimmed = name.trim();
    if (trimmed && !mustSeeSpots.includes(trimmed)) {
      mustSeeSpots.push(trimmed);
      renderSpotTags();
    }
    spotInputEl.value = '';
  }

  function removeSpot(name) {
    mustSeeSpots = mustSeeSpots.filter(s => s !== name);
    renderSpotTags();
    renderSuggestions();
  }

  function renderSpotTags() {
    if (!mustSeeSpots.length) {
      spotTagsEl.style.display = 'none';
      return;
    }
    spotTagsEl.style.display = 'flex';
    spotTagsEl.innerHTML = mustSeeSpots.map(spot =>
      `<span class="spot-tag">${esc(spot)}
        <button type="button" class="spot-tag-remove" data-remove="${esc(spot)}">×</button>
       </span>`
    ).join('');
    spotTagsEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => removeSpot(btn.dataset.remove));
    });
  }

  /* ── Build itinerary prompt ────────────────────────────────────────── */
  function buildPrompt(isRefining) {
    const destination    = destinationEl.value.trim();
    const vibe           = vibeEl.value;
    const companion      = companionEl.value;
    const pacing         = pacingEl.value;
    const days           = daysEl.value;
    const startDate      = startDateEl.value.trim();
    const refinementNote = document.getElementById('refinement-input')?.value.trim() || '';

    let prompt = `Create a detailed travel itinerary for a trip visiting these cities/destinations: ${destination}.

      CRITICAL INSTRUCTIONS:
      1. Route Optimization: Analyze the list of cities and sequence them in the most logical, efficient geographic order to minimize total travel time.
      2. Multi-City Logic: If multiple cities are provided, clearly define the "base city" for each day.
      3. Inter-city Travel: Explicitly include transit blocks (train, flight, bus) for days when traveling between cities.

      TRIP SPECIFICATIONS:
      Vibe/Style: ${vibe}
      Traveling With: ${companion}
      Pacing: ${pacing}
      Duration: ${days} days
      ${startDate ? `Proposed Start Date: ${startDate}` : ''}

      CURRENCY: Provide all estimated costs and budgets in Malaysian Ringgit (RM).

      SPECIFIC CROWD & FAMILY INSTRUCTIONS:
      1. Crowd Avoidance: For every activity, suggest the best specific day of the week or time of day to avoid heavy crowds (e.g., weekends vs weekdays, early mornings).
      2. Public Holidays & Date Accuracy: CRITICAL: Verify the exact dates of public holidays for the year 2026 in the specific region (e.g., Malaysia).
         - NOTE: For Malaysia in 2026, Wesak Day is May 31, NOT May 3.
         - Labor Day is May 1.
         - Ensure you do not incorrectly group holidays or warn about clashing dates that are weeks apart.
      3. Family & Stroller Comfort: ${companion === 'Family with Kids' ? 'Provide a "Family Tip" for every attraction, noting stroller-friendliness and specific challenges for families with young children.' : 'The trip vibe is NOT family-focused. Do NOT include any familyTip fields — leave them empty or omit them entirely.'}
      4. Companion Context: Tailor ALL recommendations to the travel group:
         - "Solo Explorer": solo-friendly activities, safety tips for solo travellers, budget-conscious options, opportunities to meet other travellers.
         - "Couple": intimate dining settings, romantic experiences, couples spa/activities, private or boutique stays.
         - "Friends Group": venues with large tables or group bookings, activities that scale (e.g. escape rooms, karaoke, beach clubs), lively nightlife options if appropriate to the vibe.
         - "Family with Kids": (covered by Family & Stroller Comfort rule above).`;

    if (mustSeeSpots.length > 0) {
      prompt += `\n\nMUST-SEE SPOTS: The user explicitly wants to visit these places: ${mustSeeSpots.join(', ')}. Ensure these are included in the itinerary.`;
    }

    if (isRefining && refinementNote && result) {
      prompt += `\n\nUSER FEEDBACK / REFINEMENT: The user has previously seen an itinerary titled "${result.title}" but wants changes: "${refinementNote}". Please adjust the itinerary based on this feedback while keeping the core destination and constraints.`;
    }

    prompt += `\n\nInclude hidden gems, realistic travel times, local food recommendations, and practical logistics for inter-city movement.`;

    if (accommodationTier === 'No Preference') {
      prompt += `\n\nACCOMMODATION INSTRUCTIONS:
For EACH unique city in the itinerary, provide exactly 3 accommodation options at 3 tiers: Budget, Mid-Range, and Luxury.
- All prices in Malaysian Ringgit (RM) reflecting realistic local market rates.
- Each option: hotel/hostel name, nightly price range in RM, 2-3 specific highlights, and a "bestFor" descriptor.
- Match recommendations to the trip vibe (${vibe}): e.g. for "Luxury & Indulgence" prioritize 5-star; for "Budget & Thrifty" surface well-reviewed hostels/guesthouses.
- For each option also include: area (neighbourhood/district, e.g. "Bukit Bintang, KL"), amenities (array of up to 6 from: WiFi, Pool, Breakfast, Parking, Gym, Spa, Restaurant, AC, Airport Shuttle), rating (approximate decimal guest rating e.g. "4.3"), bookingTip (one short practical booking tip).`;
    } else {
      prompt += `\n\nACCOMMODATION INSTRUCTIONS:
The user has chosen a specific accommodation preference: ${accommodationTier}.
For EACH unique city in the itinerary, provide exactly 3 accommodation options, ALL within the ${accommodationTier} tier.
- Budget tier: hostels, guesthouses, 1-2 star hotels only.
- Mid-Range tier: 3-star hotels and boutique stays only.
- Luxury tier: 4-5 star hotels and resorts only.
- All prices in Malaysian Ringgit (RM) reflecting realistic local market rates.
- Each option: hotel/hostel name, nightly price range in RM, 2-3 specific highlights, and a "bestFor" descriptor.
- Set the "tier" field on every option to exactly "${accommodationTier}".
- For each option also include: area (neighbourhood/district, e.g. "Bukit Bintang, KL"), amenities (array of up to 6 from: WiFi, Pool, Breakfast, Parking, Gym, Spa, Restaurant, AC, Airport Shuttle), rating (approximate decimal guest rating e.g. "4.3"), bookingTip (one short practical booking tip).`;
    }

    if (avoidCrowds) {
      prompt += `\n\nCROWD AVOIDANCE (USER PREFERENCE - HIGH PRIORITY):
The user has requested off-peak scheduling. You MUST:
- Schedule popular attractions (temples, dim sum restaurants, markets, theme parks) on WEEKDAYS (Mon–Thu), not weekends.
- Assign early morning slots (before 9am) or late afternoon slots (after 4pm) to any spot known for crowds.
- If the trip spans a weekend, fill Saturday/Sunday with lower-traffic activities: nature walks, neighbourhood strolls, less-touristed spots.
- Do NOT schedule famous food spots (dim sum, popular hawker stalls) on weekend mornings.
This is not advisory — it must directly affect the day and time slots chosen in the itinerary.`;
    }

    prompt += `\n\nBUDGET BREAKDOWN INSTRUCTIONS:
Provide a detailed cost breakdown in Malaysian Ringgit (RM) with exactly these 5 categories:
1. Accommodation — based on ${accommodationTier === 'No Preference' ? 'mid-range as default' : accommodationTier + ' tier'}
2. Food & Dining — daily meals, street food, cafes, and restaurants
3. Transport — local transport within cities AND inter-city travel (flights, trains, buses)
4. Activities & Attractions — entrance fees, tours, and experiences
5. Miscellaneous — shopping, tips, SIM card, buffer for unexpected costs

For each category provide:
- dailyEstimate: e.g. "RM 80 – RM 150 / day"
- tripTotal: e.g. "RM 560 – RM 1,050 for ${days} days"
- notes: one short sentence of context (e.g. "Includes KL–Penang flight ~RM 120")

Also provide a grandTotal range (sum of all 5 categories) and a brief overall notes string.`;

    return prompt;
  }

  /* ── Itinerary response schema ─────────────────────────────────────── */
  const ITINERARY_SCHEMA = {
    type: 'object',
    properties: {
      title:       { type: 'string' },
      description: { type: 'string' },
      routeSequence: { type: 'array', items: { type: 'string' } },
      tripDetails: {
        type: 'object',
        properties: {
          vibe:            { type: 'string' },
          pacing:          { type: 'string' },
          durationDays:    { type: 'integer' },
          bestTimeToVisit: { type: 'string' },
          budgetEstimate:  { type: 'string' },
        },
        required: ['vibe', 'pacing', 'durationDays', 'bestTimeToVisit', 'budgetEstimate']
      },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dayNumber: { type: 'integer' },
            dateTheme: { type: 'string' },
            city:      { type: 'string' },
            activities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time:                   { type: 'string' },
                  activityName:           { type: 'string' },
                  description:            { type: 'string' },
                  location:               { type: 'string' },
                  estimatedCost:          { type: 'string' },
                  travelTimeFromPrevious: { type: 'string' },
                  type:                   { type: 'string' },
                  crowdAdvice:            { type: 'string' },
                  familyTip:              { type: 'string' },
                },
                required: ['time', 'activityName', 'description', 'location', 'estimatedCost', 'travelTimeFromPrevious', 'type']
              }
            }
          },
          required: ['dayNumber', 'dateTheme', 'city', 'activities']
        }
      },
      tips: { type: 'array', items: { type: 'string' } },
      accommodations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            city:    { type: 'string' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tier:          { type: 'string' },
                  name:          { type: 'string' },
                  pricePerNight: { type: 'string' },
                  highlights:    { type: 'array', items: { type: 'string' } },
                  bestFor:       { type: 'string' },
                  area:          { type: 'string' },
                  amenities:     { type: 'array', items: { type: 'string' } },
                  rating:        { type: 'string' },
                  bookingTip:    { type: 'string' },
                },
                required: ['tier', 'name', 'pricePerNight', 'highlights', 'bestFor']
              }
            }
          },
          required: ['city', 'options']
        }
      },
      budgetBreakdown: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category:      { type: 'string' },
                dailyEstimate: { type: 'string' },
                tripTotal:     { type: 'string' },
                notes:         { type: 'string' },
              },
              required: ['category', 'dailyEstimate', 'tripTotal', 'notes']
            }
          },
          grandTotal: { type: 'string' },
          notes:      { type: 'string' },
        },
        required: ['categories', 'grandTotal', 'notes']
      }
    },
    required: ['title', 'description', 'routeSequence', 'tripDetails', 'days', 'tips', 'accommodations', 'budgetBreakdown']
  };

  /* ── Generate itinerary ────────────────────────────────────────────── */
  async function generateItinerary(isRefining) {
    const destination = destinationEl.value.trim();
    if (!destination) {
      showError('Please enter at least one destination.');
      return;
    }

    setLoading(true);
    hideError();
    setActiveTab('itinerary');
    if (!isRefining) {
      result = null;
      resultsEl.style.display = 'none';
    }

    try {
      const parsed = await geminiRequest(buildPrompt(isRefining), ITINERARY_SCHEMA);
      result = parsed;
      renderResults();
    } catch (err) {
      showError(err.message || 'An error occurred while generating the itinerary.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Refresh accommodations ────────────────────────────────────────── */
  async function refreshAccommodations() {
    if (!result) return;
    setRefreshingAccom(true);

    const cities = (result.routeSequence || []).join(', ');
    let prompt = `Suggest accommodations for a trip visiting these cities in order: ${cities}.`;

    if (accommodationTier === 'No Preference') {
      prompt += `\n\nFor EACH city provide exactly 3 accommodation options at 3 tiers: Budget, Mid-Range, and Luxury.
- All prices in Malaysian Ringgit (RM).
- Each option: hotel/hostel name, nightly price range in RM, 2-3 specific highlights, and a "bestFor" descriptor.
- For each option also include: area (neighbourhood/district), amenities (array of up to 6 from: WiFi, Pool, Breakfast, Parking, Gym, Spa, Restaurant, AC, Airport Shuttle), rating (decimal e.g. "4.3"), bookingTip (one short practical tip).`;
    } else {
      prompt += `\n\nThe user wants ${accommodationTier} accommodation only.
For EACH city provide exactly 3 options ALL within the ${accommodationTier} tier.
- Budget tier: hostels, guesthouses, 1-2 star hotels only.
- Mid-Range tier: 3-star hotels and boutique stays only.
- Luxury tier: 4-5 star hotels and resorts only.
- All prices in Malaysian Ringgit (RM).
- Each option: hotel/hostel name, nightly price range in RM, 2-3 specific highlights, and a "bestFor" descriptor.
- Set the "tier" field on every option to exactly "${accommodationTier}".
- For each option also include: area (neighbourhood/district), amenities (array of up to 6 from: WiFi, Pool, Breakfast, Parking, Gym, Spa, Restaurant, AC, Airport Shuttle), rating (decimal e.g. "4.3"), bookingTip (one short practical tip).`;
    }

    const schema = {
      type: 'object',
      properties: {
        accommodations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              city:    { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tier:          { type: 'string' },
                    name:          { type: 'string' },
                    pricePerNight: { type: 'string' },
                    highlights:    { type: 'array', items: { type: 'string' } },
                    bestFor:       { type: 'string' },
                    area:          { type: 'string' },
                    amenities:     { type: 'array', items: { type: 'string' } },
                    rating:        { type: 'string' },
                    bookingTip:    { type: 'string' },
                  },
                  required: ['tier', 'name', 'pricePerNight', 'highlights', 'bestFor']
                }
              }
            },
            required: ['city', 'options']
          }
        }
      },
      required: ['accommodations']
    };

    try {
      const parsed = await geminiRequest(prompt, schema);
      if (parsed.accommodations) {
        result.accommodations = parsed.accommodations;
        renderStaysTab();
      }
    } catch (err) {
      console.error('Failed to refresh accommodations:', err);
    } finally {
      setRefreshingAccom(false);
    }
  }

  /* ── Refresh single day ────────────────────────────────────────────── */
  const DAY_SCHEMA = {
    type: 'object',
    properties: {
      dayNumber:  { type: 'integer' },
      dateTheme:  { type: 'string' },
      city:       { type: 'string' },
      activities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            time:                   { type: 'string' },
            activityName:           { type: 'string' },
            description:            { type: 'string' },
            location:               { type: 'string' },
            estimatedCost:          { type: 'string' },
            travelTimeFromPrevious: { type: 'string' },
            type:                   { type: 'string' },
            crowdAdvice:            { type: 'string' },
            familyTip:              { type: 'string' },
          },
          required: ['time', 'activityName', 'description', 'location', 'estimatedCost', 'travelTimeFromPrevious', 'type']
        }
      }
    },
    required: ['dayNumber', 'dateTheme', 'city', 'activities']
  };

  async function refreshDay(dayIndex) {
    if (!result || refreshingDays.has(dayIndex)) return;
    refreshingDays.add(dayIndex);

    // Update button UI to show spinner
    const card = document.getElementById(`day-card-${dayIndex}`);
    const btn  = card?.querySelector('.refresh-day-btn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('svg').classList.add('animate-spin');
    }
    // Show loading overlay on the card
    const overlay = card?.querySelector('.day-refresh-overlay');
    if (overlay) overlay.style.display = 'flex';

    const day        = result.days[dayIndex];
    const vibe       = vibeEl.value;
    const companion  = companionEl.value;
    const pacing     = pacingEl.value;
    const days       = daysEl.value;
    const prevCity   = result.days[dayIndex - 1]?.city || null;
    const nextCity   = result.days[dayIndex + 1]?.city || null;

    const prompt = `The user has an existing ${days}-day trip titled "${result.title}" visiting ${destinationEl.value.trim()}.
Trip style — Vibe: ${vibe}, Traveling with: ${companion}, Pacing: ${pacing}.
${avoidCrowds ? 'Crowd avoidance is ON — use off-peak scheduling for this day.' : ''}

Day ${day.dayNumber} is based in ${day.city}.
${prevCity ? `Day ${day.dayNumber - 1} is in ${prevCity}.` : ''}
${nextCity ? `Day ${day.dayNumber + 1} is in ${nextCity}.` : ''}

Generate a COMPLETELY DIFFERENT set of activities for Day ${day.dayNumber} in ${day.city}.
Suggest different places, experiences, and restaurants — avoid repeating what a typical tourist itinerary would include.
Keep the same trip style, pacing, and all costs in Malaysian Ringgit (RM).
${companion === 'Family with Kids' ? 'Include a familyTip for every activity.' : 'Do NOT include any familyTip fields.'}
For every activity include a crowdAdvice tip (best time/day to avoid crowds).`;

    try {
      const parsed = await geminiRequest(prompt, DAY_SCHEMA);
      result.days[dayIndex] = parsed;
      renderSingleDayCard(dayIndex);
    } catch (err) {
      // Show inline error inside the card
      if (overlay) overlay.style.display = 'none';
      const errEl = card?.querySelector('.day-error');
      if (errEl) {
        errEl.textContent = err.message || 'Failed to refresh day. Please try again.';
        errEl.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.querySelector('svg').classList.remove('animate-spin');
      }
    } finally {
      refreshingDays.delete(dayIndex);
    }
  }

  /* ── UI State helpers ──────────────────────────────────────────────── */
  function setLoading(val) {
    loading = val;
    generateBtn.disabled = val;
    generateLabel.innerHTML = val
      ? '<svg class="animate-spin" style="display:inline;width:1.25rem;height:1.25rem;margin-right:0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Calculating best routes & gems...'
      : '<svg style="display:inline;width:1.25rem;height:1.25rem;margin-right:0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3 4 6"/><path d="m9 3-1 3"/><path d="M5 7 3 8"/></svg>Generate My Itinerary';
    lucide && lucide.createIcons && lucide.createIcons();
  }

  function setRefreshingAccom(val) {
    refreshingAccom = val;
    const btn = document.getElementById('refresh-stays-btn');
    const btnLabel = document.getElementById('refresh-stays-label');
    if (!btn) return;
    btn.disabled = val;
    if (btnLabel) btnLabel.textContent = val ? 'Refreshing...' : 'Refresh';
    const icon = btn.querySelector('svg');
    if (icon) icon.classList.toggle('animate-spin', val);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  function hideError() { errorBox.style.display = 'none'; }

  function setActiveTab(tab) {
    activeTab = tab;
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    tabPanels.forEach(panel => {
      panel.style.display = panel.id === `tab-${tab}` ? 'block' : 'none';
    });
  }

  /* ── Render results ────────────────────────────────────────────────── */
  function renderResults() {
    if (!result) return;
    renderTripHeader();
    renderItineraryTab();
    renderStaysTab();
    renderBudgetTab();
    resultsEl.style.display = 'block';
    setActiveTab('itinerary');
    setTimeout(() => lucide && lucide.createIcons && lucide.createIcons(), 50);
  }

  /* Trip header */
  function renderTripHeader() {
    const refinementVal = document.getElementById('refinement-input')?.value || '';
    let html = `
      <h2 style="font-size:1.875rem;font-weight:700" class="text-text">${esc(result.title)}</h2>
      <p style="color:var(--color-text-muted);max-width:42rem;margin:0 auto;line-height:1.625">${esc(result.description)}</p>
      <div class="refinement-wrap" style="max-width:36rem;margin:0.5rem auto 0">
        <input id="refinement-input" type="text" class="refinement-input"
               placeholder="Don't like something? Tell us (e.g. 'Exclude hiking', 'Add more local food')"
               value="${esc(refinementVal)}" />
        <button id="refine-btn" class="refinement-btn" disabled>Refine</button>
      </div>`;

    if (Array.isArray(result.routeSequence) && result.routeSequence.length > 1) {
      html += `<div class="route-seq">`;
      result.routeSequence.forEach((city, idx) => {
        html += `<span class="route-city">${esc(city)}</span>`;
        if (idx < result.routeSequence.length - 1) html += `<span class="route-arrow">→</span>`;
      });
      html += `</div>`;
    }

    html += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.75rem;padding-top:0.5rem">`;
    if (result.tripDetails?.durationDays)    html += `<span class="detail-badge" style="color:var(--color-sky)">${esc(result.tripDetails.durationDays)} Days</span>`;
    if (result.tripDetails?.vibe)            html += `<span class="detail-badge" style="color:var(--color-gold)">${esc(result.tripDetails.vibe)}</span>`;
    if (result.tripDetails?.pacing)          html += `<span class="detail-badge" style="color:var(--color-rose)">${esc(result.tripDetails.pacing)} Pacing</span>`;
    if (result.tripDetails?.budgetEstimate)  html += `<span class="detail-badge" style="color:var(--color-emerald)">Budget: ${esc(result.tripDetails.budgetEstimate)}</span>`;
    html += `</div>`;

    tripHeaderEl.innerHTML = html;

    // Wire refinement
    const refinementInput = document.getElementById('refinement-input');
    const refineBtn = document.getElementById('refine-btn');
    if (refinementInput && refineBtn) {
      refinementInput.addEventListener('input', () => {
        refineBtn.disabled = !refinementInput.value.trim();
      });
      refinementInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && refinementInput.value.trim()) {
          generateItinerary(true);
        }
      });
      refineBtn.addEventListener('click', () => {
        if (refinementInput.value.trim()) generateItinerary(true);
      });
    }
  }

  /* Single day card HTML builder */
  function buildDayCardHTML(day, dIdx) {
    const companion = companionEl.value;
    let html = `
      <div class="day-card" id="day-card-${dIdx}" style="position:relative">
        <div class="day-error error-box" style="display:none;margin-bottom:1rem"></div>
        <div class="day-refresh-overlay" style="display:none;position:absolute;inset:0;border-radius:1rem;z-index:10;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;backdrop-filter:blur(2px);background:rgba(15,40,71,0.15)">
          <svg class="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-gold)"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          <span style="font-size:0.8125rem;color:var(--color-text-muted)">Refreshing day…</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
          <div>
            <h3 style="font-size:1.5rem;font-weight:700" class="text-text">Day ${esc(day.dayNumber)}</h3>
            <div style="display:flex;align-items:center;font-size:0.75rem;font-family:'Space Grotesk',monospace;color:var(--color-sky);margin-top:0.25rem">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(day.city)}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem">
            ${day.dateTheme ? `<span style="font-size:0.875rem;color:var(--color-text-muted);font-style:italic">${esc(day.dateTheme)}</span>` : ''}
            <button class="refresh-btn refresh-day-btn" data-day-idx="${dIdx}" title="Refresh this day with new suggestions" style="flex-shrink:0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              <span style="font-size:0.75rem">Refresh day</span>
            </button>
          </div>
        </div>
        <div class="timeline-list">`;

    (day.activities || []).forEach((activity) => {
      const badgeClass = getActivityBadgeClass(activity.type);
      const typeShort  = renderString(activity.type).substring(0, 15);
      const showFamily = activity.familyTip && companion === 'Family with Kids';

      html += `
        <div class="timeline-item">
          <div class="timeline-time">${esc(activity.time)}</div>
          <div class="timeline-dot"><div class="timeline-dot-inner"></div></div>
          <div class="timeline-content">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.5rem">
              <h4 style="font-weight:600;font-size:1rem;line-height:1.375" class="text-text">${esc(activity.activityName)}</h4>
              ${activity.type ? `<span class="activity-badge ${badgeClass}">${esc(typeShort)}</span>` : ''}
            </div>
            <p style="font-size:0.875rem;line-height:1.625;margin-bottom:0.75rem" class="text-text-muted">${esc(activity.description)}</p>`;

      if (activity.crowdAdvice || showFamily) {
        html += `<div style="display:grid;grid-template-columns:1fr;gap:0.75rem;margin-bottom:1rem">`;
        if (activity.crowdAdvice) {
          html += `
            <div class="alert-sky">
              <div class="alert-label" style="color:var(--color-sky)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Crowd Alert
              </div>
              <span class="text-text" style="font-size:0.75rem">${esc(activity.crowdAdvice)}</span>
            </div>`;
        }
        if (showFamily) {
          html += `
            <div class="alert-gold">
              <div class="alert-label" style="color:var(--color-gold)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Family Tip
              </div>
              <span class="text-text" style="font-size:0.75rem">${esc(activity.familyTip)}</span>
            </div>`;
        }
        html += `</div>`;
      }

      html += `<div class="activity-meta">`;
      if (activity.location) html += `<span style="display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(activity.location)}</span>`;
      if (activity.estimatedCost) html += `<span>${esc(activity.estimatedCost)}</span>`;
      if (activity.travelTimeFromPrevious && activity.travelTimeFromPrevious !== '0' && activity.travelTimeFromPrevious !== 'N/A')
        html += `<span style="color:var(--color-rose)">🚗 +${esc(activity.travelTimeFromPrevious)}</span>`;
      html += `</div>
          </div>
        </div>`;
    });

    html += `</div></div>`;
    return html;
  }

  /* Swap a single day card in the DOM */
  function renderSingleDayCard(dayIndex) {
    const existing = document.getElementById(`day-card-${dayIndex}`);
    if (!existing) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = buildDayCardHTML(result.days[dayIndex], dayIndex);
    existing.replaceWith(tmp.firstElementChild);
  }

  /* Itinerary tab */
  function renderItineraryTab() {
    const days = Array.isArray(result.days) ? result.days : [];

    let html = `<div style="display:grid;grid-template-columns:1fr;gap:2rem">
      <div style="display:flex;flex-direction:column;gap:1.5rem" id="day-cards">`;

    days.forEach((day, dIdx) => {
      html += buildDayCardHTML(day, dIdx);
    });

    html += `</div>`;

    // Sidebar
    html += `
      <div class="sidebar-card" style="margin-top:2rem">
        <h3 style="font-size:1.125rem;font-weight:700;margin-bottom:1.25rem;display:flex;align-items:center;gap:0.5rem" class="text-text">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-gold)"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
          Trip Intelligence
        </h3>`;

    if (result.tripDetails?.bestTimeToVisit) {
      html += `
        <div style="margin-bottom:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--color-border)">
          <h4 style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.5rem">Best Time to Visit</h4>
          <p style="font-size:0.875rem;line-height:1.625" class="text-text">${esc(result.tripDetails.bestTimeToVisit)}</p>
        </div>`;
    }

    if (Array.isArray(result.tips) && result.tips.length > 0) {
      html += `
        <div>
          <h4 style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.75rem">Pro Tips</h4>
          <ul style="display:flex;flex-direction:column;gap:0.75rem;list-style:none">`;
      result.tips.forEach(tip => {
        html += `<li style="font-size:0.875rem;line-height:1.625;display:flex;align-items:flex-start" class="text-text">
          <span style="color:var(--color-emerald);margin-right:0.5rem;margin-top:2px;flex-shrink:0">•</span>${esc(tip)}</li>`;
      });
      html += `</ul></div>`;
    }

    html += `</div></div>`;

    document.getElementById('tab-itinerary').innerHTML = html;

    // Event delegation for per-day refresh buttons
    document.getElementById('day-cards').addEventListener('click', (e) => {
      const btn = e.target.closest('.refresh-day-btn');
      if (btn && !btn.disabled) refreshDay(parseInt(btn.dataset.dayIdx, 10));
    });
  }

  /* Stays tab */
  function renderStaysTab() {
    const accom = Array.isArray(result.accommodations) ? result.accommodations : [];
    if (!accom.length) { document.getElementById('tab-stays').innerHTML = '<p style="color:var(--color-text-muted)">No accommodation data available.</p>'; return; }

    const tierConfig = {
      'Budget':    { badgeClass: 'emerald', hoverClass: 'hover-emerald', iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-emerald)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
      'Mid-Range': { badgeClass: 'sky',     hoverClass: 'hover-sky',     iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-sky)"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>' },
      'Luxury':    { badgeClass: 'gold',    hoverClass: 'hover-gold',    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-gold)"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>' },
    };

    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem">
        <div>
          <div class="section-heading">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-sky)"><path d="M3 22V12M21 22V12M3 12V7l9-5 9 5v5M3 12h18"/><rect x="9" y="12" width="6" height="10"/></svg>
            <span class="gradient-text-sky-gold">Accommodation Suggestions</span>
          </div>
          <p style="font-size:0.875rem;color:var(--color-text-muted);margin-top:0.25rem">
            ${accommodationTier === 'No Preference'
              ? 'Curated stays across 3 budget tiers for each city on your route.'
              : `3 curated ${accommodationTier.toLowerCase()} options for each city on your route.`}
          </p>
        </div>
        <button id="refresh-stays-btn" class="refresh-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          <span id="refresh-stays-label">Refresh</span>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:2.5rem">`;

    accom.forEach((cityStay, cIdx) => {
      html += `
        <div>
          <div style="display:flex;align-items:center;gap:0.5rem;color:var(--color-sky);font-family:'Space Grotesk',monospace;font-size:0.875rem;margin-bottom:1rem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h20v14H2zM2 14l3-3 2 2 4-4 3 3 3-3 3 3"/></svg>
            ${esc(cityStay.city)}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">`;

      (cityStay.options || []).forEach((opt, oIdx) => {
        const cfg = tierConfig[renderString(opt.tier)] || tierConfig['Mid-Range'];
        const hotelLink  = `https://www.booking.com/search.html?ss=${encodeURIComponent(renderString(opt.name) + ' ' + renderString(cityStay.city))}`;
        const googleLink = `https://www.google.com/travel/hotels?q=${encodeURIComponent(renderString(opt.name) + ' ' + renderString(cityStay.city))}`;

        html += `
          <div class="hotel-card ${cfg.hoverClass}">
            <div class="hotel-card-header">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
                ${accommodationTier === 'No Preference'
                  ? `<span class="tier-badge ${cfg.badgeClass}">${esc(opt.tier)}</span>`
                  : `<span class="tier-badge" style="background:var(--color-surface);border-color:var(--color-border);color:var(--color-text-muted)">Option ${oIdx + 1}</span>`
                }
                ${cfg.iconSvg}
              </div>
              <h4 style="font-weight:600;font-size:1rem;margin-bottom:0.25rem" class="text-text">${esc(opt.name)}</h4>
              ${opt.area ? `<p style="font-size:0.75rem;color:var(--color-text-muted);display:flex;align-items:center;gap:4px;margin-bottom:0.5rem"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(opt.area)}</p>` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
                <p style="color:var(--color-emerald);font-size:0.875rem;font-family:'Space Grotesk',monospace;font-weight:600">${esc(opt.pricePerNight)}</p>
                ${opt.rating ? renderStars(opt.rating) : ''}
              </div>
            </div>`;

        if (opt.amenities && opt.amenities.length) {
          html += `<div class="hotel-card-amenities">`;
          opt.amenities.slice(0, 4).forEach(a => {
            html += `<span class="amenity-chip">${esc(a)}</span>`;
          });
          html += `</div>`;
        }

        html += `<div class="hotel-card-body">
          <ul style="list-style:none;display:flex;flex-direction:column;gap:0.375rem">`;
        (opt.highlights || []).slice(0, 3).forEach(h => {
          html += `<li style="font-size:0.75rem;display:flex;align-items:flex-start;gap:6px" class="text-text">
            <span style="color:${cfg.badgeClass === 'emerald' ? 'var(--color-emerald)' : cfg.badgeClass === 'sky' ? 'var(--color-sky)' : 'var(--color-gold)'};margin-top:2px;flex-shrink:0">•</span>${esc(h)}</li>`;
        });
        html += `</ul>
          <p style="font-size:0.75rem;color:var(--color-text-muted);font-style:italic;margin-top:0.75rem">Best for: ${esc(opt.bestFor)}</p>`;
        if (opt.bookingTip) {
          html += `<p style="font-size:0.75rem;color:var(--color-gold);margin-top:0.5rem;display:flex;align-items:flex-start;gap:6px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            ${esc(opt.bookingTip)}</p>`;
        }
        html += `</div>
          <div class="hotel-card-links">
            <a href="${hotelLink}" target="_blank" rel="noopener noreferrer" class="hotel-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              Booking.com
            </a>
            <a href="${googleLink}" target="_blank" rel="noopener noreferrer" class="hotel-link gold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              Google Hotels
            </a>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });

    html += `</div>`;
    document.getElementById('tab-stays').innerHTML = html;

    document.getElementById('refresh-stays-btn')?.addEventListener('click', refreshAccommodations);
  }

  /* Budget tab */
  function renderBudgetTab() {
    const bd = result.budgetBreakdown;
    if (!bd || !Array.isArray(bd.categories) || !bd.categories.length) {
      document.getElementById('tab-budget').innerHTML = '<p style="color:var(--color-text-muted)">No budget data available.</p>';
      return;
    }

    let html = `
      <div style="margin-bottom:1.5rem">
        <div class="section-heading">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-emerald)"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          <span class="gradient-text-emerald-sky">Budget Breakdown</span>
        </div>
        <p style="font-size:0.875rem;color:var(--color-text-muted);margin-top:0.25rem">Estimated costs in Malaysian Ringgit (RM).</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-bottom:1.5rem">`;

    bd.categories.forEach(cat => {
      html += `
        <div class="budget-card">
          <p style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-emerald);margin-bottom:0.75rem">${esc(cat.category)}</p>
          <p style="font-family:'Space Grotesk',monospace;font-size:1rem;font-weight:600;margin-bottom:0.25rem" class="text-text">${esc(cat.tripTotal)}</p>
          <p style="font-family:'Space Grotesk',monospace;font-size:0.75rem;margin-bottom:0.75rem" class="text-text-muted">${esc(cat.dailyEstimate)}</p>
          <p style="font-size:0.75rem;font-style:italic;padding-top:0.75rem;border-top:1px solid var(--color-border)" class="text-text-muted">${esc(cat.notes)}</p>
        </div>`;
    });

    html += `</div>
      <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.25);border-radius:0.75rem;padding:1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem">
        <div>
          <p style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-emerald);margin-bottom:0.25rem">Estimated Total</p>
          <p style="font-family:'Space Grotesk',monospace;font-size:1.5rem;font-weight:700" class="text-text">${esc(bd.grandTotal)}</p>
          ${bd.notes ? `<p style="font-size:0.75rem;max-width:28rem;line-height:1.625;margin-top:0.5rem" class="text-text-muted">${esc(bd.notes)}</p>` : ''}
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:rgba(16,185,129,0.3);flex-shrink:0"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
      </div>`;

    document.getElementById('tab-budget').innerHTML = html;
  }

  /* ── Event wiring ──────────────────────────────────────────────────── */
  function init() {
    destinationEl       = document.getElementById('destination');
    startDateEl         = document.getElementById('start-date');
    spotInputEl         = document.getElementById('spot-input');
    spotTagsEl          = document.getElementById('spot-tags');
    suggestionsDropdown = document.getElementById('suggestions-dropdown');
    suggestionsList     = document.getElementById('suggestions-list');
    suggestionsLabel    = document.getElementById('suggestions-label');
    vibeEl              = document.getElementById('vibe');
    companionEl         = document.getElementById('companion');
    pacingEl            = document.getElementById('pacing');
    daysEl              = document.getElementById('days');
    crowdToggle         = document.getElementById('crowd-toggle');
    crowdLabel          = document.getElementById('crowd-label');
    errorBox            = document.getElementById('error-box');
    generateBtn         = document.getElementById('generate-btn');
    generateLabel       = document.getElementById('generate-label');
    resultsEl           = document.getElementById('results');
    tripHeaderEl        = document.getElementById('trip-header');
    tabBtns             = document.querySelectorAll('.tab-btn');
    tabPanels           = document.querySelectorAll('.tab-panel');

    if (!destinationEl) return; // not on planner page

    // Start date: text→date on focus
    startDateEl.addEventListener('focus', () => { startDateEl.type = 'date'; });
    startDateEl.addEventListener('blur',  () => { if (!startDateEl.value) startDateEl.type = 'text'; });

    // Destination change resets suggestions
    destinationEl.addEventListener('change', () => {
      spotSuggestions = [];
      mustSeeSpots    = [];
      renderSpotTags();
    });

    // Spot input
    spotInputEl.addEventListener('focus', () => {
      suggestionsDropdown.style.display = spotSuggestions.length ? 'block' : 'none';
      fetchSpotSuggestions();
    });
    spotInputEl.addEventListener('blur', () => {
      setTimeout(() => { suggestionsDropdown.style.display = 'none'; }, 150);
    });
    spotInputEl.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && spotInputEl.value.trim()) {
        e.preventDefault();
        addSpot(spotInputEl.value);
        renderSuggestions();
      }
    });
    suggestionsDropdown.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.suggestion-btn');
      if (btn) { addSpot(btn.dataset.spot); renderSuggestions(); }
    });

    // Crowd toggle
    crowdToggle.addEventListener('click', () => {
      avoidCrowds = !avoidCrowds;
      crowdToggle.classList.toggle('active', avoidCrowds);
      crowdLabel.textContent = avoidCrowds ? 'Prefer off-peak scheduling' : 'No crowd preference';
    });

    // Accommodation tier buttons
    tierButtons = document.querySelectorAll('[data-tier]');
    const tierActiveMap = {
      'No Preference': 'active-sky',
      'Budget':        'active-emerald',
      'Mid-Range':     'active-sky',
      'Luxury':        'active-gold',
    };
    tierButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        accommodationTier = btn.dataset.tier;
        tierButtons.forEach(b => b.classList.remove('active-sky', 'active-emerald', 'active-gold'));
        btn.classList.add(tierActiveMap[accommodationTier] || 'active-sky');
      });
    });

    // Tabs
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Form submit
    document.getElementById('planner-form').addEventListener('submit', (e) => {
      e.preventDefault();
      generateItinerary(false);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
