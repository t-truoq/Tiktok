<!-- truonglt runtime security trust model start -->
# Runtime security boundary

Verified JWT supplies subject; public.users supplies ADMIN/EDITOR/VIEWER. Trusted backend sets app.auth_subject and app.actor_id with transaction-local set_config after verification. Request body actor fields are rejected. Parameterized SQL, strict DTOs, no arbitrary query endpoint, dedicated connection and transaction boundaries prevent normal HTTP callers from setting database identity; pooled context isolation is live-tested.

Custom GUC is NOT database authentication. A holder of runtime database credentials or an arbitrary SQL execution capability can spoof these context values. RLS protects against absent/wrong context and accidental privilege misuse; it does not cryptographically bind a JWT at PostgreSQL. Prevent SQL injection and restrict credentials/server access. No SECURITY DEFINER escalation helpers are used; helpers are SECURITY INVOKER with fixed search_path. Runtime has no auth schema grants or JWT-secret access.

This is a shared workspace: provisioned ADMIN/EDITOR/VIEWER can read business data; users row lookup is restricted to verified subject. There is no tenant isolation claim. SELECT USING(true) from historical preview was replaced by database-backed authorization on all business policies. Source archives expose metadata columns only. Writes require ADMIN/EDITOR; append-only events/snapshots require context actor and cannot rewrite imported history. Runtime cannot create products, alter identity/classification, write source legacy/archives/users or DELETE/TRUNCATE. Sequence grants are unnecessary for UUID IDs.

NOLOGIN access role carries grants; LOGIN runtime INHERITs them but cannot SET ROLE access or owner and is not a member of service_role. Runtime initializer independently inspects unsafe attributes, ownership and role access. Migration/readonly health owner connection remains separate from business CRUD.

Evidence: SECURITY_PREFLIGHT.json, SECURITY_MIGRATION_RESULT.json, RLS_LIVE_RESULT.json (21 checks), REAL_ACTOR_E2E_RESULT.json (real ADMIN11), CONCURRENCY_LIVE_RESULT.json (3), PRODUCTION_REPOSITORY_RESULT.json. Historical status labels in individual files refer to that test's own scope; final cross-test status is VERIFICATION_SUMMARY.json. Public Business API remains disabled.
<!-- truonglt runtime security trust model end -->
