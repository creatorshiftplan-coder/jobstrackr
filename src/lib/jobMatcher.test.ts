import { describe, it, expect } from "vitest";
import { Job } from "@/types/job";
import {
  checkEligibility,
  canApply,
  needsReview,
  getUserQualProfileWithStream,
} from "@/lib/jobMatcher";

/**
 * Regression suite pinning the precision-first eligibility taxonomy:
 *   canApply()    → no skill gaps AND no unverifiable blockers AND no hard fail
 *   needsReview() → passes hard checks but has an unverifiable blocker
 *   !eligible     → a definite, verifiable failure (age out of range, qual too low…)
 *
 * The contract: a user must NEVER see a job in the "can apply" tier they cannot
 * actually apply to. Anything we cannot positively confirm must fall to Review.
 */

function makeJob(over: Partial<Job>): Job {
  return {
    id: "job-1",
    slug: null,
    title: "Test Officer",
    department: "Test Department",
    location: "Delhi",
    salary_min: null,
    salary_max: null,
    age_min: null,
    age_max: null,
    application_fee: null,
    qualification: "Graduate",
    experience: null,
    vacancies: 1,
    vacancies_display: null,
    application_start_date: null,
    last_date: "2099-12-31",
    last_date_display: null,
    description: null,
    eligibility: null,
    apply_link: null,
    official_website: null,
    is_featured: null,
    admin_refreshed_at: null,
    job_metadata: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    tags: null,
    inferred_location: null,
    eligibility_summary: null,
    required_skills: null,
    ...over,
  } as Job;
}

const graduate = getUserQualProfileWithStream("graduation", "general");
const lawGraduate = getUserQualProfileWithStream("graduation", "law");

describe("checkEligibility — precision-first taxonomy", () => {
  it("CAN APPLY: graduate meets a plain graduate requirement", () => {
    const job = makeJob({ qualification: "Graduate" });
    const e = checkEligibility(25, graduate, job);
    expect(e.eligible).toBe(true);
    expect(e.blockers).toHaveLength(0);
    expect(e.skillsMissing).toHaveLength(0);
    expect(canApply(e)).toBe(true);
    expect(needsReview(e)).toBe(false);
  });

  it("CAN APPLY: over-qualified user meets a lower requirement", () => {
    const job = makeJob({ qualification: "10th Pass / Matriculation" });
    const e = checkEligibility(25, graduate, job);
    expect(e.qualOk).toBe(true);
    expect(canApply(e)).toBe(true);
  });

  it("NOT ELIGIBLE: age out of range is a hard fail (not review)", () => {
    const job = makeJob({ qualification: "Graduate", age_min: 18, age_max: 30 });
    const e = checkEligibility(40, graduate, job);
    expect(e.ageOk).toBe(false);
    expect(e.eligible).toBe(false);
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(false);
  });

  it("NOT ELIGIBLE: qualification below the required level is a hard fail", () => {
    const job = makeJob({ qualification: "Post Graduate degree (Master's)" });
    const e = checkEligibility(25, graduate, job);
    expect(e.qualOk).toBe(false);
    expect(e.eligible).toBe(false);
    expect(canApply(e)).toBe(false);
  });

  it("REVIEW: age limit present but user DOB unknown → blocker, not eligible-list", () => {
    const job = makeJob({ qualification: "Graduate", age_min: 18, age_max: 30 });
    const e = checkEligibility(null, graduate, job);
    expect(e.eligible).toBe(true); // no DEFINITE failure
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(true);
  });

  it("REVIEW (KEY REGRESSION): unparseable qualification → blocker, never auto-eligible", () => {
    const job = makeJob({ qualification: "Eligible as notified" });
    const e = checkEligibility(25, graduate, job);
    expect(e.qualOk).toBeNull();
    expect(e.blockers).toContain("Qualification criteria need manual review");
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(true);
  });

  it("REVIEW: domicile / residency requirement → blocker even with a clear qualification", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Candidate must be a permanent resident of the state. Domicile certificate required.",
    });
    const e = checkEligibility(25, graduate, job);
    expect(e.qualOk).toBe(true);
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(needsReview(e)).toBe(true);
    expect(canApply(e)).toBe(false);
  });

  it("REVIEW: statutory registration requirement → blocker", () => {
    const job = makeJob({
      qualification: "Bachelor of Laws (LLB)",
      eligibility: "Candidate must be enrolled as an advocate with the Bar Council.",
    });
    const e = checkEligibility(28, lawGraduate, job);
    expect(e.qualOk).toBe(true);
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(needsReview(e)).toBe(true);
  });

  it("REVIEW: regional-language requirement → blocker", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Knowledge of Odia language is required.",
    });
    const e = checkEligibility(25, graduate, job);
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(needsReview(e)).toBe(true);
  });

  it("REVIEW: medical-fitness requirement → blocker", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Candidate must be medically fit.",
    });
    const e = checkEligibility(25, graduate, job);
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(needsReview(e)).toBe(true);
  });

  it("REVIEW: post-wise / manual-review eligibility → blocker", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Eligibility criteria vary by post. Refer to the official notification for details.",
    });
    const e = checkEligibility(25, graduate, job);
    expect(e.blockers.length).toBeGreaterThan(0);
    expect(needsReview(e)).toBe(true);
    expect(canApply(e)).toBe(false);
  });

  it("ALMOST THERE: a missing acquirable skill → skillsMissing, not a blocker", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Proficiency in computer (CCC / O Level certificate) is required.",
    });
    const e = checkEligibility(25, graduate, job, null, null, []);
    expect(e.eligible).toBe(true);
    expect(e.skillsMissing.length).toBeGreaterThan(0);
    expect(e.blockers).toHaveLength(0);
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(false); // belongs in "Almost There", not "Review"
  });

  it("ALMOST THERE → CAN APPLY: the same skill is satisfied when the user has it", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "Proficiency in computer (CCC / O Level certificate) is required.",
    });
    const e = checkEligibility(25, graduate, job, null, null, ["computer"]);
    expect(e.skillsMissing).toHaveLength(0);
    expect(canApply(e)).toBe(true);
  });

  it("EXPERIENCE: a years-of-experience requirement is informational only, still applicable", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility: "3 years of experience in administration is required.",
    });
    const e = checkEligibility(30, graduate, job);
    expect(e.experienceNote).toBeTruthy();
    expect(e.blockers).toHaveLength(0);
    expect(canApply(e)).toBe(true);
  });
});

/**
 * Conjunctive / specialized-qualification gate. A BSc-general user must never see
 * a job in "can apply" when its path actually requires a specific specialization,
 * subject, or stacked credential they cannot be confirmed to hold. Anchored to real
 * leaking examples reported from production.
 */
describe("checkEligibility — conjunctive / specialized qualification gate", () => {
  // The user holds only a plain BSc (general stream, no recorded subject).
  const bsc = getUserQualProfileWithStream("graduation", "general");
  const evalBsc = (qualification: string, name: string | null = "BSc") =>
    checkEligibility(25, bsc, makeJob({ qualification }), null, null, [], name);

  it("LEAK FIX (real): specialized paramedical diploma routes to Review, not can-apply", () => {
    const e = evalBsc("Diploma (MLT/ DMLT) graduate");
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(true);
    expect(e.blockers.some((b) => /MLT/i.test(b))).toBe(true);
  });

  it("LEAK FIX (real): required subject 'Biological Science' routes to Review", () => {
    const e = evalBsc(
      "Science Graduate with Biological Science as paper or any Graduate with Bio Science in Class XI & XII",
    );
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(true);
    expect(e.blockers.some((b) => /Needs:/i.test(b))).toBe(true);
  });

  it("CONFIRM: a BSc whose recorded subject matches the required subject can apply", () => {
    // userHoldsField is root-based, so "B.Sc Biology" satisfies a "Biological Science" gate.
    const e = evalBsc("Graduate with Biological Science as a subject", "B.Sc Biology");
    expect(canApply(e)).toBe(true);
    expect(e.blockers).toHaveLength(0);
  });

  it("STACKED CREDENTIAL: 'Graduation and B.Ed' keeps a non-teaching graduate out of can-apply", () => {
    // B.Ed pins the path to the teaching stream, so a general graduate is excluded.
    const e = evalBsc("Graduation and B.Ed");
    expect(canApply(e)).toBe(false);
  });

  it("GUARD: 'Degree in any discipline' is generic and still cleanly passes (no false veto)", () => {
    const e = evalBsc("Bachelor's Degree in any discipline from a recognized university");
    expect(canApply(e)).toBe(true);
    expect(e.blockers).toHaveLength(0);
  });

  it("GUARD: an alternative path the user satisfies wins over a specialized sibling", () => {
    // The BSc cannot do the engineering diploma, but satisfies the "any Graduate" path.
    const e = evalBsc("Diploma in Civil Engineering OR any Graduate");
    expect(canApply(e)).toBe(true);
    expect(e.blockers).toHaveLength(0);
  });

  it("AI SUMMARY: a required subject stated only in the Grok summary still routes to Review", () => {
    // Qualification column is a clean "Graduate"; the specific subject lives in the summary.
    const job = makeJob({
      qualification: "Graduate",
      eligibility: null,
      eligibility_summary: "Bachelor's degree with Botany as a subject from a recognized university.",
    });
    const e = checkEligibility(25, bsc, job, null, null, [], "BSc");
    expect(canApply(e)).toBe(false);
    expect(needsReview(e)).toBe(true);
    expect(e.blockers.some((b) => /Botany/i.test(b))).toBe(true);
  });

  it("GUARD: ordinary eligibility prose (domicile, fees, experience) does not false-trigger", () => {
    const job = makeJob({
      qualification: "Graduate",
      eligibility:
        "Candidate must be a graduate. 2 years of experience in administration. Application fee Rs. 500. Knowledge of computer is desirable.",
    });
    const e = checkEligibility(25, bsc, job, null, null, ["computer"], "BSc");
    expect(canApply(e)).toBe(true);
    expect(e.blockers).toHaveLength(0);
  });
});
