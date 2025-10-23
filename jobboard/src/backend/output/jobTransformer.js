// src/backend/output/jobTransformers.js

/**
 * State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

const VALID_STATE_ABBREVS = new Set(Object.values(STATE_ABBREVIATIONS));

/**
 * Major US cities to state mapping
 * Used to auto-complete state when only city is provided
 */
const CITY_TO_STATE = {
  // Major tech hubs
  'seattle': 'WA', 'redmond': 'WA', 'bellevue': 'WA', 'tacoma': 'WA',
  'san francisco': 'CA', 'san jose': 'CA', 'mountain view': 'CA', 'palo alto': 'CA',
  'sunnyvale': 'CA', 'cupertino': 'CA', 'santa clara': 'CA', 'menlo park': 'CA',
  'los angeles': 'CA', 'san diego': 'CA', 'irvine': 'CA', 'sacramento': 'CA',
  'oakland': 'CA', 'berkeley': 'CA', 'santa monica': 'CA', 'pasadena': 'CA',
  'austin': 'TX', 'dallas': 'TX', 'houston': 'TX', 'san antonio': 'TX',
  'fort worth': 'TX', 'plano': 'TX', 'irving': 'TX', 'arlington': 'TX',
  'new york': 'NY', 'brooklyn': 'NY', 'queens': 'NY', 'manhattan': 'NY',
  'buffalo': 'NY', 'rochester': 'NY', 'albany': 'NY', 'syracuse': 'NY',
  'boston': 'MA', 'cambridge': 'MA', 'somerville': 'MA', 'worcester': 'MA',
  'chicago': 'IL', 'naperville': 'IL', 'peoria': 'IL', 'springfield': 'IL',
  'atlanta': 'GA', 'savannah': 'GA', 'augusta': 'GA', 'columbus': 'GA',
  'denver': 'CO', 'boulder': 'CO', 'colorado springs': 'CO', 'aurora': 'CO',
  'phoenix': 'AZ', 'tucson': 'AZ', 'mesa': 'AZ', 'chandler': 'AZ', 'scottsdale': 'AZ',
  'portland': 'OR', 'eugene': 'OR', 'salem': 'OR', 'bend': 'OR',
  'miami': 'FL', 'tampa': 'FL', 'orlando': 'FL', 'jacksonville': 'FL',
  'tallahassee': 'FL', 'fort lauderdale': 'FL', 'west palm beach': 'FL',
  'nashville': 'TN', 'memphis': 'TN', 'knoxville': 'TN', 'chattanooga': 'TN',
  'philadelphia': 'PA', 'pittsburgh': 'PA', 'harrisburg': 'PA',
  'detroit': 'MI', 'ann arbor': 'MI', 'grand rapids': 'MI', 'lansing': 'MI',
  'minneapolis': 'MN', 'st paul': 'MN', 'saint paul': 'MN', 'duluth': 'MN',
  'las vegas': 'NV', 'reno': 'NV', 'henderson': 'NV',
  'salt lake city': 'UT', 'provo': 'UT', 'ogden': 'UT', 'lehi': 'UT',
  'raleigh': 'NC', 'charlotte': 'NC', 'durham': 'NC', 'cary': 'NC', 'greensboro': 'NC',
  'indianapolis': 'IN', 'fort wayne': 'IN', 'evansville': 'IN',
  'columbus': 'OH', 'cleveland': 'OH', 'cincinnati': 'OH', 'toledo': 'OH',
  'milwaukee': 'WI', 'madison': 'WI', 'green bay': 'WI',
  'baltimore': 'MD', 'annapolis': 'MD', 'rockville': 'MD',
  'kansas city': 'MO', 'st louis': 'MO', 'saint louis': 'MO', 'springfield': 'MO',
  'oklahoma city': 'OK', 'tulsa': 'OK', 'norman': 'OK',
  'albuquerque': 'NM', 'santa fe': 'NM', 'las cruces': 'NM',
  'louisville': 'KY', 'lexington': 'KY',
  'richmond': 'VA', 'virginia beach': 'VA', 'norfolk': 'VA', 'arlington': 'VA',
  'mclean': 'VA', 'alexandria': 'VA', 'reston': 'VA',
  'providence': 'RI', 'newport': 'RI',
  'boise': 'ID', 'meridian': 'ID',
  'des moines': 'IA', 'cedar rapids': 'IA',
  'omaha': 'NE', 'lincoln': 'NE',
  'honolulu': 'HI', 'hilo': 'HI',
  'anchorage': 'AK', 'juneau': 'AK',
  'new orleans': 'LA', 'baton rouge': 'LA', 'lafayette': 'LA',
  'birmingham': 'AL', 'montgomery': 'AL', 'huntsville': 'AL',
  'little rock': 'AR', 'fayetteville': 'AR',
  'charleston': 'SC', 'columbia': 'SC', 'greenville': 'SC',
  'sioux falls': 'SD', 'rapid city': 'SD',
  'fargo': 'ND', 'bismarck': 'ND',
  'jackson': 'MS', 'gulfport': 'MS',
  'bridgeport': 'CT', 'hartford': 'CT', 'new haven': 'CT', 'stamford': 'CT',
  'manchester': 'NH', 'nashua': 'NH',
  'burlington': 'VT', 'montpelier': 'VT',
  'portland': 'ME', 'augusta': 'ME',
  'wilmington': 'DE', 'dover': 'DE',
  'cheyenne': 'WY', 'casper': 'WY',
  'billings': 'MT', 'missoula': 'MT',
  'pierre': 'SD', 'sioux falls': 'SD',
  'charleston': 'WV', 'huntington': 'WV',
  // Special cases
  'washington': 'DC', // Assume DC unless specified as state
  'arlington': 'VA', // Most common Arlington
  'springfield': 'IL', // Most common Springfield
  'west nyack': 'NY',
  'walnut creek': 'CA',
  'clearwater beach': 'FL',
  'galway': 'IE', // International - will be filtered
};


/**
 * Clean job title by removing common prefixes, suffixes, and formatting issues
 */
function cleanJobTitle(title) {
  if (!title) return title;

  return title
    .replace(/\|/g, ' - ')
    .replace(/\n/g, ' ')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up state for a given city name
 */
function getStateForCity(cityName) {
  if (!cityName) return '';
  const normalized = cityName.toLowerCase().trim();
  return CITY_TO_STATE[normalized] || '';
}

/**
 * Normalize state to standard abbreviation
 */
function normalizeState(state) {
  if (!state) return '';
  
  const cleaned = state.trim().toUpperCase();
  
  // Already an abbreviation
  if (VALID_STATE_ABBREVS.has(cleaned)) {
    return cleaned;
  }
  
  // Convert full name to abbreviation
  const fullName = state.trim().toLowerCase();
  return STATE_ABBREVIATIONS[fullName] || '';
}

/**
 * Parse and clean location text to extract city and state
 * Returns format: { city: string, state: string (abbreviation) }
 * Remote positions will have city: 'US - Remote', state: ''
 */
function parseLocation(locationText) {
  // Handle null/empty cases
  if (!locationText || 
      locationText === 'null' || 
      locationText.trim() === '' || 
      locationText.toLowerCase().trim() === 'null') {
    return { city: 'US - Remote', state: '' };
  }

  // Initial cleaning
  let cleanLocation = locationText
    .replace(/Location\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '')
    .trim();

  const lowerText = cleanLocation.toLowerCase().trim();

  // Check for remote patterns FIRST (before any other processing)
  const remotePatterns = [
    /^remote$/i,
    /^remote[,\s]*$/i,
    /^remote\s*-\s*$/i,
    /^\s*remote\s*$/i,
    /^us\s*-?\s*remote$/i,
    /^remote\s*-?\s*us$/i,
    /^work\s*from\s*home$/i,
    /^wfh$/i
  ];
  
  for (const pattern of remotePatterns) {
    if (pattern.test(cleanLocation)) {
      return { city: 'US - Remote', state: '' };
    }
  }

  // Check for multiple location patterns
  if (lowerText.includes('multiple') && 
      (lowerText.includes('cities') || lowerText.includes('locations') || lowerText.includes('sites') || lowerText.includes('s'))) {
    return { city: 'Multiple Cities', state: '' };
  }
  if (lowerText.includes('various') && 
      (lowerText.includes('cities') || lowerText.includes('locations'))) {
    return { city: 'Multiple Cities', state: '' };
  }
  if (lowerText.includes('all locations') || lowerText.includes('nationwide')) {
    return { city: 'Multiple Cities', state: '' };
  }

  // Handle "Available in one of X locations" pattern
  if (cleanLocation.match(/Available in one of \d+ s/i)) {
    const exampleLocations = cleanLocation.match(/\((.*?)\)/);
    if (exampleLocations && exampleLocations[1]) {
      const locations = exampleLocations[1].split(';').map(loc => loc.trim());
      if (locations.length > 0) {
        const locationParts = locations[0].split(',').map(part => part.trim());
        if (locationParts.length >= 2) {
          return { 
            city: locationParts[0], 
            state: normalizeState(locationParts[1]) 
          };
        }
        return { city: locationParts[0], state: '' };
      }
    }
    return { city: 'Multiple Cities', state: '' };
  }

  // CRITICAL: Handle "US, State" format BEFORE removing US
  // Pattern: "US, CA" or "US, Texas" etc.
  const usStateMatch = cleanLocation.match(/^US[,\s]+(.+)$/i);
  if (usStateMatch) {
    const statePart = usStateMatch[1].trim();
    const normalizedState = normalizeState(statePart);
    if (normalizedState) {
      // It's a state-only location like "US, CA"
      return { city: '', state: normalizedState };
    }
    // Check if it's a city name after "US, "
    const autoState = getStateForCity(statePart);
    if (autoState) {
      return { city: statePart, state: autoState };
    }
    // Just return the part after "US, " as city
    return { city: statePart, state: '' };
  }

  // Handle "US, State, City" format (e.g., "US, MA, Wilmington")
  const usStateCity = cleanLocation.match(/^US[,\s]+([^,]+)[,\s]+(.+)$/i);
  if (usStateCity) {
    const part1 = usStateCity[1].trim();
    const part2 = usStateCity[2].trim();
    
    const state1 = normalizeState(part1);
    const state2 = normalizeState(part2);
    
    if (state1 && !state2) {
      // Format: US, State, City
      return { city: part2, state: state1 };
    } else if (!state1 && state2) {
      // Format: US, City, State (weird but handle it)
      return { city: part1, state: state2 };
    } else if (state1 && state2) {
      // Both are states, take first
      return { city: '', state: state1 };
    } else {
      // Neither is state, first is likely city
      const autoState = getStateForCity(part1);
      if (autoState) {
        return { city: part1, state: autoState };
      }
      return { city: part1, state: '' };
    }
  }

  // Handle patterns like "United States + 1 more, NY"
  cleanLocation = cleanLocation
    .replace(/United States\s*\+\s*\d+\s*more[,\s]*/gi, '')
    .replace(/USA\s*\+\s*\d+\s*more[,\s]*/gi, '')
    .replace(/US\s*\+\s*\d+\s*more[,\s]*/gi, '')
    .trim();

  // Remove country identifiers AFTER checking for "US, State" pattern
  cleanLocation = cleanLocation
    .replace(/,?\s*United States\s*$/i, '')
    .replace(/,?\s*USA\s*$/i, '')
    .replace(/,?\s*U\.S\.A\.?\s*$/i, '')
    .trim();

  // Non-location keywords to filter out
  const nonLocationKeywords = [
    'full time', 'full-time', 'fulltime', 'part time', 'part-time', 'parttime',
    'contract', 'contractor', 'temporary', 'temp', 'permanent', 'seasonal',
    'freelance', 'freelancer', 'consultant', 'consulting', 'hybrid',
    'on-site', 'onsite', 'on site', 'work from home', 'telecommute', 'telecommuting',
    'virtual', 'in-office', 'in office', 'experience', 'exp', 'years', 'yrs', 'year',
    'required', 'req', 'preferred', 'pref', 'degree', 'bachelor', 'bachelors', 'bs', 'ba',
    'master', 'masters', 'ms', 'ma', 'mba', 'phd', 'doctorate', 'position', 'positions',
    'role', 'roles', 'job', 'jobs', 'opportunity', 'opportunities', 'opening', 'openings',
    'posting', 'postings', 'vacancy', 'vacancies'
  ];

  // Remove non-location keywords
  nonLocationKeywords.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`^${escapedKeyword}[,\\s]*`, 'gi'),
      new RegExp(`\\b${escapedKeyword}\\b[,\\s]*`, 'gi'),
      new RegExp(`[,\\s]*${escapedKeyword}$`, 'gi')
    ];
    patterns.forEach(pattern => {
      cleanLocation = cleanLocation.replace(pattern, ' ');
    });
  });

  // Final cleaning
  cleanLocation = cleanLocation
    .replace(/\s+/g, ' ')
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s\-:;|]+|[,\s\-:;|]+$/g, '')
    .replace(/\s+-\s+/g, ', ')
    .trim();

  // Check if location is too short or invalid
  if (!cleanLocation || cleanLocation.length < 2) {
    return { city: 'Multiple Cities', state: '' };
  }

  // Check for generic terms
  const genericTerms = ['us', 'usa', 'u.s.', 'u.s.a', 'united states', 'tbd', 'tba', 'n/a', 'na'];
  const multipleTerms = ['multiple', 'various', 'all', 'any', 'nationwide', 'national'];
  
  if (multipleTerms.includes(cleanLocation.toLowerCase()) || 
      genericTerms.includes(cleanLocation.toLowerCase())) {
    return { city: 'Multiple Cities', state: '' };
  }

  // Check for only numbers/special chars
  if (/^[\d\s,\-._]+$/.test(cleanLocation)) {
    return { city: 'Multiple Cities', state: '' };
  }

  // Parse city and state
  const parts = cleanLocation
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (parts.length >= 2) {
    const part1 = parts[0];
    const part2 = parts[1];
    
    // Try to normalize both parts as states
    const state1 = normalizeState(part1);
    const state2 = normalizeState(part2);
    
    // Case 1: First part is a state (State, City format)
    if (state1 && !state2) {
      // Format: State, City (reverse order)
      return { city: part2, state: state1 };
    }
    
    // Case 2: Second part is a state (City, State format - normal)
    if (!state1 && state2) {
      // Format: City, State (normal order)
      return { city: part1, state: state2 };
    }
    
    // Case 3: Both are states (shouldn't happen, but take first as state)
    if (state1 && state2) {
      return { city: '', state: state1 };
    }
    
    // Case 4: Neither is a state - check for "City, City" patterns
    if (!state1 && !state2) {
      // Handle "New York, New York" or "Kansas City, Kansas"
      if (part1.toLowerCase() === part2.toLowerCase()) {
        // It's a duplicate - treat first part as city
        return { city: part1, state: '' };
      }
      
      // Check if part2 might be a misspelled state or city
      // Default to treating first as city, second as unknown location info
      return { city: part1, state: '' };
    }
    
    // Default: first is city, second is state
    return { city: part1, state: state2 };
    
  } else if (parts.length === 1) {
    const singlePart = parts[0];
    
    // Check if it's just a state
    const normalizedState = normalizeState(singlePart);
    if (normalizedState) {
      return { city: '', state: normalizedState };
    }
    
    // Check if it contains job-related terms
    const hasJobTerms = nonLocationKeywords.some(keyword => 
      singlePart.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (hasJobTerms) {
      return { city: 'Multiple Cities', state: '' };
    }
    
    // CRITICAL: Try to find state for this city
    const autoState = getStateForCity(singlePart);
    if (autoState) {
      // Found the state! Return complete location
      return { city: singlePart, state: autoState };
    }
    
    // It's just a city without state (and we couldn't find it)
    return { city: singlePart, state: '' };
  }

  return { city: 'Multiple Cities', state: '' };
}

/**
 * Convert date string to relative format (e.g., "1h", "2d", "1w", "1mo")
 */
function convertDateToRelative(postedDate) {
  const dateStr = String(postedDate);
  const desiredFormatRegex = /^\d+[hdwmo]+$/i;
  if (desiredFormatRegex.test(dateStr.trim())) return dateStr.trim();

  let cleanedDate = dateStr
    .replace(/^posted\s+/i, '')
    .replace(/\s+ago$/i, '')
    .replace(/^on\s+/i, '')
    .trim()
    .toLowerCase();

  if (cleanedDate === 'today' || cleanedDate === 'yesterday') return '1d';
  if (cleanedDate.includes('just') || cleanedDate.includes('recently') || cleanedDate.includes('now')) return '1h';

  const daysPlusMatch = cleanedDate.match(/(\d+)\+?\s*days?/i);
  if (daysPlusMatch) {
    const days = parseInt(daysPlusMatch[1]);
    if (days >= 30) return `${Math.floor(days / 30)}mo`;
    if (days >= 7) return `${Math.floor(days / 7)}w`;
    return `${days}d`;
  }

  const weeksPlusMatch = cleanedDate.match(/(\d+)\+?\s*weeks?/i);
  if (weeksPlusMatch) return `${parseInt(weeksPlusMatch[1])}w`;

  const monthsPlusMatch = cleanedDate.match(/(\d+)\+?\s*months?/i);
  if (monthsPlusMatch) return `${parseInt(monthsPlusMatch[1])}mo`;

  const timeRegex = /(\d+)\s*(hour|hours|h|minute|minutes|min|day|days|d|week|weeks|w|month|months|mo|m)(?:\s|$)/i;
  const match = cleanedDate.match(timeRegex);
  if (match) {
    const number = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h') || unit.includes('hour')) return `${number}h`;
    if (unit.startsWith('min') || unit.includes('minute')) return number >= 60 ? `${Math.floor(number / 60)}h` : '1h';
    if (unit.startsWith('d') || unit.includes('day')) return `${number}d`;
    if (unit.startsWith('w') || unit.includes('week')) return `${number}w`;
    if ((unit === 'm' || unit.startsWith('month')) && unit !== 'min') return `${number}mo`;
  }

  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate.getTime())) return '1d';

  const now = new Date();
  const diffTime = Math.abs(now - parsedDate);
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return diffHours === 0 ? '1h' : `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}

/**
 * Check if job is older than one month
 */
function isJobOlderThanOneMonth(postedDate) {
  const relativeDate = convertDateToRelative(postedDate);
  const match = relativeDate.match(/^(\d+)([hdwmo])$/i);
  if (!match) return true;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'mo' && value >= 1;
}

/**
 * Main transformation function - converts raw job data to standardized format
 */
function transformJobs(jobs, searchQuery) {
  return jobs
    .filter(job => job.title && job.title.trim() !== '')
    .filter(job => !isJobOlderThanOneMonth(job.posted))
    .map(job => {
      const { city, state } = parseLocation(job.location);
      const applyLink = job.applyLink || '';
      const postedRelative = convertDateToRelative(job.posted);
      const job_description = job.description;

      return {
        employer_name: job.company || '',
        job_title: cleanJobTitle(job.title),
        job_city: city || '',
        job_state: state || '',
        job_posted_at: postedRelative || 'Recently',
        job_description: job_description || `${searchQuery} job for the role ${job.title}`,
        job_apply_link: applyLink,
      };
    });
}

module.exports = {
  cleanJobTitle,
  parseLocation,
  convertDateToRelative,
  isJobOlderThanOneMonth,
  transformJobs,
  getStateForCity,
  normalizeState
};
