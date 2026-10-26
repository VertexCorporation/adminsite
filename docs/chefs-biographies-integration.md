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

## Direct rollout

Cloud Shell verified a successful Google Translation v3 request under the
existing runtime service account. `listSiteTeam` and `setSiteTeamEntry` were
deployed directly; the write function's environment and service account were
preserved. All three callables use the existing `europe-west1` region. The new translation
service started successfully with fractional CPU and startup CPU boost disabled
to fit the nearly exhausted regional quota. Auth, App Check and callable errors
remain under the Firebase SDK.

Follow `docs/CHEF-BIOGRAPHIES.md` in Fulcrum PR #90 for direct terminal steps.
The limited manifest selects only `listSiteTeam`, `setSiteTeamEntry` and
`translateTeamBiography`. No GitHub Actions are needed. Use `[skip actions]`
on production frontend merge commits so GitHub workflows stay skipped while
the existing Cloudflare Pages integration publishes the static files.

Companion PRs:

- https://github.com/VertexCorporation/Fulcrum/pull/90
- https://github.com/VertexCorporation/adminsite/pull/58
- https://github.com/VertexCorporation/vertexite/pull/17

After backend deploy, verify the full console translation → review → save →
localized homepage/profile path, then release the frontends using their direct
publishing path. The existing immutable console snapshot already contains the
new editor; no extra Actions snapshot job is needed for this branch.

## Translation client deadline repair (2026-10-26)

The translation callable now has a dedicated 60-second client deadline. The
server's existing 20-second execution deadline, provider deadline and quotas
are unchanged. The previous equal 20-second client/server deadlines left no
room for cold startup or queueing. Live Cloud Run logs showed roughly ten
seconds of cold startup; an authenticated retry in the existing console draft
returned all 15 translations. The earlier error code was not retained, so its
exact cause cannot be proven retrospectively. Callable diagnostics now include
the safe Firebase error code, with no request text or credentials. Translation
remains non-retried to avoid duplicate quota consumption. Eleven focused
transport tests, syntax checks and all 79 immutable asset checks pass. The
broader suite passes 175 checks; four fixture-dependent files require a sibling
Fulcrum checkout and could not run in this isolated frontend checkout.
