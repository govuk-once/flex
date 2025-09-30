## Release process

Versioning

- Semantic Versioning: MAJOR.MINOR.PATCH
- Bump MAJOR for breaking changes; MINOR for features; PATCH for fixes

Changelog

- Maintain `CHANGELOG.md` with human-readable entries grouped by Added/Changed/Fixed/Deprecated/Removed/Security

Cutting a release

1. Ensure `main` is green and docs are updated
2. Update `CHANGELOG.md` and version number
3. Tag the release `vX.Y.Z` and push tags
4. Publish release notes summarising changes and migrations

Deprecations

- Announce deprecations with rationale and migration steps
- Provide at least N releases of overlap before removal

Backports

- Security fixes may be backported to the last two minor versions




