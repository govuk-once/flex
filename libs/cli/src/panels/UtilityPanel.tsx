import { AwsStatus } from "../components/AwsStatus";
import { Panel } from "../components/Panel";
import { SessionDuration } from "../components/SessionDuration";

export function UtilityPanel() {
  return (
    <Panel
      width="100%"
      paddingY={0}
      paddingX={1}
      justifyContent="space-between"
    >
      <AwsStatus />
      <SessionDuration />
    </Panel>
  );
}
