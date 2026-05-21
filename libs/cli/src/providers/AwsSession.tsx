import { exec } from "node:child_process";
import { promisify } from "node:util";

import {
  createContext,
  PropsWithChildren,
  use,
  useEffect,
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
    const { Account } = callerIdentitySchema.parse(JSON.parse(stdout));
    return Account;
  } catch (_e: unknown) {
    return null;
  }
}

export function AwsSessionProvider({ children }: PropsWithChildren) {
  const [identity, setIdentity] = useState<string | null>();

  useEffect(() => {
    const runCheck = () => void getAwsIdentity().then(setIdentity);

    runCheck();
    const checkInterval = setInterval(runCheck, 60_000);

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  return <AwsSessionContext value={{ identity }}>{children}</AwsSessionContext>;
}

export const useAwsSession = () => use(AwsSessionContext);
