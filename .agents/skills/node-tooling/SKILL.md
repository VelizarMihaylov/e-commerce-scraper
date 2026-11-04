---
name: node-tooling
description: Select the scraper repository's pinned Node.js and pnpm versions when installing dependencies or running development and verification commands.
---

# Node and pnpm

- Run commands from the scraper repository root. Read `.nvmrc` and the `packageManager` field in `package.json`; do not duplicate their versions in this skill.
- Verify `node --version` and `pnpm --version` before installing or checking code. Use the repository's pnpm lockfile rather than introducing npm or Yarn lockfiles.
- If nvm is not loaded in the shell, use the following setup from the repository root:

  ```bash
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use
  ```

- A non-interactive shell may have a different PATH from the user's terminal. Check installed tools before proposing installation; do not infer the machine's hardware from a tool's runtime architecture.
- Use `pnpm install --frozen-lockfile` for an unchanged checkout. For requested dependency changes, update the manifest and lockfile together using the pinned pnpm version.
- Use scripts in `package.json`. Run focused checks while iterating and `pnpm check` for a completed code/tooling change. Documentation-only changes normally need formatting and link checks.
- Report failed or unavailable checks accurately. A missing tool or sandbox restriction does not by itself justify changing system tooling.
