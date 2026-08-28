# CSS & Styles

The file `css/style.css` is the shared stylesheet used across all Ionity web properties.

---

## Overview

The stylesheet is split into clearly labelled sections:

| Section | Description |
|---|---|
| CTA & Button Optimisations | Touch-friendly interactive elements |
| Cookie Consent Banner | Slide-in banner styles |
| Cookie Settings Modal | Full-screen settings overlay |
| Responsive Design | Breakpoints for mobile & tablet |
| Performance Optimisations | GPU acceleration, lazy loading |
| Mobile Slider & Carousel | Swipeable card sliders |
| Identity Modules | Fixed social-link buttons (bottom-right) |

---

## Embedding

```html
<link rel="stylesheet" href="https://raw.githubusercontent.com/Ionity-Global/ionity-assets-ionity-global-ionity-today/main-Ionity/css/style.css">
```

> **Note:** For production use it is recommended to self-host this file or serve it through a CDN with proper caching headers.

---

## Design Tokens

The stylesheet uses a consistent colour palette:

| Token | Value | Use |
|---|---|---|
| Primary Cyan | `#00d2ff` | Links, borders, highlights |
| Primary Cyan Dark | `#0099cc` | Button gradients |
| Background Dark | `rgba(0,0,0,0.98)` | Cookie banner background |
| Text Light | `rgba(255,255,255,0.95)` | Body text on dark bg |

---

## Key Components

### Buttons & CTAs

All buttons have a **minimum touch target of 48×48 px** for accessibility and mobile usability. iOS auto-zoom prevention is built in (`font-size: 16px`).

```html
<button class="cta-button">Get Started</button>
<button class="main-btn">Learn More</button>
```

### Cookie Banner

The cookie consent banner (`#cookie-banner`) slides in from the bottom. Trigger it by adding the `.show` class via JavaScript:

```js
document.getElementById('cookie-banner').classList.add('show');
```

Three button variants are provided:
- `.cookie-btn-accept` — Accept all (cyan gradient)
- `.cookie-btn-necessary` — Necessary only (transparent)
- `.cookie-btn-settings` — Open settings modal (outline)

### Cookie Settings Modal

Full modal (`#cookie-settings-modal`) with per-category toggle switches. Open it by adding `.show`:

```js
document.getElementById('cookie-settings-modal').classList.add('show');
```

### Card Slider / Carousel

Horizontal scroll carousel with snap points. Works on touch devices.

```html
<div class="carousel-wrapper">
  <div class="slider-viewport">
    <div class="slider-track">
      <div class="card">...</div>
      <div class="card">...</div>
    </div>
  </div>
  <button class="carousel-btn prev-btn">&#8249;</button>
  <button class="carousel-btn next-btn">&#8250;</button>
</div>
```

### Identity Modules (Social Links)

Fixed social-link widget, bottom-right corner. Fades in on hover.

```html
<div class="identity-modules">
  <a href="https://github.com/Ionity-Global" class="module-link">
    <img src="images/github-icon.svg" class="module-icon" alt="GitHub">
  </a>
  <a href="https://www.linkedin.com/..." class="module-link">
    <img src="images/linkedin-icon.svg" class="module-icon" alt="LinkedIn">
  </a>
</div>
```

---

## Responsive Breakpoints

| Breakpoint | Applies to |
|---|---|
| `max-width: 768px` | Mobile portrait — single column layout, centred text |
| `max-width: 480px` | Small phones — reduced padding, smaller buttons |
| `max-width: 896px` + `landscape` | Landscape mobile — row-direction social icons |
