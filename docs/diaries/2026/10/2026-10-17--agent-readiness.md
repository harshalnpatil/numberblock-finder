# Agent readiness: explicit local type verification

## Finding and change

The existing build script bundles with Vite without checking TypeScript. Added `typecheck` using the repository's existing TypeScript dependency and configuration. Documented it separately from the build; no dependency declarations or deployment configuration changed.

This is a 2-way door: the command and documentation are reversible. It exposes existing diagnostics instead of relaxing compiler settings to hide them.

## Verification

`npm run typecheck` passed. A type check does not establish browser or live-service behavior.
