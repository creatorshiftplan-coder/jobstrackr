import { describe, it, expect } from "vitest";
import { getTrustedJobDeadline, isJobOpenForFeed, UNKNOWN_DEADLINE_GRACE_DAYS, cleanSalaryText } from "./jobUtils";

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
