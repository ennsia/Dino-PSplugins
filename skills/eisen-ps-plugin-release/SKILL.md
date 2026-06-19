---
name: eisen-ps-plugin-release
description: Build, organize, verify, commit, push, and remotely confirm Eisen Photoshop plugin releases. Use when publishing or updating a Photoshop plugin on GitHub, replacing a broken release package, preparing CCX and offline ZIP artifacts, enforcing Eisen artifact naming, checking release checksums, or notifying the user after a verified push.
---

# Eisen Photoshop Plugin Release

Run the complete release chain. Do not announce success until the remote branch contains the local commit.

## Release Rules

- Name CCX files `Eisen-<plugin-name>_<host>.ccx`.
- Ship both CCX and a complete offline ZIP.
- Include Chinese install/test notes and `SHA256SUMS.txt`.
- Keep reviewed artifacts under `releases/<plugin-name>/<version>/`.
- Keep generated working files under ignored `dist/`.
- Never stage unrelated dirty-worktree files.
- Never upload known broken or superseded packages.

## Workflow

1. Read `manifest.json` and confirm plugin name, host, and version.
2. Review `git status`, branch, remote, and recent commits.
3. Run the repository tests and package command.
4. Run `scripts/verify_release.sh <repo> <plugin> <version> <host>`.
5. Copy only reviewed deliverables from `dist/` into the versioned `releases/` directory.
6. Regenerate and verify `SHA256SUMS.txt`.
7. Inspect `git diff --check`, staged diff, and untracked files.
8. Stage only files belonging to the release and its reusable build/test pipeline.
9. Commit with a concise release-oriented message.
10. Fetch before pushing. If the remote moved, integrate without destroying local or user changes.
11. Push the current branch.
12. Verify:
    - `git rev-parse HEAD`
    - `git ls-remote origin refs/heads/<branch>`
    - hashes must match exactly.
13. Only after the hashes match, run `scripts/notify_success.sh "<plugin> <version>"`.
14. Report the commit hash, branch, remote URL, and release artifact paths.

## Failure Handling

- If tests, packaging, checksums, commit, push, or remote verification fail, do not notify success.
- If network access is restricted, request the narrow Git escalation and retry.
- If authentication fails, preserve the local commit and report the exact next required action.
- If GitHub CLI is unavailable, use standard Git; releases tracked in the repository do not require `gh`.
- Do not use force push unless the user explicitly requests it.
