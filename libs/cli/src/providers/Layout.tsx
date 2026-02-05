import { createContext, PropsWithChildren, useContext } from "react";

import { useStdoutDimensions } from "../hooks/use-stdout-dimensions";

interface LayoutContextProps {
  isSmall: boolean;
  isSingleColumn: boolean;
  bodyHeight: number;
  mainWidth: number;
  navWidth: number;
  smallPadding: boolean;
}

const LayoutContext = createContext<LayoutContextProps>({
  bodyHeight: 0,
  mainWidth: 0,
  navWidth: 0,
  isSingleColumn: false,
  isSmall: false,
  smallPadding: false,
});

export function LayoutProvider({ children }: PropsWithChildren) {
  const [columns, rows] = useStdoutDimensions();
  const isSingleColumn = columns < 150;
  const isSmall = columns < 60;
  const smallPadding = columns < 100;

  // Top bar is 3 chars tall
  const bodyHeight = rows - 3;

  return (
    <LayoutContext.Provider
      value={{
        isSmall,
        isSingleColumn,
        bodyHeight,
        navWidth: 45,
        mainWidth: columns - 45,
        smallPadding,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export const useLayout = () => useContext(LayoutContext);
