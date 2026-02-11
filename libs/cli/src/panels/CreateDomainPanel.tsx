import { findProjectRoot } from "@flex/utils";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

import { Panel } from "../components/Panel";
import { SelectInput } from "../components/SelectInput";
import { Spinner } from "../components/Spinner";
import { useStdoutDimensions } from "../hooks/use-stdout-dimensions";
import { createDomain } from "../templates/createDomain";
import { findDomainPath } from "../utils/findDomainPath";
import { runCommand } from "../utils/runCommand";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CreateDomainPanel({
  close,
  domains,
}: {
  close: () => void;
  domains: string[];
}) {
  const [cols] = useStdoutDimensions();
  const [domain, setDomain] = useState("");
  const [domainMessage, setDomainMessage] = useState<string>();
  const [error, setError] = useState("");

  useInput((_, key) => {
    if (!domainMessage && key.escape) {
      close();
    }
  });

  const handleDomain = (value: string) => {
    setError("");
    setDomain(
      value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z-]/g, ""),
    );
  };

  const handleSelect = (item: { value: string }) => {
    if (item.value === "create") {
      if (domain.length < 2) {
        setError("Error: Name length");
        return;
      }
      if (domains.includes(domain)) {
        setError("Error: Domain exists");
        return;
      }

      setDomainMessage("Creating domain file structure");
      void createDomain(domain)
        .then(() => sleep(3000))
        .then(async () => {
          setDomainMessage("Update dependencies");
          await runCommand("pnpm", ["up", "--latest"], findDomainPath(domain));
        })
        .then(() => {
          setDomainMessage("Updating pnpm-lock.yaml");
          return runCommand("pnpm", ["install"], findProjectRoot());
        })
        .then(() => sleep(3000))
        .then(async () => {
          setDomainMessage("Running checks");
          await runCommand("pnpm", ["run", "tsc"], findDomainPath(domain));
          await runCommand("pnpm", ["run", "lint"], findDomainPath(domain));
        })
        .then(() => {
          setDomainMessage("Domain created");
        })
        .then(() => sleep(3000))
        .then(close)
        .catch((error: unknown) => {
          if (error instanceof Error) {
            setError(error.message);
          } else {
            setError("An unknown error");
          }
          setDomainMessage(undefined);
        });
    }
    if (item.value === "back") {
      close();
    }
  };

  return (
    <Panel
      backgroundColor="black"
      justifyContent="space-between"
      flexDirection="row"
      marginLeft={cols < 90 ? 2 : 0}
    >
      {domainMessage ? (
        <Box columnGap={1}>
          <Spinner spinner="dots" />
          <Text>{domainMessage}</Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="column">
            <Box>
              <Box marginRight={1}>
                <Text>Name:</Text>
              </Box>
              <TextInput value={domain} onChange={handleDomain} showCursor />
            </Box>
            {error && <Text color="redBright">{error}</Text>}
          </Box>
          <SelectInput
            isFocused={true}
            items={[
              { label: "Create", value: "create" },
              { label: "Back", value: "back" },
            ]}
            onSelect={handleSelect}
          />
        </>
      )}
    </Panel>
  );
}
