import { Box, Text } from "ink";
import { PropsWithChildren } from "react";

import { useLayout } from "../providers/Layout";
import { Panel } from "./Panel";

interface MainPanelProps extends PropsWithChildren {
  label: string;
}

export function MainPanel({ children, label }: MainPanelProps) {
  const { smallPadding, bodyHeight, isSingleColumn, mainWidth } = useLayout();

  return (
    <Panel
      width={isSingleColumn ? "100%" : mainWidth}
      height={isSingleColumn ? undefined : bodyHeight}
    >
      <Box position="absolute" marginTop={-2} marginLeft={-1}>
        <Text> {label} </Text>
      </Box>
      <Box
        width="100%"
        marginX={smallPadding ? -1 : 0}
        marginY={smallPadding ? 0 : 3}
        justifyContent="center"
      >
        {children}
      </Box>
    </Panel>
  );
}
