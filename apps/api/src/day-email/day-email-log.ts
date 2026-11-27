export enum DayEmailEvent {
  Run = 'day_email_run',
  Reply = 'day_email_reply',
  LanguageUnsupported = 'day_email_language_unsupported',
}

export function logDayEmailEvent(event: { event: DayEmailEvent } & Record<string, string | number>): void {
  console.log(JSON.stringify(event));
}
