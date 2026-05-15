## GitHub Copilot MCP (local dev) — template & instructions

This guide helps you configure a local, read-only MCP connection for GitHub Copilot when working on the Gather repo in local development.

1) Recommended approach for local dev
- Use a short-lived Personal Access Token (PAT) with minimal scopes (read-only). Keep the token out of the repo and store it in your local OS secret store or your IDE's secret manager.

2) Minimum scopes for local read-only access
- repo (if repository is private) or public_repo (if public)
- read:user
- read:org (optional)

3) Example local MCP configuration (add to your Copilot / MCP config)
```json
{
  "mcpServers": [
    {
      "name": "github-copilot-local",
      "url": "https://api.github.com/",
      "type": "github",
      "auth": "pat",
      "tokenEnvVar": "GITHUB_MCP_PAT",
      "scopes": ["repo", "read:user"]
    }
  ]
}
```

4) Storing the PAT locally (example for PowerShell)
```powershell
$env:GITHUB_MCP_PAT = "ghp_xxx..."
# Or store in Windows Credential Manager and reference via your IDE's secret vault.
```

5) Testing
- After configuring the MCP connection in Copilot, ask the IDE/agent to list recent issues or fetch an issue by number.

6) Notes & security
- Do not commit PATs to the repo. Prefer very short-lived PATs if possible.
- For organization-level or team-wide access, install a GitHub App instead and agree org approvals.
