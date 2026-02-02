import { Box, Text } from "ink";
import { ReactNode } from "react";

import { useAwsSession } from "../providers/AwsSession";
import { useLayout } from "../providers/Layout";
import { Spinner } from "./Spinner";

interface ContainerProps {
  indicator: ReactNode;
  text: string;
}

function Container({ indicator, text }: ContainerProps) {
  return (
    <Box>
      <Box paddingRight={1}>{indicator}</Box>
      <Text>{text}</Text>
    </Box>
  );
}

export function AwsStatus() {
  const { identity } = useAwsSession();
  const { isSmall } = useLayout();

  if (identity === undefined) {
    return (
      <Container
        indicator={<Spinner spinner="dots" />}
        text={isSmall ? "AWS" : "AWS Session loading"}
      />
    );
  }

  if (typeof identity === "string") {
    return (
      <Container
        indicator={<Text color="green">●</Text>}
        text={isSmall ? identity : `AWS Session active (${identity})`}
      />
    );
  }

  return (
    <Container
      indicator={<Text color="red">●</Text>}
      text="AWS Session inactive"
    />
  );
}
