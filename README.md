# ionity-assets-ionity-global-ionity-today

Assets and deployment support files for **Ionity (Pty) Ltd** and **Ionity Global** web properties.

## What this repository contains

- Brand and media assets (images, icons, video, CSS/JS helpers)
- SEO deployment bundle under [`seo/`](./seo)
- Machine-readable link registries (`ionity-links.json`, `.yml`, `.txt`)
- Nobify project and synced Wiki source under [`nobify/`](./nobify)

## SEO files

The `seo/` folder is additive and intended for controlled deployment to the live site:

- `llms.txt`
- `humans.txt`
- `robots.additions.txt`
- `sitemap-ionity-2026.xml`
- `jsonld-head-snippet.html`
- `security.txt`
- `622fd5e537fe7d53698c05fe810d8685.txt` (IndexNow key file)

See deployment notes: [`seo/README-seo-deploy.txt`](./seo/README-seo-deploy.txt).

## Wiki source (Nobify)

Nobify documentation source lives in [`nobify/wiki/`](./nobify/wiki) and is published by:

- [`.github/workflows/nobify-wiki.yml`](./.github/workflows/nobify-wiki.yml)

## Notes

- This is an assets-focused repository; many files are static.
- Keep SEO and Wiki changes additive and backwards-compatible with live content.
