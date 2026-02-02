import { Box, Text } from "ink";

import { MainPanel } from "../components/MainPanel";

export function HomePanel() {
  return (
    <MainPanel label="Home">
      <Box width={80} rowGap={1} flexDirection="column">
        <Text>
          Welcome to the Flex TUI! Use the arrow keys to select an item from the
          menu and [Enter] to focus the panel. Blinking indicators highly the
          current active item. Press [Escape] to revert focus to the main menu
          on the left.
        </Text>
      </Box>
    </MainPanel>
  );
}
