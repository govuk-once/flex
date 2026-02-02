import { Box } from "ink";
import { ComponentProps } from "react";

interface PanelProps extends ComponentProps<typeof Box> {
  label?: string;
}

export function Panel(props: PanelProps) {
  return (
    <Box
      borderStyle="round"
      borderColor="blue"
      paddingY={1}
      paddingX={3}
      {...props}
    />
  );
}
