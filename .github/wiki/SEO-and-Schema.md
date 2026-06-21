# SEO & Schema

This repository includes structured data and SEO resources for Ionity's web properties.

---

## Schema.org JSON-LD

**File:** `seo/schema-organization.jsonld`

The file contains a `@graph` with three nodes:

| Type | Name | Description |
|---|---|---|
| `Organization` | Ionity Global (Pty) Ltd | Company entity with logo, contact, and sameAs links |
| `Person` | Johan Wilhelm van Antwerp | Founder / author with ORCID identifier |
| `WebSite` | Ionity World | Website entity linked to the organisation |

### Embedding in HTML

Place the contents inside a `<script>` tag in the `<head>` of each page:

```html
<head>
  <!-- ... -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Ionity Global (Pty) Ltd",
        "alternateName": ["Ionity (Pty) Ltd", "Antwerp Designs"],
        "url": "https://www.ionity.world/",
        "logo": "https://www.ionity.world/assets/logo/ionity-logo.png",
        "email": "ai@ionity.today",
        "telephone": "+27 6464999877",
        "founder": {
          "@type": "Person",
          "name": "Johan Wilhelm van Antwerp"
        },
        "sameAs": [
          "https://www.ionity.world/",
          "https://www.ionity.today/"
        ]
      },
      {
        "@type": "Person",
        "name": "Johan Wilhelm van Antwerp",
        "alternateName": "AntwerpDesignsIonity",
        "identifier": "9003135105083",
        "email": "johan@antwerpdesigns.com",
        "url": "https://www.ionity.world/",
        "sameAs": [
          "https://orcid.org/0009-0005-7181-0347"
        ]
      },
      {
        "@type": "WebSite",
        "name": "Ionity World",
        "url": "https://www.ionity.world/",
        "publisher": {
          "@type": "Organization",
          "name": "Ionity Global (Pty) Ltd"
        }
      }
    ]
  }
  </script>
</head>
```

---

## Recommended Meta Tags

Add these to the `<head>` of every Ionity page:

```html
<!-- Basic SEO -->
<meta name="author" content="Johan Wilhelm van Antwerp">
<meta name="robots" content="index, follow">

<!-- Open Graph / Social Cards -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ionity Global">
<meta property="og:image" content="https://raw.githubusercontent.com/Ionity-Global/ionity-assets-ionity-global-ionity-today/main-Ionity/images/ionity-social-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://raw.githubusercontent.com/Ionity-Global/ionity-assets-ionity-global-ionity-today/main-Ionity/images/ionity-social-card.png">
```

---

## Favicon Setup

```html
<link rel="icon" href="/favicon/ionity_logo.ico" type="image/x-icon">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
```

Example `manifest.json` entries:

```json
{
  "name": "Ionity Global",
  "short_name": "Ionity",
  "icons": [
    { "src": "/images/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#00d2ff",
  "background_color": "#000000",
  "display": "standalone"
}
```

---

## Validation Tools

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [Open Graph Debugger (Facebook)](https://developers.facebook.com/tools/debug/)
