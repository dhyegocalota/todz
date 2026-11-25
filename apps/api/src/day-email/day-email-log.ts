export enum DayEmailEvent {
  Run = 'day_email_run',
  Reply = 'day_email_reply',
}

export function logDayEmailEvent(event: { event: DayEmailEvent } & Record<string, string | number>): void {
  console.log(JSON.stringify(event));
}
