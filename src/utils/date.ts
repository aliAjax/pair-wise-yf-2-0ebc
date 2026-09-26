/** 格式化为本地 YYYY-MM-DD */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 取 ISO 时间戳对应的本地日期（YYYY-MM-DD），无法解析时返回空串 */
export function dateStringOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatLocalDate(date);
}

/** 今天的本地日期（YYYY-MM-DD） */
export function todayDateString(): string {
  return formatLocalDate(new Date());
}
