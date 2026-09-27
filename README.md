# educk-academic-portal

> academic bounded context: web UI (remote)

Part of the **LMS Library** distributed system — team `lms-library`, Grupo 2.
Governance and documentation live in [`library-docs`](https://github.com/code-corhuila/library-docs).

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `library-docs`.

## Academic API connection

Copy `.env.example` to a local `.env` file and set `VITE_ACADEMIC_API_URL` to the Academic API
Gateway route. Real `.env` files and access tokens must never be committed.

The portal requests `GET /grades/student/{studentId}` every 30 seconds and forwards the optional
`edutrack_token` as a Bearer token. `adaptGradesFromApi(rawResponse)` isolates the UI from the
transport contract. The backend must eventually enrich each grade with `subjectName`,
`activityTitle`, and `weight`; the current assignment metadata remains a temporary fallback.

```bash
npm test
npm run build
```
