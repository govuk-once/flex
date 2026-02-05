import { Box, useFocus, useInput } from "ink";

import { Ascii } from "../components/Ascii";
import { Panel } from "../components/Panel";
import { SelectInput } from "../components/SelectInput";
import { useLayout } from "../providers/Layout";
import { Routes, useRouter } from "../providers/Router";

type MenuItem = { label: string; value: string; shortcut?: string };

const menuItems: MenuItem[] = [
  {
    label: "Home",
    value: Routes.HOME,
  },
  {
    label: "Domain",
    value: Routes.DOMAIN,
    shortcut: "d",
  },
  {
    label: "Quit",
    value: Routes.QUIT,
    shortcut: "q",
  },
];

export function NavigationPanel() {
  const { setRoute } = useRouter();
  const { isFocused, focus } = useFocus({ autoFocus: true, id: "navigation" });
  const { isSingleColumn, navWidth, isSmall } = useLayout();

  useInput((_, key) => {
    if (key.escape) {
      focus("navigation");
    }
  });

  const handleSelect = (item: { value: string }) => {
    if (!isFocused) return;
    focus(item.value);
  };

  const handleHighlight = (item: { value: string }) => {
    if (!isFocused) return;
    setRoute(item.value);
  };

  return (
    <Panel
      paddingX={1}
      width={isSingleColumn ? "100%" : navWidth}
      flexDirection="column"
    >
      <Box
        paddingBottom={1}
        paddingLeft={1}
        display={isSmall ? "none" : "flex"}
      >
        <Ascii text="Flex CLI" />
      </Box>
      <SelectInput
        isFocused={isFocused}
        items={menuItems}
        onHighlight={handleHighlight}
        onSelect={handleSelect}
      />
    </Panel>
  );
}
