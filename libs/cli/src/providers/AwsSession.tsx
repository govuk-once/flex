import { exec } from "node:child_process";
import { promisify } from "node:util";

import {
  createContext,
  PropsWithChildren,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import z from "zod";

interface AwsSessionContextProps {
  identity?: string | null;
}

const AwsSessionContext = createContext<AwsSessionContextProps>({});

const execAsync = promisify(exec);

const callerIdentitySchema = z.object({
  Arn: z.string(),
  Account: z.string(),
  UserId: z.string(),
});

async function getAwsIdentity() {
  try {
    const { stdout } = await execAsync("aws sts get-caller-identity");
    return callerIdentitySchema.parse(JSON.parse(stdout)).Account;
  } catch (error) {
    console.error("Failed to resolve AWS identity:", error);
    return null;
  }
}

export function AwsSessionProvider({ children }: Readonly<PropsWithChildren>) {
  const [identity, setIdentity] = useState<string | null>();

  useEffect(() => {
    const runCheck = () => void getAwsIdentity().then(setIdentity);

    runCheck();
    const checkInterval = setInterval(runCheck, 60_000);

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  return (
    <AwsSessionContext value={useMemo(() => ({ identity }), [identity])}>
      {children}
    </AwsSessionContext>
  );
}

export const useAwsSession = () => use(AwsSessionContext);
