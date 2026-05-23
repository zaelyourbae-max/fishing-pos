const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_DATE_INPUT_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function dateFromInput(value: string) {
  const match = value.match(DATE_INPUT_PATTERN);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const inputDate = dateFromInput(value);

  if (inputDate) {
    return inputDate;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateID(value: Date | string | null | undefined) {
  const date = asDate(value);

  if (!date) {
    return "-";
  }

  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTimeID(value: Date | string | null | undefined) {
  const date = asDate(value);

  if (!date) {
    return "-";
  }

  return `${formatDateID(date)} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function parseIDDateInput(value: string) {
  const trimmed = value.trim();
  const idMatch = trimmed.match(ID_DATE_INPUT_PATTERN);
  const isoMatch = trimmed.match(DATE_INPUT_PATTERN);

  const day = idMatch ? Number(idMatch[1]) : isoMatch ? Number(isoMatch[3]) : NaN;
  const month = idMatch ? Number(idMatch[2]) : isoMatch ? Number(isoMatch[2]) : NaN;
  const year = idMatch ? Number(idMatch[3]) : isoMatch ? Number(isoMatch[1]) : NaN;

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${twoDigits(month)}-${twoDigits(day)}`;
}
