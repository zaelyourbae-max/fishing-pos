const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_DATE_INPUT_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export const DEFAULT_APP_TIMEZONE = "Asia/Makassar";

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

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("id-ID", {
      timeZone,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

export function getAppTimeZone() {
  const configuredTimeZone =
    typeof document !== "undefined"
      ? document.documentElement.dataset.appTimezone
      : process.env.APP_TIMEZONE;
  const timeZone = configuredTimeZone?.trim() || DEFAULT_APP_TIMEZONE;

  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_APP_TIMEZONE;
}

function dateParts(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const inputMatch = value.match(DATE_INPUT_PATTERN);

    if (inputMatch) {
      return {
        day: inputMatch[3],
        month: inputMatch[2],
        year: inputMatch[1],
      };
    }
  }

  const date = asDate(value);

  if (!date) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: getAppTimeZone(),
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

export function formatDateID(value: Date | string | null | undefined) {
  const parts = dateParts(value);

  if (!parts) {
    return "-";
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTimeID(value: Date | string | null | undefined) {
  const date = asDate(value);

  if (!date) {
    return "-";
  }

  const parts = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: getAppTimeZone(),
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";

  return `${day}/${month}/${year} ${hour}:${minute}`;
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
