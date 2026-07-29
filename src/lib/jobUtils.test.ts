import { describe, it, expect } from "vitest";
import {
  getTrustedJobDeadline,
  isJobOpenForFeed,
  UNKNOWN_DEADLINE_GRACE_DAYS,
  cleanSalaryText,
  isPlausibleSalary,
  getVacancyDisplay,
} from "./jobUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

const iso = (d: Date) => d.toISOString().split("T")[0];
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

describe("getTrustedJobDeadline", () => {
  it("returns the stored deadline for a normal job", () => {
    const job = {
      last_date: iso(daysFromNow(30)),
      last_date_display: null,
      created_at: daysFromNow(-10).toISOString(),
    };
    expect(getTrustedJobDeadline(job)?.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a fabricated deadline (created_at + 1 year, no display text)", () => {
    // Old ingestion bug: unparseable scrape date stored as today + 1 year.
    const created = daysFromNow(-100);
    const job = {
      last_date: iso(new Date(created.getTime() + 365 * DAY_MS)),
      last_date_display: null,
      created_at: created.toISOString(),
    };
    expect(getTrustedJobDeadline(job)).toBeNull();
  });

  it("keeps a year-out deadline when the raw display text confirms it", () => {
    const created = daysFromNow(-2);
    const deadline = new Date(created.getTime() + 365 * DAY_MS);
    const job = {
      last_date: iso(deadline),
      last_date_display: iso(deadline),
      created_at: created.toISOString(),
    };
    expect(getTrustedJobDeadline(job)).not.toBeNull();
  });

  it("falls back to a parseable display date when the stored one is fabricated", () => {
    const created = daysFromNow(-200);
    const realDeadline = daysFromNow(-170);
    const job = {
      last_date: iso(new Date(created.getTime() + 365 * DAY_MS)),
      last_date_display: iso(realDeadline),
      created_at: created.toISOString(),
    };
    const trusted = getTrustedJobDeadline(job);
    expect(trusted).not.toBeNull();
    expect(trusted!.getTime()).toBeLessThan(Date.now());
  });

  it("returns null for TBD", () => {
    expect(getTrustedJobDeadline({ last_date: "TBD", created_at: new Date().toISOString() })).toBeNull();
  });
});

describe("isJobOpenForFeed", () => {
  it("keeps a job with a real future deadline", () => {
    expect(
      isJobOpenForFeed({
        last_date: iso(daysFromNow(15)),
        last_date_display: null,
        created_at: daysFromNow(-5).toISOString(),
      })
    ).toBe(true);
  });

  it("drops a job with a real past deadline", () => {
    expect(
      isJobOpenForFeed({
        last_date: iso(daysFromNow(-5)),
        last_date_display: null,
        created_at: daysFromNow(-40).toISOString(),
      })
    ).toBe(false);
  });

  it("drops an old job whose only deadline is fabricated", () => {
    // The screenshot case: scraped ~a year ago, last_date fabricated to
    // created_at + 1 year, so it still reads as "active" for months.
    const created = daysFromNow(-300);
    expect(
      isJobOpenForFeed({
        last_date: iso(new Date(created.getTime() + 365 * DAY_MS)),
        last_date_display: null,
        created_at: created.toISOString(),
      })
    ).toBe(false);
  });

  it("keeps a fresh TBD job within the grace period", () => {
    expect(
      isJobOpenForFeed({
        last_date: "TBD",
        last_date_display: "To be announced",
        created_at: daysFromNow(-3).toISOString(),
      })
    ).toBe(true);
  });

  it("drops a TBD job older than the grace period", () => {
    expect(
      isJobOpenForFeed({
        last_date: "TBD",
        last_date_display: null,
        created_at: daysFromNow(-(UNKNOWN_DEADLINE_GRACE_DAYS + 10)).toISOString(),
      })
    ).toBe(false);
  });
});

describe("cleanSalaryText", () => {
  it("strips a 'DON'T MISS' related-jobs block", () => {
    const raw =
      "The official short notice does not mention the pay scale. This section will be updated as soon as the detailed notification is released. DON'T MISS TSLPRB 7437 Constable, Warder, SI Online Form 2026 7,437 Posts 7,437 posts NFR 6777 Act Apprentice 6,777 posts";
    expect(cleanSalaryText(raw)).toBe(
      "The official short notice does not mention the pay scale. This section will be updated as soon as the detailed notification is released."
    );
  });

  it("strips an 'Also Read:' promo/related-article line", () => {
    const raw =
      "Fixed monthly pay of ₹26,000 for the first five years, then Level-4 scale. Also Read: NFR Act Apprentice Recruitment 2026: Apply Online for 6777 Posts";
    expect(cleanSalaryText(raw)).toBe(
      "Fixed monthly pay of ₹26,000 for the first five years, then Level-4 scale."
    );
  });

  it("cuts at the earliest marker when both are present", () => {
    const raw = "Basic pay ₹50,000 per month. Also Read: something DON'T MISS other jobs";
    expect(cleanSalaryText(raw)).toBe("Basic pay ₹50,000 per month.");
  });

  it("leaves clean salary text untouched", () => {
    const raw = "₹35,400 - ₹1,12,400 (Level 6)";
    expect(cleanSalaryText(raw)).toBe(raw);
  });

  it("returns null for empty or nullish input", () => {
    expect(cleanSalaryText(null)).toBeNull();
    expect(cleanSalaryText(undefined)).toBeNull();
    expect(cleanSalaryText("")).toBeNull();
  });

  it("returns null when only junk remains after cleaning", () => {
    expect(cleanSalaryText("DON'T MISS TSLPRB 7437 Constable 7,437 posts")).toBeNull();
  });
});

describe("isPlausibleSalary", () => {
  // Values taken from real rows the scraper stored before the July-2026 fix,
  // where a pay-matrix level was read as the salary.
  it.each([7, 6, 10, 14, 2, 4, 11, 15])("rejects pay-matrix level %i", (level) => {
    expect(isPlausibleSalary(level)).toBe(false);
  });

  it("rejects null, undefined and non-finite values", () => {
    expect(isPlausibleSalary(null)).toBe(false);
    expect(isPlausibleSalary(undefined)).toBe(false);
    expect(isPlausibleSalary(NaN)).toBe(false);
  });

  it("accepts real pay figures, including the lowest grade-pay values", () => {
    expect(isPlausibleSalary(1800)).toBe(true);
    expect(isPlausibleSalary(11040)).toBe(true);
    expect(isPlausibleSalary(35400)).toBe(true);
    expect(isPlausibleSalary(177500)).toBe(true);
  });

  it("treats the 1000 boundary as inclusive", () => {
    expect(isPlausibleSalary(999)).toBe(false);
    expect(isPlausibleSalary(1000)).toBe(true);
  });
});

describe("getVacancyDisplay", () => {
  it("prefers the title count when the stored number dwarfs it", () => {
    // Real row: a ₹11,040 stipend column summed across 12 rows into "vacancies".
    expect(
      getVacancyDisplay({
        title: "CSIR CECRI Apprentice Recruitment 2026 – Walk in for 27 Posts",
        vacancies: 127280,
        vacancies_display: "127280 Posts",
      })
    ).toBe("27 Posts");
  });

  it("leaves genuinely large counts alone when the title agrees", () => {
    expect(
      getVacancyDisplay({
        title: "SSC GD Constable Recruitment 2026 - Apply Online for 25487 Posts",
        vacancies: 25487,
      })
    ).toBe("25487 Posts");
  });

  it("keeps the stored count when the title states no number", () => {
    expect(getVacancyDisplay({ title: "UP Home Guard Recruitment 2025", vacancies: 41424 })).toBe(
      "41424 Posts"
    );
  });

  it("still honours the breakdown total and the custom word", () => {
    expect(
      getVacancyDisplay(
        { title: "Some Recruitment 2026", job_metadata: { vacancies_detail: [{ post: "Total", n: "120" }] } },
        "Vacancies"
      )
    ).toBe("120 Vacancies");
  });

  it("falls back to TBD with no usable source", () => {
    expect(getVacancyDisplay({ title: "Some Recruitment 2026", vacancies_display: "Not Found" })).toBe("TBD");
  });
});
