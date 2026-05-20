import {
  createContext,
  PropsWithChildren,
  use,
  useMemo,
  useState,
} from "react";

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

export function RouterProvider({ children }: Readonly<PropsWithChildren>) {
  const [route, setRoute] = useState<string>(Routes.HOME);

  return (
    <RouterContext value={useMemo(() => ({ route, setRoute }), [route])}>
      {children}
    </RouterContext>
  );
}

export const useRouter = () => use(RouterContext);
