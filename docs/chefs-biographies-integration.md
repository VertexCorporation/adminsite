# Chefs biographies — backend integration required before release

The frontend branch is a draft. Do not merge/deploy it before implementing and
deploying the following Fulcrum changes. Access to Fulcrum was blocked by the
automatic approval reviewer during this task; no backend implementation or live
Google Translation request has been verified.

## Language contract

The 16 routes in vertexite are `ar az de en es fr hi id it ja ko nl pt ru tr zh`.
Keep names, links and position codes shared. Only biographies are localized.

Extend `setSiteTeamEntry({kind: 'card', ...})` and the managed `listSiteTeam`
response with `biographies: Record<language, string>` and `bioSourceLang`.
Validate the language allowlist, source language, string values and 6000 UTF-16
code-unit limit per value. The editor submits all 16 keys, including empty
strings for intentional clearing; replace the biography map rather than merging
it in a way that resurrects cleared translations. Legacy callers that omit the
map must preserve existing localized biographies. Keep the legacy `bio` field
equal to the chosen source text on new saves. Preserve existing identity,
photos, titles, links, uniqueness checks and permissions.

Return the biography map and source language in public cards, or resolve `bio`
for the requested language on the server. Both public rendering surfaces in
vertexite now resolve the map with fallback to source, legacy bio, English and
Turkish. Invalidate every language's public team cache after a change.

## Translation callable

Add authenticated `translateTeamBiography`, guarded by the **same permission
check as editing chef cards**, with the standard App Check/CORS behavior.

Request:

```json
{"text":"Source biography", "sourceLang":"en", "targetLangs":["tr","de"]}
```

Response (Firebase callable `data`):

```json
{"translations":{"tr":"Kaynak biyografi","de":"Quellbiografie"}}
```

Validate nonempty source text (maximum 6000 code units), supported source and
1–15 unique supported targets excluding source. Do not accept arbitrary URLs,
provider options or identity fields from the client. Return only successful
translations in partial responses. A total provider failure should throw an
appropriate callable error; never report source text as a translated success.
Do not persist or publish translations here. The editor applies results to
unchanged drafts and the user explicitly saves the card afterwards.

Use official Google Cloud Translation server-side, with service-account
credentials or an existing secret. No credentials belong in this public repo
or in the browser. Enable the API and verify access in the actual project.
Use plain-text input (`format: text` for Basic or `mimeType: text/plain` for
Advanced), map `zh` to the provider's appropriate Simplified Chinese code,
preserve paragraph breaks and split text if necessary for provider limits.
Bound concurrency, request duration and per-user request frequency. Do not log
biography text or credentials. A browser operation currently times out after
20 seconds; choose backend timeouts accordingly or deliberately adjust the
callable timeout for this operation only.

References:

- https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate
- https://docs.cloud.google.com/translate/docs/translate-text

## Release verification

Test authorization rejection, input limits, provider success/failure, partial
results, all 16 language saves/reads, intentional clearing, legacy clients,
and invalidation of all public language caches. Confirm saved biographies
appear on both localized homepage cards and profile pages. Run the local
editor behavior test with `node tests/team-biographies-browser.cjs` and the
public-site contract tests with `npm run test:team` in vertexite.

Only after these checks and backend deployment should the two frontend drafts
be merged. Generate the console's immutable snapshot with
`node scripts/release.cjs` and verify it with `npm run verify:release`.
