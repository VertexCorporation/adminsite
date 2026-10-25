# Chefs biographies — rollout status

The console supports biographies for all 16 vertexite routes:
`ar az de en es fr hi id it ja ko nl pt ru tr zh`.
Names, links and position codes stay shared. The editor stores `biographies`
plus `bioSourceLang`, with `bio` mirroring the source text for legacy clients.
Untagged legacy biographies require an explicit language assignment before
localized editing. Existing translations are retained by default; the user
must opt in to replacing them. Translation results remain drafts until Save.

## Implemented backend

Fulcrum PR #90 implements the matching card-manager persistence, localized
public reads, and the `translateTeamBiography` callable using official Google
Cloud Translation v3 and server application-default credentials.

The callable applies the same current Core gate as chef-card edits, a
transactional five-operation-per-user-per-minute limit, validated 6000-unit
source text and 1–15 target languages, at most four concurrent Google requests,
and a shared 15-second provider deadline. Successful partial results are
returned; failed or oversized outputs leave draft fields untouched. It never
publishes or saves a biography and never sends Google credentials to browsers.

19 backend tests pass locally, including all 16 languages through real managed
save/read functions, intentional clearing, legacy-client preservation, Core
rejection, input bounds, rate limits, provider failure/partial results,
plaintext requests, token reuse, Chinese mapping and bounded concurrency.

## Pending live rollout

The connected Chrome approval session failed while accessing Cloud Shell.
No backend functions or frontend changes have been deployed yet. Live Google
API activation, service-account permission, preserved deployment settings and
an authenticated live translation remain unverified. Keep both frontend PRs
draft until the backend rollout and live verification finish.

Follow `docs/CHEF-BIOGRAPHIES.md` in Fulcrum PR #90 for direct terminal steps.
The limited manifest selects only `listSiteTeam`, `setSiteTeamEntry` and
`translateTeamBiography`; it requires no GitHub Actions. Commits in this
continuation include `[skip ci]` to avoid Actions usage.

Companion PRs:

- https://github.com/VertexCorporation/Fulcrum/pull/90
- https://github.com/VertexCorporation/adminsite/pull/58
- https://github.com/VertexCorporation/vertexite/pull/17

After backend deploy, verify the full console translation → review → save →
localized homepage/profile path, then release the frontends using their direct
publishing path. The existing immutable console snapshot already contains the
new editor; no extra Actions snapshot job is needed for this branch.
