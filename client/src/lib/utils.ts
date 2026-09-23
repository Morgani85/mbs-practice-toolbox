import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric", 
    year: "numeric",
  }).format(new Date(date));
}

export function getCurrentWeekEnding(): string {
  const date = new Date();
  const dayOfWeek = date.getDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return date.toISOString().split('T')[0];
}

export function getPreviousCompletedWeekEnding(): string {
  const date = new Date();
  const dayOfWeek = date.getDay();
  
  // If it's Monday (1), show the week that ended yesterday (Sunday)
  // For any other day, show the week that ended on the most recent Sunday
  let daysToSubtract;
  if (dayOfWeek === 0) { // Sunday
    daysToSubtract = 7; // Show previous Sunday
  } else if (dayOfWeek === 1) { // Monday
    daysToSubtract = 1; // Show yesterday (Sunday)
  } else { // Tuesday-Saturday
    daysToSubtract = dayOfWeek; // Show most recent Sunday
  }
  
  date.setDate(date.getDate() - daysToSubtract);
  return date.toISOString().split('T')[0];
}

export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Validate that a date is a Sunday, 1st, 15th, or last day of month
export function validateWeekEndingDateClient(dateString: string): { isValid: boolean; errorMessage?: string } {
  const dateWithTime = dateString.includes('T') ? dateString : `${dateString}T00:00:00Z`;
  const date = new Date(dateWithTime);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, errorMessage: "Please enter a valid date" };
  }
  
  const dayOfWeek = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  
  const isSunday = dayOfWeek === 0;
  const isFirstOfMonth = dayOfMonth === 1;
  const isFifteenthOfMonth = dayOfMonth === 15;
  const isLastDayOfMonth = dayOfMonth === lastDay;
  
  if (!isSunday && !isFirstOfMonth && !isFifteenthOfMonth && !isLastDayOfMonth) {
    return {
      isValid: false,
      errorMessage: "Date must be a Sunday, 1st, 15th, or last day of the month"
    };
  }
  
  return { isValid: true };
}
