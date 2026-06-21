import { config } from "@flex/config/eslint";
import { globalIgnores } from "eslint/config";

export default [...config, globalIgnores(["**/vendor/**"])];
