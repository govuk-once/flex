import { config } from "@flex/config/eslint";

export default [
  ...config,
  {
    /*
     * The explorer's browser assets are authored for the page, not for this toolchain.
     * `app.js` is written compactly because it is inlined verbatim into a single-file
     * document where bytes count, and it reads globals (`CONFIG`, `VIEWS`, `PLACEMENT`)
     * that the build injects above it — so both prettier and `no-undef` would be arguing
     * with deliberate choices. `explorer.html` is generated output and gitignored.
     *
     * The model JSON and the markdown stay in scope: those are hand-edited, and the build
     * already refuses a view file that is not prettier-formatted.
     */
    ignores: ["explorer/app.js", "explorer/shell.html", "explorer.html"],
  },
];
