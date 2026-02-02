import { createContext, PropsWithChildren, useContext, useState } from "react";

export const Routes = {
  HOME: "/home",
  DOMAIN: "/domain",
  QUIT: "/quit",
} as const;

interface RouterContextProps {
  route: string;
  setRoute: (route: string) => void;
}

const RouterContext = createContext<RouterContextProps>({
  route: Routes.HOME,
  setRoute: () => {},
});

export function RouterProvider({ children }: PropsWithChildren) {
  const [route, setRouteInternal] = useState<string>(Routes.HOME);

  const setRoute = (r: string) => {
    setRouteInternal(r);
  };

  return (
    <RouterContext.Provider value={{ route, setRoute }}>
      {children}
    </RouterContext.Provider>
  );
}

export const useRouter = () => useContext(RouterContext);
