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
