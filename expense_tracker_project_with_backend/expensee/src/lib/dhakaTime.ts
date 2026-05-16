export const DHAKA_TIME_ZONE = 'Asia/Dhaka';

type DhakaParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

const getDhakaParts = (date = new Date()): DhakaParts => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second')
  };
};

export const getDhakaDateInputValue = (date = new Date()): string => {
  const { year, month, day } = getDhakaParts(date);
  return `${year}-${month}-${day}`;
};

export const getDhakaDateKey = (date = new Date()): string => {
  const { year, month, day } = getDhakaParts(date);
  return `${year}${month}${day}`;
};

export const getDhakaMonthIndex = (date = new Date()): number => {
  return Number(getDhakaParts(date).month) - 1;
};

export const getDhakaYear = (date = new Date()): number => {
  return Number(getDhakaParts(date).year);
};

export const createDhakaTimestamp = (dateInput?: string): string => {
  const { hour, minute, second } = getDhakaParts();
  const date = dateInput || getDhakaDateInputValue();
  return `${date}T${hour}:${minute}:${second}+06:00`;
};

export const formatDateDhaka = (value: string | Date): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const getStoredDateInputValue = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return getDhakaDateInputValue(new Date(value));
};
