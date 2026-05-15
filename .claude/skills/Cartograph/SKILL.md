# Cartograph Skill

Purpose
- Create and keep `docs/CODEBASE_MAP.md` up-to-date by scanning repository files and configuration.

Behavior
- Read top-level configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, `.env` if present) and source layout under `src/` and `supabase/`.
- Produce a one-page Markdown summary describing architecture, key entry points, important files, and quick run instructions.

Constraints
- Use only repository-local files. Do not call external services.
- Do not modify source code files.

Output
- Overwrite `docs/CODEBASE_MAP.md` with the generated summary.
