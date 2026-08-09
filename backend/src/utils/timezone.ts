import { fromZonedTime, format as tzFormat, toZonedTime } from 'date-fns-tz';

export const APP_TIMEZONE = 'Asia/Kolkata';

const NAIVE_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/;
const NAIVE_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const buildNaiveDateFromNumbers = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date => {
  const d = new Date(0);
  d.setFullYear(year, month - 1, day);
  d.setHours(hour, minute, second, ms);
  return d;
};

const naiveStringToNaiveDate = (input: string): Date | null => {
  const s = input.trim();
  if (!s) return null;
  const dt = s;
  let m = dt.match(NAIVE_DATETIME_REGEX);
  if (m) {
    const [, y, mo, d, h, mi, se, ms] = m;
    const msVal = ms ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) : 0;
    return buildNaiveDateFromNumbers(
      parseInt(y, 10),
      parseInt(mo, 10),
      parseInt(d, 10),
      parseInt(h, 10),
      parseInt(mi, 10),
      se ? parseInt(se, 10) : 0,
      msVal
    );
  }
  m = dt.match(NAIVE_DATE_REGEX);
  if (m) {
    const [, y, mo, d] = m;
    return buildNaiveDateFromNumbers(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
  }
  return null;
};

export const istToUtcDate = (istDateTimeLocal: string): Date => {
  const naive = naiveStringToNaiveDate(istDateTimeLocal);
  if (naive) {
    return fromZonedTime(naive, APP_TIMEZONE);
  }
  const d = new Date(istDateTimeLocal);
  return d;
};

export const istDateToUtcMidnight = (dateOnly: string): Date => {
  const naive = naiveStringToNaiveDate(`${dateOnly}T00:00:00`);
  if (naive) {
    return fromZonedTime(naive, APP_TIMEZONE);
  }
  const d = new Date(dateOnly);
  return d;
};

export const istNowStartOfDay = (): Date => {
  const nowZoned = toZonedTime(new Date(), APP_TIMEZONE);
  const naive = buildNaiveDateFromNumbers(
    nowZoned.getFullYear(),
    nowZoned.getMonth() + 1,
    nowZoned.getDate(),
    0, 0, 0, 0
  );
  return fromZonedTime(naive, APP_TIMEZONE);
};

export const istNowStartOfMonth = (): Date => {
  const nowZoned = toZonedTime(new Date(), APP_TIMEZONE);
  const naive = buildNaiveDateFromNumbers(
    nowZoned.getFullYear(),
    nowZoned.getMonth() + 1,
    1,
    0, 0, 0, 0
  );
  return fromZonedTime(naive, APP_TIMEZONE);
};

export const isInvalidDate = (d: Date): boolean => isNaN(d.getTime());

export const formatInIST = (date: Date | string, pattern: string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return tzFormat(d, pattern, { timeZone: APP_TIMEZONE });
};

export const formatDateIST = (date: Date | string): string =>
  formatInIST(date, 'dd MMM yyyy');

export const formatLongDateIST = (date: Date | string): string =>
  formatInIST(date, 'EEEE, dd MMMM yyyy');

export const formatTimeIST = (date: Date | string): string =>
  formatInIST(date, 'hh:mm a');

export const formatTime24IST = (date: Date | string): string =>
  formatInIST(date, 'HH:mm');

export const formatDateTimeIST = (date: Date | string): string =>
  formatInIST(date, 'dd MMM yyyy, hh:mm a');

export const formatForDatetimeLocalIST = (date: Date | string): string =>
  formatInIST(date, "yyyy-MM-dd'T'HH:mm");
