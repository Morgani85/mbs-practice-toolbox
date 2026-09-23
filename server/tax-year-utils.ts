// Tax year utilities for UK tax year cycle
// Tax year runs from April 6th to April 5th the following year
// Filing deadline is January 31st of the year AFTER the tax year ends
//   e.g. tax year 2025/26 (Apr 2025 – Apr 2026) → deadline 31 Jan 2026
// Grace period: Feb 1 – March 31 (data stays visible for review, no new entries counted)
// Data resets on April 1st ready for the new tax year (which starts April 6th)

export interface TaxYearInfo {
  taxYearStart: Date;
  taxYearEnd: Date;
  filingDeadline: Date;
  resetDate: Date;
  isActive: boolean;       // True only during the counting window: Apr 6 → Jan 31
  isGracePeriod: boolean;  // True during the review window: Feb 1 → Mar 31
  shouldShowData: boolean; // True when data should be visible (active OR grace period)
  label: string;           // e.g. "2025/26"
}

/**
 * Get the current tax year information based on today's date.
 * Dynamically resolves the correct tax year — no hardcoding.
 *
 * Timeline:
 *   Apr 6 Y  → Jan 31 Y+1  : active counting window for tax year Y
 *   Feb 1 Y+1 → Mar 31 Y+1 : grace period — review only, no new entries
 *   Apr 1 Y+1               : reset — switch to new tax year Y+1
 *   Apr 6 Y+1               : new active counting window begins
 */
export function getCurrentTaxYear(): TaxYearInfo {
  const today = new Date();
  return getTaxYearForDate(today);
}

/**
 * Get tax year info for a specific date.
 * Works for any date — past, present, or future.
 */
export function getTaxYearForDate(date: Date): TaxYearInfo {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Determine which tax year start year applies for this date.
  //
  // A date belongs to tax year N if:
  //   - it is on or after Apr 6 of year N, OR
  //   - it is before Apr 1 of year N+1 (i.e. still in the grace period of year N)
  //
  // In practice:
  //   - Jan 1 – Mar 31  : grace period of the previous tax year (start year = year - 1)
  //   - Apr 1 – Apr 5   : brief gap between reset and new year (treat as new year about to start;
  //                        show empty new-year view so teams know the slate is clean)
  //   - Apr 6 – Dec 31  : active window for the current year's tax year (start year = year)

  let taxYearStartYear: number;

  if (month < 3) {
    // Jan, Feb, Mar — grace period of tax year that started LAST year
    taxYearStartYear = year - 1;
  } else if (month === 3 && day < 6) {
    // Apr 1–5 — reset gap, show upcoming tax year as "starting soon"
    // We treat this as the new tax year (start year = current year) so the
    // dashboard shows a clean slate and prompts teams to prepare.
    taxYearStartYear = year;
  } else {
    // Apr 6 onwards — active counting window for this year
    taxYearStartYear = year;
  }

  const taxYearStart    = new Date(taxYearStartYear, 3, 6);                // Apr 6  Y
  const taxYearEnd      = new Date(taxYearStartYear + 1, 3, 5);            // Apr 5  Y+1
  const filingDeadline  = new Date(taxYearStartYear + 1, 0, 31);           // Jan 31 Y+1
  const resetDate       = new Date(taxYearStartYear + 1, 2, 31);           // Mar 31 Y+1

  const isActive        = date >= taxYearStart && date <= filingDeadline;
  const isGracePeriod   = date > filingDeadline && date <= resetDate;
  const shouldShowData  = isActive || isGracePeriod;

  // The returns being filed during this working period are for the PREVIOUS tax year.
  // e.g. working Apr 2026 → Jan 2027 means filing 2025/26 returns.
  const filingYear    = taxYearStartYear - 1;
  const filingYearEnd = taxYearStartYear.toString().slice(-2);
  const label         = `${filingYear}/${filingYearEnd}`;

  return {
    taxYearStart,
    taxYearEnd,
    filingDeadline,
    resetDate,
    isActive,
    isGracePeriod,
    shouldShowData,
    label,
  };
}

/**
 * Format tax year for display.
 * taxYearStart is the beginning of the WORKING/COUNTING period (e.g. Apr 2026).
 * The returns being filed are for the PREVIOUS tax year, so we display e.g. "2025/26".
 */
export function formatTaxYear(taxYearStart: Date): string {
  const workingYear = taxYearStart.getFullYear();
  const filingYear  = workingYear - 1;
  const filingEnd   = workingYear.toString().slice(-2);
  return `${filingYear}/${filingEnd}`;
}

/**
 * Check if two dates are in the same tax year
 */
export function isSameTaxYear(date1: Date, date2: Date): boolean {
  const taxYear1 = getTaxYearForDate(date1);
  const taxYear2 = getTaxYearForDate(date2);
  return taxYear1.taxYearStart.getTime() === taxYear2.taxYearStart.getTime();
}

/**
 * Get all week ending dates for a tax year that should be included in calculations
 */
export function getTaxYearWeekEndings(taxYearStart: Date, weekEndingDate: Date): Date[] {
  const taxYearInfo = getTaxYearForDate(taxYearStart);
  const weekEndings: Date[] = [];

  let currentDate = new Date(taxYearInfo.taxYearStart);
  const daysUntilSunday = (7 - currentDate.getDay()) % 7;
  currentDate.setDate(currentDate.getDate() + daysUntilSunday);
  if (daysUntilSunday === 0) currentDate.setDate(currentDate.getDate() + 7);

  while (currentDate <= weekEndingDate && currentDate <= taxYearInfo.filingDeadline) {
    weekEndings.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weekEndings;
}
