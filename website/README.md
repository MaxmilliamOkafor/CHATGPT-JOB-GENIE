# Lovable website and backend snapshot

Imported from the user-supplied `src (2).zip`. All 201 supplied files in `src/`, `supabase/` and `tests/` are preserved byte-for-byte. This project is separate from the browser extension at the repository root.

Included: React website source, Supabase edge functions and migrations, shared evidence/coverage/skills-placement modules, and supplied tests.

Still missing: `package.json`, a lockfile, root HTML entry, TypeScript/Vite configuration and public assets. The website is not yet a reproducibly buildable release. Supply the remaining project-root files before dependency installation and full build validation; do not guess dependency versions.

Some supplied CommonJS tests refer to extension files using root-relative assumptions. Those original tests are retained as supplied; the maintained extension tests remain in the repository-root `tests/` directory. The website test runner/configuration was not supplied.

The browser client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the build environment. Backend functions read their runtime secrets from the environment. No backend functions, database migrations or website deployment were run during this import.
