# Verify (composite action)

Installs dependencies and runs typecheck, lint, and tests for the theme-studio app. Used by [`ci.yml`](../../workflows/ci.yml) and [`deploy-pages.yml`](../../workflows/deploy-pages.yml) so the same checks can't drift between the two workflows.

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `node-version` | no | `24` | Node.js version to set up. |
| `working-directory` | no | `theme-studio` | Directory containing `package.json`, relative to the repo root. |

## Outputs

None.

## Permissions

None — this action only reads the checked-out workspace and runs local npm scripts. It doesn't touch the GitHub API and needs no `GITHUB_TOKEN` permissions of its own.

## Example

```yaml
- uses: actions/checkout@v4
- uses: ./.github/actions/verify
  with:
    node-version: '24'
    working-directory: theme-studio
```

## Failure modes

- Fails if `npm ci` can't install (lockfile out of sync with `package.json`).
- Fails on any TypeScript error (`tsc -b`), lint error (`oxlint`), or failing test (`vitest`).
- Requires the caller to check out the repo first (`actions/checkout`) — this action does not do that itself.
