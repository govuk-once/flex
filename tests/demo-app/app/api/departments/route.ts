import { NextResponse } from "next/server";

// Hardcoded for the demo. Shape matches DepartmentData in services/page.tsx.
// Swap this for a real config source (SSM, Flex API, etc.) without touching the UI.
const DEPARTMENTS = [
  {
    id: "dvla",
    name: "DVLA",
    accent: "yellow",
    cardColour: "bg-yellow-50 border-yellow-200",
    iconColour: "bg-yellow-400 text-yellow-900",
    connectBtnClass: "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200",
    step: "dvla",
  },
  {
    id: "uns",
    name: "UNS",
    accent: "purple",
    cardColour: "bg-purple-50 border-purple-200",
    iconColour: "bg-purple-500 text-white",
    connectBtnClass: "bg-purple-500 hover:bg-purple-600 shadow-purple-200",
    step: "uns",
  },
];

export async function GET() {
  return NextResponse.json(DEPARTMENTS);
}
