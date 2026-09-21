# Takedown runbook

This portfolio shows official app icons, logos and a few other third-party assets referentially (plans/shared/11-assets.md).
Every one of them has an original replacement that is built and tested on every change, so removing third-party artwork
is a configuration change, not a code change.

## If a rights holder asks for removal

1. In Vercel → Project → Settings → Environment Variables, set `NEXT_PUBLIC_ASSET_MODE=original` for **Production**.
2. Redeploy the latest production deployment (Deployments → ⋯ → Redeploy).
3. Verify: open the site and one OS; no request should go to `/assets/official/` (the `asset-original` test project asserts
   this on every pull request).
4. Reply to the rights holder confirming removal, with the deployment URL and time.

Nothing else is required: the original icon set, wallpapers, device frames, wordmark and synthesized audio render
everywhere in `original` mode with identical layout.

## Removing a single asset instead

Delete its file from `assets-inbox/`, run `npm run assets:ingest`, commit, and deploy. The manifest falls back to the
original artwork for that one asset only.

## Contact

Rights requests reach the owner at the email address shown in every OS's Settings → Legal and on `/plain`.
