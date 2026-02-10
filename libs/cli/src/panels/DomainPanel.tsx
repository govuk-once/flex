import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { findProjectRoot } from "@flex/utils";
import { Box, Text, useFocus } from "ink";
import { useState } from "react";

import { MainPanel } from "../components/MainPanel";
import { SelectInput } from "../components/SelectInput";
import { Routes } from "../providers/Router";
import { CreateDomainPanel } from "./CreateDomainPanel";

const domainFolder = `${findProjectRoot()}/domains`;

function getDomains() {
  return readdirSync(domainFolder).filter((item) =>
    statSync(path.join(domainFolder, item)).isDirectory(),
  );
}

export function DomainPanel() {
  const { isFocused } = useFocus({ id: Routes.DOMAIN });
  const [activePanel, setActivePanel] = useState("main");
  const [domainDev, setDomainDev] = useState<string>();

  const menuFocused = activePanel === "main" && isFocused;

  const handleSelect = (item: { value: string }) => {
    if (item.value === "create") {
      setActivePanel("create");
    } else {
      setActivePanel("dev");
      setDomainDev(item.value);
    }
  };

  const domains = getDomains();

  const menuItems = [
    {
      label: "Create Domain",
      value: "create",
      spacer: true,
    },
    ...domains
      .map((domain) => ({ label: domain, value: domain }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return (
    <MainPanel label="Domain">
      {activePanel === "create" && (
        <Box flexDirection="column" width={80}>
          <CreateDomainPanel
            domains={domains}
            close={() => {
              setActivePanel("main");
            }}
          />
        </Box>
      )}
      {activePanel === "main" && (
        <Box flexDirection="column" width={80}>
          <Box paddingBottom={1}>
            <Text>Select a domain from the list or create a new one:</Text>
          </Box>
          <Box>
            <SelectInput
              isFocused={menuFocused}
              items={menuItems}
              onSelect={handleSelect}
            />
          </Box>
        </Box>
      )}
      <Box display={activePanel === "dev" ? "flex" : "none"}>
        <Text>
          Development tooling for{" "}
          <Text bold underline>
            {domainDev}
          </Text>{" "}
          here
        </Text>
      </Box>
    </MainPanel>
  );
}
