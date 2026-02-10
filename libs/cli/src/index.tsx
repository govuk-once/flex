import { Box, render } from "ink";

import { Route } from "./components/Route";
import { DomainPanel } from "./panels/DomainPanel";
import { HomePanel } from "./panels/HomePanel";
import { NavigationPanel } from "./panels/NavigationPanel";
import { QuitPanel } from "./panels/QuitPanel";
import { UtilityPanel } from "./panels/UtilityPanel";
import { AwsSessionProvider } from "./providers/AwsSession";
import { LayoutProvider, useLayout } from "./providers/Layout";
import { RouterProvider, Routes } from "./providers/Router";

function App() {
  const { isSingleColumn, bodyHeight } = useLayout();

  return (
    <>
      <UtilityPanel />
      <Box
        flexDirection={isSingleColumn ? "column-reverse" : "row"}
        alignItems="flex-start"
        columnGap={1}
        height={bodyHeight}
        width="100%"
      >
        <NavigationPanel />
        <Route route={Routes.HOME} component={HomePanel} />
        <Route route={Routes.DOMAIN} persistent component={DomainPanel} />
        <Route route={Routes.QUIT} component={QuitPanel} />
      </Box>
    </>
  );
}

function AppWithProviders() {
  return (
    <AwsSessionProvider>
      <RouterProvider>
        <LayoutProvider>
          <App />
        </LayoutProvider>
      </RouterProvider>
    </AwsSessionProvider>
  );
}

render(<AppWithProviders />);
