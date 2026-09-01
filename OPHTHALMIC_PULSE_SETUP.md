# Ophthalmic Pulse automation

The GitHub Pages deployment refreshes the Ophthalmic Pulse feed and generates one citation-first infographic every day. The generated item is validated before it is written to `daily/latest.json`, the daily archive, and the public library.

## Optional LinkedIn organization feed

Without credentials, the portal uses safe LinkedIn community-page and live topic links. It does not scrape LinkedIn.

To retrieve recent posts through LinkedIn's official API, add these GitHub repository secrets:

- `LINKEDIN_ACCESS_TOKEN`: token from an approved LinkedIn application with `r_organization_social` access.
- `LINKEDIN_ORGANIZATION_URNS`: comma-separated organizations that the authenticated member is authorized to administer, for example `urn:li:organization:12345,urn:li:organization:67890`.
- `LINKEDIN_VERSION` (optional): six-digit API version such as `202608`.

LinkedIn only permits organization post retrieval for approved applications and authorized page roles. Personal profiles and credentials are never collected by this project.

## Optional upload to another server

The validated daily JSON is always uploaded to GitHub Pages by the deployment job. To mirror it to another running instance of `server.js`, add:

- `DAILY_UPLOAD_URL`: full HTTPS endpoint, normally `https://your-host.example/api/daily-infographic`.
- `DAILY_UPLOAD_TOKEN`: bearer token matching `OPHTHALMIC_UPLOAD_TOKEN` on that server.

If these secrets are absent, the external upload step is safely skipped. The local Node server accepts daily uploads from loopback only unless `OPHTHALMIC_UPLOAD_TOKEN` is configured.

## Institutional article access

The article portal checks trusted open-access locations first. Paid content opens through the user's own EKB, OpenAthens, or publisher session. It never proxies credentials, fabricates entitlement, or bypasses a paywall.
