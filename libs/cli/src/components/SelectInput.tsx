import { Box, Text } from "ink";
import InkSelectInput from "ink-select-input";

import { useSpinner } from "./Spinner";

function SelectInputIndicator({
  isSelected,
  paused = false,
}: {
  isSelected?: boolean;
  paused?: boolean;
}) {
  const frame = useSpinner({
    frames: [">", "›"],
    interval: 250,
    paused,
  });

  if (isSelected) {
    return (
      <Box paddingRight={1}>
        <Text>{frame}</Text>
      </Box>
    );
  }

  return <Box paddingRight={2} />;
}

interface SelectInputItemProps {
  label: string;
  spacer?: boolean;
}

function SelectInputItem({ label, spacer }: SelectInputItemProps) {
  return (
    <Box paddingBottom={spacer ? 1 : 0}>
      {label.split("").map((item, index) => (
        <Text key={index} bold={index === 0}>
          {item}
        </Text>
      ))}
    </Box>
  );
}

export interface SelectInputItem {
  label: string;
  value: string;
  spacer?: boolean;
}

interface SelectInputProps {
  isFocused: boolean;
  items: SelectInputItem[];
  onHighlight?: (input: { value: string }) => void;
  onSelect?: (input: { value: string }) => void;
}

export function SelectInput(props: SelectInputProps) {
  return (
    <InkSelectInput<string>
      {...props}
      itemComponent={SelectInputItem}
      indicatorComponent={({ isSelected }) => (
        <SelectInputIndicator
          isSelected={isSelected}
          paused={!props.isFocused}
        />
      )}
    />
  );
}
