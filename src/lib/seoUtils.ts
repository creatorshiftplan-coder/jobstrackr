/**
 * SEO Utilities for JobsTrackr
 * Generates slugs, SEO titles, meta descriptions, and canonical URLs from job data.
 */

const SITE_URL = 'https://jobstrackr.in';

/** Generate a URL-friendly slug from a title string */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);
}

/** Get the canonical URL path for a job */
export function getJobUrl(job: { slug?: string | null; id: string }): string {
    return `/jobs/${job.slug || job.id}`;
}

/** Get the full canonical URL for a job */
export function getJobCanonicalUrl(job: { slug?: string | null; id: string }): string {
    return `${SITE_URL}${getJobUrl(job)}`;
}

/** Generate an SEO-optimized title for a job page */
export function generateSeoTitle(job: {
    title: string;
    vacancies?: number | null;
    vacancies_display?: string | null;
}): string {
    const year = new Date().getFullYear();
    const vacancyStr = job.vacancies_display || (job.vacancies ? `${job.vacancies} Vacancies` : '');
    const parts = [job.title, `Recruitment ${year}`];
    if (vacancyStr) parts.push(vacancyStr);
    return `${parts.join(' – ')} | JobsTrackr`;
}

/** Generate a meta description for a job page */
export function generateMetaDescription(job: {
    title: string;
    department: string;
    qualification: string;
    salary_min?: number | null;
    salary_max?: number | null;
    vacancies?: number | null;
    vacancies_display?: string | null;
    last_date?: string | null;
    last_date_display?: string | null;
}): string {
    const parts: string[] = [];
    parts.push(`${job.title} by ${job.department}.`);

    const vacStr = job.vacancies_display || (job.vacancies ? `${job.vacancies}` : null);
    if (vacStr) parts.push(`${vacStr} vacancies.`);

    if (job.salary_min && job.salary_max) {
        parts.push(`Salary ₹${job.salary_min.toLocaleString('en-IN')}–₹${job.salary_max.toLocaleString('en-IN')}/month.`);
    } else if (job.salary_min) {
        parts.push(`Salary ₹${job.salary_min.toLocaleString('en-IN')}+/month.`);
    }

    parts.push(`Qualification: ${job.qualification}.`);

    const dateStr = job.last_date_display || job.last_date;
    if (dateStr) parts.push(`Last date: ${dateStr}.`);

    parts.push('Apply now on JobsTrackr.');

    // Truncate to ~155 chars for Google snippet
    const full = parts.join(' ');
    return full.length > 160 ? full.substring(0, 157) + '...' : full;
}

/** Format salary range for display */
export function formatSalaryRange(min: number | null, max: number | null): string {
    if (min && max) return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')} per month`;
    if (min) return `₹${min.toLocaleString('en-IN')}+ per month`;
    if (max) return `Up to ₹${max.toLocaleString('en-IN')} per month`;
    return 'Not disclosed';
}

/** Format age limit for display */
export function formatAgeLimit(ageMin: number | null, ageMax: number | null): string {
    if (ageMin && ageMax) return `${ageMin} – ${ageMax} years`;
    if (ageMin) return `From ${ageMin} years`;
    if (ageMax) return `Upto ${ageMax} years`;
    return 'Not Available';
}
