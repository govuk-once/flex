export const CRITICAL_ALARM_ANNOTATION =
  "[c=#govuk-connect-critical-alarms, s=1]";

export function withAlarmSuffix(
  alarmName: string,
  suffix: string | undefined,
): string {
  return suffix ? `${alarmName} ${suffix}` : alarmName;
}
