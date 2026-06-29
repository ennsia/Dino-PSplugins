---
name: dino-ps-plugin-release
description: Build, organize, verify, commit, push, and remotely confirm Dino Photoshop plugin releases. Use when publishing or updating a Photoshop plugin on GitHub, replacing a broken release package, preparing reviewed CCX artifacts, preserving current plugin artifact naming, checking release checksums, diagnosing why changes are not on GitHub, or notifying the user after a verified push.
---

# Dino Photoshop Plugin Release

Run only the release steps that are actually needed. Do not announce success until the remote branch contains the intended local commit.

## Release Rules

- Name CCX files `Dino-<plugin-name>_<host>.ccx`.
- Publish source, a reviewed CCX, and the complete offline ZIP.
- Include relevant test notes and `SHA256SUMS.txt`.
- Keep reviewed artifacts under `releases/<plugin-name>/<version>/`.
- Keep generated working files under ignored `dist/`.
- Never stage unrelated dirty-worktree files.
- Never upload known broken or superseded packages.
- Block the release if source, docs, or text artifacts contain a private email username or a non-approved email address.
- Allow only the repository's configured GitHub `users.noreply.github.com` author address.
- Obey the repository-local safety rules and obtain confirmation before `git add`, `git commit`, or `git push`.

## Diagnose Before Publishing

1. Inspect `git status --short --branch`, `git log`, and `git remote -v`.
2. Separate these states:
   - untracked or modified files: not pushable until reviewed, staged, and committed;
   - local branch ahead of its upstream: a push may be needed;
   - local `HEAD` equals the upstream tracking ref: there is no local commit to push.
3. Do not run `git push` merely because files exist in the working tree.
4. If the intended release commit is already the upstream commit, report that it is already published and stop.
5. Use live `git fetch` or `git ls-remote` only when network access is available and remote freshness must be proven.

## Release Workflow

1. Read `manifest.json` and confirm plugin name, host, and version.
2. Review the working tree and identify the exact release file list.
3. Run repository tests and packaging.
4. Run `scripts/verify_release.sh <repo> <plugin> <version> <host>`.
5. Copy only reviewed deliverables into the versioned `releases/` directory.
6. Regenerate and verify `SHA256SUMS.txt`.
7. Inspect `git diff --check`, staged diff, untracked files, and sensitive-content risks. Search for private email usernames and email address patterns before staging.
8. Show the exact staging list and commit message; wait for user confirmation.
9. Stage only confirmed release files and commit.
10. Recheck `git status --short --branch`.
11. If `HEAD` is not ahead of upstream, do not push.
12. Show the branch and commit to be pushed; wait for user confirmation.
13. Fetch once before pushing when network access permits. If the remote moved, stop and report before integrating.
14. Before the real push, run a read-only connectivity check such as `git -c http.version=HTTP/1.1 ls-remote origin HEAD`, then `git -c http.version=HTTP/1.1 push --dry-run origin <branch>`.
15. If the connectivity check and dry run pass, push once with `git -c http.version=HTTP/1.1 push origin <branch>`.
16. Verify:
    - `git rev-parse HEAD`
    - `git ls-remote origin refs/heads/<branch>`
    - hashes must match exactly.
17. Only after the hashes match, run `scripts/notify_success.sh "<plugin> <version>"`.
18. Report the commit hash, branch, remote URL, and release artifact paths.

## Failure Handling

- If tests, packaging, checksums, commit, push, or remote verification fail, do not notify success.
- If GitHub connectivity is flaky, first try one narrow read-only probe and one `git push --dry-run`; if both pass, proceed to the real push once.
- If the read-only probe or dry run fails with network/DNS/TLS timeout symptoms such as `curl 56`, `Operation timed out`, or `Couldn't connect to server`, stop and give the user one ready-to-run manual command, normally `git -c http.version=HTTP/1.1 push origin <branch>`.
- If the same command or failure occurs twice, stop and report the blocker; do not loop.
- If authentication fails, preserve the local commit and report the exact next required action.
- Never ask the user to send a password, token, or verification code. Ask them to run `gh auth login` manually when GitHub authentication is needed.
- If GitHub CLI is unavailable, use standard Git; releases tracked in the repository do not require `gh`.
- Do not use force push unless the user explicitly requests it.
