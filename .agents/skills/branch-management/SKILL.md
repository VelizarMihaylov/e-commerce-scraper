---
name: branch-management
description: Instructions and naming conventions for creating or switching Git branches for GitHub issues in this project.
---

# Branch Naming Strategy

Whenever you create a new git branch for this project, you **MUST** follow this exact naming convention:
`<ISSUE_ID>/<type>/<description>`

### Components

1. **`ISSUE_ID`**: The GitHub repository issue number prefixed with `GH-` (e.g., `GH-1`, `GH-35`). If the user does not provide it, search for the relevant issue in `VelizarMihaylov/e-commerce-scraper`. This is a branch naming convention: `GH-1` refers to issue `#1`, not the project number or a project item ID. If no matching issue exists, clarify the issue association rather than inventing a number.
2. **`type`**: The category of the work being done. Common types include:
   - `feature`
   - `devops`
   - `refactor`
   - `bugfix`
   - `docs`
3. **`description`**: A short, lowercase, kebab-case summary of the task or ticket title.

### Examples

- `GH-1/devops/scaffold-cli`
- `GH-35/refactor/product-parser`

### Rules

- Do NOT use standard git branch naming like `username/issue-description` or add an agent-name prefix.
- If you are asked to switch to a branch for an existing ticket, always format it this way, or check the existing branches (`git branch -a`) to see if it was already created.

### Creating linked branches

For new branches in the GitHub ticket-delivery workflow, use `gh issue develop` to create the branch and associate it with the issue's Development section. This creates a remote branch, so use it when GitHub publication is within the requested scope.

1. Check existing local/remote branches, linked branches (`gh issue develop <number> --repo VelizarMihaylov/e-commerce-scraper --list`) and related PRs. Reuse existing work rather than creating another branch.
2. Choose the intended remote base branch and always pass `--name` with the naming convention above. Do not accept GitHub's automatically generated name.
3. Create and check out the linked branch. For example, for issue #4 based on `main`:

   ```bash
   gh issue develop 4 \
     --repo VelizarMihaylov/e-commerce-scraper \
     --base main \
     --name GH-4/feature/catalogue-traversal \
     --checkout
   ```

4. Verify the checked-out branch and the issue's linked-branch association before implementation. Once a PR is opened, GitHub replaces the displayed branch association with the PR link; verify the PR-to-issue link at that point.

Do not delete or recreate an existing branch merely to add this association. Branch naming alone does not create a native GitHub issue link. Continue to link the PR to its issue using the repository workflow.
