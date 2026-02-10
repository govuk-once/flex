import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

import { Panel } from "../components/Panel";
import { SelectInput } from "../components/SelectInput";
import { useStdoutDimensions } from "../hooks/use-stdout-dimensions";

async function createDomain(_domain: string) {
  await new Promise((resolve) => setTimeout(resolve, 10000));
}

export function CreateDomainPanel({
  close,
  domains,
}: {
  close: () => void;
  domains: string[];
}) {
  const [cols] = useStdoutDimensions();
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");

  useInput((_, key) => {
    if (!loading && key.escape) {
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
      setLoading(true);
      void createDomain(domain).then(close);
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
      {loading ? (
        <Box>
          <Text>Loading</Text>
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
