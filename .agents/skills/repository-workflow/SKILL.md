---
name: repository-workflow
description: Manage scraper GitHub issues and project status, and deliver requested repository changes through focused branches, commits and pull requests.
---

# Repository workflow

## Destination and scope

- Repository: `VelizarMihaylov/e-commerce-scraper`.
- Project: https://github.com/users/VelizarMihaylov/projects/2.
- Use this repository’s GitHub issues and project board to track the assessment.
- Ticket creation, implementation and publication are distinct scopes. Follow the work the user requested; a request to create a ticket does not authorize implementing it or publishing local code.

## Issues and branches

1. Inspect the relevant issue and existing work before creating duplicates. Write the problem, scope, rationale and observable acceptance criteria. Acknowledge existing drafts rather than presenting them as new work.
2. Before Git operations, inspect `git status`, the repository root and remotes. If the scaffold has no Git repository yet, initialize it only as part of requested repository setup; never run Git mutations in a parent or neighbouring repository by mistake.
3. Read and follow the [Branch Management skill](../branch-management/SKILL.md). Reuse a suitable existing branch or create one using its issue-based naming convention.
4. Move the project item to `In Progress` when issue implementation begins. Fetch current project fields and option IDs before updates; do not hardcode API IDs.

## Verification and delivery

- Follow the local code/testing guidance and review the diff for scope and unintended files. Stage only the intended paths.
- When committing is requested, use a focused message such as `chore: scaffold TypeScript CLI (#1)`. Include the lockfile for dependency changes; exclude generated output, scraped results and credentials.
- When publication is requested, push the prepared branch and open a PR against the repository's actual default branch. Use any existing PR template and describe behaviour, rationale, verification and remaining limitations.
- Use `Closes #<number>` only when the PR completes the issue; use `Refs #<number>` for partial work. Verify the published branch and PR before reporting success.
- Use available GitHub tools for supported operations. GitHub CLI can manage this project; verify the active account/access and always specify the intended repository or project owner. Do not expose authentication tokens.
- Opening a PR does not mean the issue is done. Keep it in progress until merged and the acceptance criteria are satisfied, or the user explicitly directs another status. Verify the board state rather than assuming automation updated it.
- Do not continue into additional tickets or merge work unless that is within the user's request.
