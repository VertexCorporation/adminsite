# Console architecture

The current architecture, ownership boundaries, report schema integration,
localization rules, reproducible build and test strategy are documented in
[Console architecture and deployment](console-architecture-v2.md).

The Console uses native ES modules and Vertex's existing Firebase/Fulcrum
backend. HTML fragments compose the Console at startup; feature controllers,
services and session-scoped stores own behavior and data. Shared UI surfaces
and styles have separate owners. Production source files may not exceed 700
lines; `npm run check:architecture` enforces that limit.

Reports are native Console views. Deploy the matching Fulcrum report backend
before this frontend. Historical release snapshots are removed from Git;
`npm run build` creates the disposable `dist/` deployment directory.
