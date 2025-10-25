const fs = require('fs');
const path = require('path');
const { fetchAllRealJobs } = require('../real-career-scraper');
const { 
    companies, 
    ALL_COMPANIES, 
    COMPANY_BY_NAME, 
    generateJobId,
    migrateOldJobId,
    normalizeCompanyName, 
    getCompanyEmoji, 
    getCompanyCareerUrl,
    formatTimeAgo,
    isJobOlderThanWeek,
    isUSOnlyJob,
    getExperienceLevel,
    getJobCategory,
    formatLocation,
    delay 
} = require('./utils');

const { convertDateToRelative } = require('../../../jobboard/src/backend/output/jobTransformer.js');

// Configuration
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || '315e3cea2bmshd51ab0ee7309328p18cecfjsna0f6b8e72f39';
const JSEARCH_BASE_URL = 'https://jsearch.p.rapidapi.com/search';

// Job search queries - much more comprehensive
const SEARCH_QUERIES = [
    // Core engineering roles
    'software engineer',
    'software developer', 
    'full stack developer',
    'frontend developer',
    'backend developer',
    'mobile developer',
    'ios developer',
    'android developer',
    
    // Specialized tech roles
    'machine learning engineer',
    'data scientist', 
    'data engineer',
    'devops engineer',
    'cloud engineer',
    'security engineer',
    'site reliability engineer',
    'platform engineer',
    
    // Product & Design
    'product manager',
    'product designer',
    'ux designer',
    'ui designer',
    
    // New grad specific
    'new grad software engineer',
    'entry level developer',
    'junior developer',
    'graduate software engineer',
    
    // High-value roles
    'staff engineer',
    'senior software engineer',
    'principal engineer',
    'engineering manager'
];

/**
 * Load job dates store - persists assigned dates for jobs without original dates
 */
function loadJobDatesStore() {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    const datesPath = path.join(dataDir, 'job_dates.json');
    
    try {
        if (!fs.existsSync(datesPath)) {
            return {};
        }
        
        const fileContent = fs.readFileSync(datesPath, 'utf8');
        if (!fileContent.trim()) {
            return {};
        }
        
        return JSON.parse(fileContent);
        
    } catch (error) {
        console.error('Error loading job_dates.json:', error.message);
        return {};
    }
}

/**
 * Save job dates store with atomic writes
 */
function saveJobDatesStore(jobDates) {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Cleanup: Remove entries older than 60 days
        const now = new Date();
        const cleanedDates = {};
        
        Object.entries(jobDates).forEach(([jobId, dateInfo]) => {
            const assignedDate = new Date(dateInfo.assigned_date);
            const daysDiff = Math.floor((now - assignedDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < 60) {
                cleanedDates[jobId] = dateInfo;
            }
        });

        const datesPath = path.join(dataDir, 'job_dates.json');
        const tempPath = path.join(dataDir, 'job_dates.tmp.json');
        
        fs.writeFileSync(tempPath, JSON.stringify(cleanedDates, null, 2), 'utf8');
        fs.renameSync(tempPath, datesPath);
        
    } catch (error) {
        console.error('Error saving job_dates.json:', error.message);
    }
}

/**
 * Fill null dates with stored or new ISO datetimes, then convert to relative format
 */
function fillJobDates(jobs, jobDatesStore) {
    const updatedDatesStore = { ...jobDatesStore };
    
    const processedJobs = jobs.map(job => {
        const hasNoDate = job.job_posted_at === null || 
                         job.job_posted_at === undefined || 
                         job.job_posted_at === '' ||
                         job.job_posted_at === 'null';
        
        if (!hasNoDate) {
            // Job has a date - convert to relative if it's ISO format
            const relativeDate = convertDateToRelative(job.job_posted_at);
            if (relativeDate) {
                job.job_posted_at = relativeDate;
            }
            return job;
        }
        
        // Job has null date - need to fill it
        const jobId = `${(job.company || job.employer_name || '').toLowerCase().replace(/\s+/g, '-')}-${(job.title || job.job_title || '').toLowerCase().replace(/\s+/g, '-')}-${(job.location || job.job_city || '').toLowerCase().replace(/\s+/g, '-')}`;
        
        let isoDatetime;
        
        if (updatedDatesStore[jobId]) {
            // Reuse stored date
            isoDatetime = updatedDatesStore[jobId].assigned_date;
        } else {
            // Assign new date and store it
            isoDatetime = new Date().toISOString();
            updatedDatesStore[jobId] = {
                assigned_date: isoDatetime,
                job_title: job.title || job.job_title,
                company: job.company || job.employer_name,
                first_seen: isoDatetime
            };
        }
        
        // Convert ISO to relative format
        const relativeDate = convertDateToRelative(isoDatetime);
        
        return {
            ...job,
            job_posted_at: relativeDate || isoDatetime
        };
    });
    
    // Save if we added any new dates
    if (Object.keys(updatedDatesStore).length > Object.keys(jobDatesStore).length) {
        saveJobDatesStore(updatedDatesStore);
    }
    
    return processedJobs;
}

// Enhanced API search with better error handling
async function searchJobs(query, location = '') {
    try {
        const url = new URL(JSEARCH_BASE_URL);
        url.searchParams.append('query', query);
        if (location) url.searchParams.append('location', location);
        url.searchParams.append('page', '1');
        url.searchParams.append('num_pages', '1');
        url.searchParams.append('date_posted', 'month');
        url.searchParams.append('employment_types', 'FULLTIME');
        url.searchParams.append('job_requirements', 'under_3_years_experience,more_than_3_years_experience,no_experience');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': JSEARCH_API_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
        });
        
        if (!response.ok) {
            console.error(`API request failed for "${query}": ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        const jobs = data.data || [];
        console.log(`Query "${query}" returned ${jobs.length} jobs`);
        return jobs;
    } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
        return [];
    }
}

// Advanced job fetching with location targeting
async function fetchAllJobs() {
    console.log('🔍 Starting comprehensive job search...');
    
    const allJobs = [];
    const locations = ['San Francisco', 'New York', 'Seattle', 'Austin', 'Remote'];
    
    // Search core queries across multiple locations
    const coreQueries = [
        'software engineer',
        'frontend developer', 
        'backend developer',
        'data scientist',
        'machine learning engineer'
    ];
    
    for (const query of coreQueries) {
        // Search without location first
        const jobs = await searchJobs(query);
        allJobs.push(...jobs);
        await delay(1200); // Respect rate limits
        
        // Then search specific locations for higher-quality results
        for (const location of locations.slice(0, 2)) { // Limit to 2 locations to conserve API calls
            const locationJobs = await searchJobs(query, location);
            allJobs.push(...locationJobs);
            await delay(1200);
        }
    }
    
    // Search new grad specific terms
    const newGradQueries = ['new grad software engineer', 'entry level developer', 'graduate engineer'];
    for (const query of newGradQueries) {
        const jobs = await searchJobs(query);
        allJobs.push(...jobs);
        await delay(1200);
    }
    
    console.log(`📊 Total jobs fetched: ${allJobs.length}`);
    return allJobs;
}

// Enhanced filtering with better company matching
function filterTargetCompanyJobs(jobs) {
    console.log('🎯 Filtering for target companies...');
    
    const targetJobs = jobs.filter(job => {
        const companyName = (job.employer_name || '').toLowerCase();
        
        // Check against our comprehensive company list
        const isTargetCompany = COMPANY_BY_NAME[companyName] !== undefined;
        
        if (isTargetCompany) {
            // Normalize company name for consistency
            job.employer_name = normalizeCompanyName(job.employer_name);
            return true;
        }
        
        // Additional fuzzy matching for variations
        for (const company of ALL_COMPANIES) {
            for (const apiName of company.api_names) {
                if (companyName.includes(apiName.toLowerCase()) && apiName.length > 3) {
                    job.employer_name = company.name;
                    return true;
                }
            }
        }
        
        return false;
    });
    
    console.log(`✨ Filtered to ${targetJobs.length} target company jobs`);
    console.log('🏢 Companies found:', [...new Set(targetJobs.map(j => j.employer_name))]);
    
    // Remove duplicates more intelligently
    const uniqueJobs = targetJobs.filter((job, index, self) => {
        return index === self.findIndex(j => 
            j.job_title === job.job_title && 
            j.employer_name === job.employer_name &&
            j.job_city === job.job_city
        );
    });
    
    console.log(`🧹 After deduplication: ${uniqueJobs.length} unique jobs`);
    
    // Sort by company tier and recency
    uniqueJobs.sort((a, b) => {
        // Prioritize FAANG+ companies
        const aIsFAANG = companies.faang_plus.some(c => c.name === a.employer_name);
        const bIsFAANG = companies.faang_plus.some(c => c.name === b.employer_name);
        
        if (aIsFAANG && !bIsFAANG) return -1;
        if (!aIsFAANG && bIsFAANG) return 1;
        
        // Then by recency
        const aDate = new Date(a.job_posted_at_datetime_utc || 0);
        const bDate = new Date(b.job_posted_at_datetime_utc || 0);
        return bDate - aDate;
    });
    
    return uniqueJobs.slice(0, 50); // Top 50 jobs
}

// Generate company statistics with categories
function generateCompanyStats(jobs) {
    const stats = {
        byCategory: {},
        byLevel: { 'Entry-Level': 0, 'Mid-Level': 0, 'Senior': 0 },
        byLocation: {},
        totalByCompany: {}
    };
    
    jobs.forEach(job => {
        // Category stats
        const category = getJobCategory(job.job_title, job.job_description);
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        
        // Level stats
        const level = getExperienceLevel(job.job_title, job.job_description);
        stats.byLevel[level]++;
        
        // Location stats
        const location = formatLocation(job.job_city, job.job_state);
        stats.byLocation[location] = (stats.byLocation[location] || 0) + 1;
        
        // Company stats
        stats.totalByCompany[job.employer_name] = (stats.totalByCompany[job.employer_name] || 0) + 1;
    });
    
    return stats;
}

// Write the new jobs JSON for Discord with atomic writes
function writeNewJobsJson(jobs) {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    
    try {
        // Ensure data folder exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Atomic write: write to temp file then rename
        const outPath = path.join(dataDir, 'new_jobs.json');
        const tempPath = path.join(dataDir, 'new_jobs.tmp.json');
        
        // Write to temporary file
        fs.writeFileSync(tempPath, JSON.stringify(jobs, null, 2), 'utf8');
        
        // Atomic rename - this prevents corruption if process is killed mid-write
        fs.renameSync(tempPath, outPath);
        
        console.log(`✨ Wrote ${jobs.length} new jobs to ${outPath}`);
        
    } catch (error) {
        console.error('❌ Error writing new_jobs.json:', error.message);
        
        // Clean up temp file if it exists
        const tempPath = path.join(dataDir, 'new_jobs.tmp.json');
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (cleanupError) {
                console.error('⚠️ Could not clean up temp file:', cleanupError.message);
            }
        }
        
        throw error; // Re-throw to stop execution
    }
}

// Update seen jobs store with atomic writes to prevent corruption
function updateSeenJobsStore(jobs, seenIds) {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    
    try {
        // Ensure data folder exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Mark new jobs as seen
        jobs.forEach(job => seenIds.add(job.id));
        
        // Convert Set to sorted array for consistency
        let seenJobsArray = [...seenIds].sort();
        
        // Cleanup: Remove entries older than 30 days to prevent infinite growth
        // This is safe because we only track jobs from the last week anyway
        const maxEntries = 10000; // Reasonable upper limit
        if (seenJobsArray.length > maxEntries) {
            seenJobsArray = seenJobsArray.slice(-maxEntries); // Keep most recent entries
            console.log(`🧹 Trimmed seen_jobs.json to ${maxEntries} most recent entries`);
        }
        
        // Atomic write: write to temp file then rename
        const seenPath = path.join(dataDir, 'seen_jobs.json');
        const tempPath = path.join(dataDir, 'seen_jobs.tmp.json');
        
        // Write to temporary file
        fs.writeFileSync(tempPath, JSON.stringify(seenJobsArray, null, 2), 'utf8');
        
        // Atomic rename - this prevents corruption if process is killed mid-write
        fs.renameSync(tempPath, seenPath);
        
        console.log(`✅ Updated seen_jobs.json with ${jobs.length} new entries (total: ${seenJobsArray.length})`);
        
    } catch (error) {
        console.error('❌ Error updating seen jobs store:', error.message);
        
        // Clean up temp file if it exists
        const tempPath = path.join(dataDir, 'seen_jobs.tmp.json');
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (cleanupError) {
                console.error('⚠️ Could not clean up temp file:', cleanupError.message);
            }
        }
        
        throw error; // Re-throw to stop execution
    }
}

// Load seen jobs for deduplication with error handling and validation
function loadSeenJobsStore() {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    const seenPath = path.join(dataDir, 'seen_jobs.json');
    
    try {
        if (!fs.existsSync(seenPath)) {
            console.log('ℹ️ No existing seen_jobs.json found - starting fresh');
            return new Set();
        }
        
        const fileContent = fs.readFileSync(seenPath, 'utf8');
        if (!fileContent.trim()) {
            console.log('⚠️ Empty seen_jobs.json file - starting fresh');
            return new Set();
        }
        
        const seenJobs = JSON.parse(fileContent);
        if (!Array.isArray(seenJobs)) {
            console.log('⚠️ Invalid seen_jobs.json format - expected array, starting fresh');
            return new Set();
        }
        
        // Filter out invalid entries (non-strings or empty strings)
        const validSeenJobs = seenJobs.filter(id => typeof id === 'string' && id.trim().length > 0);
        
        if (validSeenJobs.length !== seenJobs.length) {
            console.log(`⚠️ Filtered ${seenJobs.length - validSeenJobs.length} invalid entries from seen_jobs.json`);
        }
        
        console.log(`✅ Loaded ${validSeenJobs.length} previously seen jobs`);
        
        // Migration check: if all IDs are in old format, we need to regenerate them
        // Old format contains commas and multiple dashes, new format doesn't
        const hasOldFormatIds = validSeenJobs.some(id => id.includes(',') || id.includes('---'));
        
        if (hasOldFormatIds && validSeenJobs.length > 0) {
            console.log('⚠️ Detected old job ID format - migrating to new standardized format');
            
            // Migrate old IDs to new format to minimize re-posting
            const migratedIds = validSeenJobs.map(oldId => {
                if (oldId.includes(',') || oldId.includes('---')) {
                    return migrateOldJobId(oldId);
                }
                return oldId; // Already in new format
            });
            
            const uniqueMigratedIds = [...new Set(migratedIds)];
            console.log(`📝 Migrated ${validSeenJobs.length} old IDs to ${uniqueMigratedIds.length} new format IDs`);
            
            return new Set(uniqueMigratedIds);
        }
        
        return new Set(validSeenJobs);
        
    } catch (error) {
        console.error('❌ Error loading seen_jobs.json:', error.message);
        console.log('ℹ️ Creating backup and starting fresh');
        
        // Create backup of corrupted file
        try {
            const backupPath = path.join(dataDir, `seen_jobs_backup_${Date.now()}.json`);
            fs.copyFileSync(seenPath, backupPath);
            console.log(`📁 Backup created: ${backupPath}`);
        } catch (backupError) {
            console.error('⚠️ Could not create backup:', backupError.message);
        }
        
        return new Set();
    }
}

// Main job processing function
async function processJobs() {
    console.log('🚀 Starting job processing...');
    
    try {
        // Load seen jobs for deduplication
        const seenIds = loadSeenJobsStore();
        
        // Load job dates store
        const jobDatesStore = loadJobDatesStore();
        
        // Fetch jobs from both API and real career pages
        const allJobs = await fetchAllRealJobs();
        
        // Fill null dates and convert to relative format
        const jobsWithDates = fillJobDates(allJobs, jobDatesStore);
        
        // Filter current jobs (not older than a week)
        const currentJobs = jobsWithDates.filter(j => !isJobOlderThanWeek(j.job_posted_at));
        
        // Add unique IDs for deduplication using standardized generation
        currentJobs.forEach(job => {
            job.id = generateJobId(job);
        });
        
        // Filter for truly new jobs (not previously seen)
        const freshJobs = currentJobs.filter(job => !seenIds.has(job.id));
        
        if (freshJobs.length === 0) {
            console.log('ℹ️ No new jobs found - all current openings already processed');
            // Write empty array to clear stale data
            writeNewJobsJson([]);
        } else {
            console.log(`📬 Found ${freshJobs.length} new jobs to process`);
            // Write new jobs for Discord bot consumption
            writeNewJobsJson(freshJobs);
            // Update seen jobs store
            updateSeenJobsStore(freshJobs, seenIds);
        }
        
        // Calculate archived jobs
        const archivedJobs = jobsWithDates.filter(j => isJobOlderThanWeek(j.job_posted_at));
        
        console.log(`✅ Job processing complete - ${currentJobs.length} current, ${archivedJobs.length} archived`);
        
        return {
            currentJobs,
            archivedJobs,
            freshJobs,
            stats: generateCompanyStats(currentJobs)
        };
        
    } catch (error) {
        console.error('❌ Error in job processing:', error);
        throw error;
    }
}

module.exports = {
    searchJobs,
    fetchAllJobs,
    filterTargetCompanyJobs,
    generateCompanyStats,
    writeNewJobsJson,
    updateSeenJobsStore,
    loadSeenJobsStore,
    processJobs
};