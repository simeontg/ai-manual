## GitHub MCP integration checklist

This document describes how to connect an approved MCP server for GitHub to provide issue/task context inside AI clients that support the Model Context Protocol (MCP).

IMPORTANT: follow project policies — use only approved integrations and request explicit permission before granting write access or installing apps.

1) Goals
- Provide read access to repository issues, PRs, and discussions so agents can find tasks and context.
- Optionally allow read-only listing and lookups from the IDE without navigating to GitHub.

2) Recommended scopes (start read-only)
- repo:status (optional)
- repo:invite (optional)
- read:org (if org-level visibility needed)
- read:user
- public_repo or repo (if private repos need read access)
- issues: read-only (via app or token)

3) Options to connect
- GitHub App (recommended for organizations): install an app that exposes MCP server endpoints or supports remote access via the AI client.
- Personal Access Token (PAT): use only for personal or dev use, and prefer tokens with minimal scopes.
- Official MCP server: if your AI client provides an official GitHub MCP integration, prefer that.

4) Example MCP config (client-side)
```json
{
  "mcpServers": [
    {
      "name": "github-mcp",
      "url": "https://mcp.github.com/",
      "type": "github",
      "auth": "oauth",
      "scopes": ["repo", "read:org", "read:user", "issues"]
    }
  ]
}
```

5) Approval & security checklist
- Confirm owner approval for installing apps or granting organization read access.
- Prefer read-only scopes and never store long-lived tokens in repo files.
- Use environment variables or secret stores for tokens.

6) Developer workflow tips
- After adding MCP server, test by asking the AI client to list open issues or fetch a specific issue by number.
- If you need richer context (PR diffs, CI runs), request scoped access and review security implications.

7) Next steps for Gather repo
- Confirm whether GitHub is the approved tracker for this project.
- If yes, decide whether to use: GitHub App, official MCP server from your AI client, or PAT for local dev.
- I can prepare a minimal MCP config file for your AI client once you confirm the preferred option.
