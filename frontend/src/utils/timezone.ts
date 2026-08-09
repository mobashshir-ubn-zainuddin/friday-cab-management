import { toZonedTime, format as tzFormat } from 'date-fns-tz';

export const APP_TIMEZONE = 'Asia/Kolkata';

const safeParse = (date: Date | string | null | undefined): Date | null => {
  if (date === null || date === undefined || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

export const formatInIST = (
  date: Date | string | null | undefined,
  pattern: string,
  fallback: string = ''
): string => {
  const d = safeParse(date);
  if (!d) return fallback;
  return tzFormat(d, pattern, { timeZone: APP_TIMEZONE });
};

export const formatLongDateIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'EEEE, dd MMMM yyyy');

export const formatDateIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'dd MMM yyyy');

export const formatShortDateIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'MMM dd');

export const formatTimeIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'hh:mm a');

export const formatTime24IST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'HH:mm');

export const formatDateTimeIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'dd MMM yyyy, hh:mm a');

export const formatForDateInputIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, 'yyyy-MM-dd');

export const formatForDatetimeLocalIST = (date: Date | string | null | undefined): string =>
  formatInIST(date, "yyyy-MM-dd'T'HH:mm");

export const istDateOnlyFromTripDate = (
  date: Date | string | null | undefined
): string => {
  return formatInIST(date, 'yyyy-MM-dd');
};

export const isAfterNowInIST = (
  date: Date | string | null | undefined
): boolean => {
  const d = safeParse(date);
  return !!d && d.getTime() > Date.now();
};

export const isBeforeNowInIST = (
  date: Date | string | null | undefined
): boolean => {
  const d = safeParse(date);
  return !!d && d.getTime() < Date.now();
};

export const isNowBetween = (
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): boolean => {
  const s = safeParse(start);
  const e = safeParse(end);
  const n = Date.now();
  return !!s && !!e && s.getTime() <= n && n <= e.getTime();
};

export const istCurrentMonth = (): number => {
  const d = toZonedTime(new Date(), APP_TIMEZONE);
  return d.getMonth() + 1;
};

export const istCurrentYear = (): number => {
  const d = toZonedTime(new Date(), APP_TIMEZONE);
  return d.getFullYear();
};
