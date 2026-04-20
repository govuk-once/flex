import { createContext, PropsWithChildren, use, useState } from "react";

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
  const [route, setRoute] = useState<string>(Routes.HOME);

  return <RouterContext value={{ route, setRoute }}>{children}</RouterContext>;
}

export const useRouter = () => use(RouterContext);
