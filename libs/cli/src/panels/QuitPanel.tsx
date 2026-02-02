import { Box, Text, useFocus } from "ink";

import { MainPanel } from "../components/MainPanel";
import { SelectInput } from "../components/SelectInput";
import { Routes } from "../providers/Router";

const YES = "yes";

export function QuitPanel() {
  const { isFocused } = useFocus({ id: Routes.QUIT });

  const handleSelect = (input: { value: string }) => {
    if (input.value === YES) {
      process.exit(0);
    }
  };

  return (
    <MainPanel label="Quit">
      <Box columnGap={3}>
        <Text>Quit?</Text>
        <SelectInput
          isFocused={isFocused}
          items={[{ label: "Yes", value: YES }]}
          onSelect={handleSelect}
        />
      </Box>
    </MainPanel>
  );
}
