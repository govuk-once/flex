import { exec } from "child_process";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { promisify } from "util";
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

  return (
    <AwsSessionContext.Provider value={{ identity }}>
      {children}
    </AwsSessionContext.Provider>
  );
}

export const useAwsSession = () => useContext(AwsSessionContext);
