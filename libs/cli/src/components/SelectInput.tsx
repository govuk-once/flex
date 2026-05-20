import { Box, Text } from "ink";
import type { IndicatorProps } from "ink-select-input";
import InkSelectInput from "ink-select-input";

import { useSpinner } from "./Spinner";

interface SelectInputIndicatorProps {
  isSelected?: boolean;
  paused?: boolean;
}

function SelectInputIndicator({
  isSelected,
  paused = false,
}: Readonly<SelectInputIndicatorProps>) {
  const frame = useSpinner({ frames: [">", "›"], interval: 250, paused });

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

function SelectInputItem({ label, spacer }: Readonly<SelectInputItemProps>) {
  return (
    <Box paddingBottom={spacer ? 1 : 0}>
      {label.split("").map((item, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <Text key={index} bold={index === 0}>
          {item}
        </Text>
      ))}
    </Box>
  );
}

function ActiveIndicator({ isSelected }: Readonly<IndicatorProps>) {
  return <SelectInputIndicator isSelected={isSelected} />;
}

function PausedIndicator({ isSelected }: Readonly<IndicatorProps>) {
  return <SelectInputIndicator paused isSelected={isSelected} />;
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

export function SelectInput(props: Readonly<SelectInputProps>) {
  return (
    <InkSelectInput<string>
      {...props}
      itemComponent={SelectInputItem}
      indicatorComponent={props.isFocused ? ActiveIndicator : PausedIndicator}
    />
  );
}
