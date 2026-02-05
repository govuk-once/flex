import { Box } from "ink";
import { JSX } from "react";

import { useRouter } from "../providers/Router";

export function Route({
  component,
  persistent = false,
  route,
}: {
  component: () => JSX.Element;
  persistent?: boolean;
  route: string;
}) {
  const { route: currentRoute } = useRouter();
  const pathMatches = route === currentRoute;
  if (!persistent && !pathMatches) return null;

  const Component = component;
  return (
    <Box display={pathMatches ? "flex" : "none"} flexGrow={1}>
      <Component />
    </Box>
  );
}
