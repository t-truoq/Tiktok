<!-- truonglt dependency patch disposition start -->
# Dependency audit disposition

Prisma/client/adapter stay7.10.0. Four previous high findings are preserved in DEPENDENCY_AUDIT_BEFORE_PATCH.json. Root scoped overrides pin @prisma/config7.10.0 deepmerge-ts8.0.2 and prisma7.10.0 mysql2 3.24.6. Lock resolved these versions; npm ci succeeds and full/omit=dev audit has zero vulnerabilities. No audit fix --force or Prisma downgrade.

[deepmerge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [v8 breaking changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0), [mysql2 advisory](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

Deepmerge update is a transitive major override, not assumed universally compatible: Map merge/type/into changes were reviewed against current static plain-object Prisma config. Config merge/cycle compatibility tests, Prisma validate/generate, TypeScript build and live Prisma adapter/HTTP/concurrency tests passed. Future Map/deepmergeInto/custom config usage requires renewed review. mysql2 remains same major; PostgreSQL runtime does not use mysql2, but CLI dependency still present in audit omit=dev, so build/runtime exposure is not dismissed as dev-only. Dependency graph and reproducible lock are committed; zero current findings does not guarantee future advisories.
<!-- truonglt dependency patch disposition end -->
