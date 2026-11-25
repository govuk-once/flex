export const CRITICAL_ALARM_ANNOTATION =
  "[c=#govuk-connect-critical-alarms, s=1]";

export function withCriticalAnnotation(alarmName: string): string {
  return `${alarmName} ${CRITICAL_ALARM_ANNOTATION}`;
}
