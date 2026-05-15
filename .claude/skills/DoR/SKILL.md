# Definition of Ready (DoR) Skill

Purpose
- Provide a checklist to validate that a task is ready for an AI agent to act on. Ensures scope, acceptance criteria, constraints, and relevant files are included.

Behavior
- When invoked, prompt the user (or run automatically) to fill: objective, scope, non-scope, constraints, relevant files, acceptance criteria, links to issue/PR.
- Output a short, structured specification suitable to feed into `/plan` or an implementation agent.

Constraints
- Read-only; do not change code.

Output
- JSON-like block with fields: objective, scope, nonScope, constraints, files, acceptanceCriteria, references.
