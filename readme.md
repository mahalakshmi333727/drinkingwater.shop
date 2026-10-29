# drinkingwater.shop

Interactive, static website for **commercial drinking water purification and treatment**
(hospitals, hotels, industries, offices and other large facilities). It follows water
from source to glass through a Three.js scene, seven clickable landscape hotspots and
twelve content chapters.

The site is plain HTML, CSS and JavaScript (ES modules). There is no build step, package
manager or backend.

## Site structure

`index.html` is the only content page. Home, About, Services, Products, Technology,
Solutions and Contact are sections of that page (`#hero`, `#purification`, `#laboratory`,
`#quality`, `#storage`, `#handling`, `#footer`), so they share one URL.

```
drinkingwater-shop/
├── index.html               main page: content, SEO metadata, JSON-LD
├── cookiepolicy.html        cookie / browser-storage policy
├── 403.html                 Forbidden error page (not indexed)
├── 404.html                 Not Found error page (not indexed)
├── .htaccess                Apache: HTTPS + host redirects, error pages, MIME, compression, caching
├── robots.txt               crawl rules + sitemap locations
├── sitemap.xml              page sitemap
├── sitemap.images.xml       image sitemap
├── SEO-KEYWORD-PLAN.md      older keyword ideas (superseded by seo-keywords.md)
├── seo-keywords.md          the 100 SEO keywords (planning reference, not published copy)
├── favicon.ico              16/32/48 px multi-size icon
├── favicon-16x16.png        browser tab icon
├── favicon-32x32.png        browser tab icon
├── apple-touch-icon.png     180x180 iOS home-screen icon (opaque)
├── android-chrome-192x192.png / android-chrome-512x512.png   manifest icons
├── site.webmanifest         web app manifest (icons, name, theme colour)
├── README.md                this file
└── assets/
    ├── css/                 base, layout, components, sections, icon-scene, about, responsive
    ├── js/
    │   ├── main.js          entry point
    │   ├── modules/         UI modules (navigation, controls, audio, panels, labs, ...)
    │   └── three/           Three.js scene (environment, water, chambers, pipes, particles, ...)
    ├── models/              water_treatment_plant.glb, massif_du_devoluy.glb (optimised, see "Landscape loading")
    ├── media/               waterfall-and-birds-sounds.wav (ambient sound, opt-in)
    └── images/              og-drinkingwater-shop.png (social sharing card)
```

## Running locally

ES modules and an import map need a web server, not `file://`:

```bash
cd drinkingwater-shop
python3 -m http.server 5173
# open http://localhost:5173
```

GSAP and ScrollTrigger load from cdnjs and Three.js from jsDelivr, so an internet
connection is required. To self-host them, place the files under `assets/js/vendor/` and
update the tags at the bottom of `index.html`.

## SEO files

| File | Purpose | Update when |
| --- | --- | --- |
| `index.html` `<head>` | Title, description, canonical, robots, Open Graph, Twitter Card, JSON-LD (Organization, WebSite) | Business details or wording change |
| `sitemap.xml` | Lists indexable pages | A page is added, removed or substantially edited (update `lastmod`) |
| `sitemap.images.xml` | Lists real image files | A real image is added (add an `<image:image>` entry) |
| `robots.txt` | Allows crawling and points to both sitemaps | The domain changes |
| `.htaccess` | Canonical host and HTTPS, error pages, caching | Hosting changes |
| `403.html` / `404.html` | Branded error pages (`noindex`) | Design changes |
| `favicon*.png`, `favicon.ico`, `apple-touch-icon.png`, `android-chrome-*.png`, `site.webmanifest` | Browser, iOS and manifest icons (drop mark from the existing logo). Linked in the `<head>` of every HTML page | Branding changes (replace files, keep names; browsers cache favicons for a long time) |
| `seo-keywords.md` | The 100-keyword reference list, with site-support flags | Services or content change |
| `assets/images/og-drinkingwater-shop.png` | 1200x630 social preview image | Branding changes (replace the file, keep the name) |

Rules to keep: no inline CSS and no `<style>` blocks (all styling lives in `assets/css/`),
no JavaScript added to utility pages, and no `meta keywords` tag. Error pages use
root-absolute asset paths (`/assets/...`) because Apache serves them from any broken URL.

## Deployment

Requirements: Apache 2.4 with `mod_rewrite`, `mod_headers`, `mod_deflate` and `mod_mime`
(each block in `.htaccess` is wrapped in `<IfModule>`), with `AllowOverride FileInfo`
enabled for the site folder, and HTTPS enabled for the domain.

1. Upload the **contents** of this folder to the web root of drinkingwater.shop,
   including the hidden `.htaccess` file.
2. Point DNS for both `drinkingwater.shop` and `www.drinkingwater.shop` at the host and
   issue an SSL certificate that covers both names.
3. Confirm the redirects: `http://` and `www` should both end at
   `https://drinkingwater.shop/` in a single 301.
4. Confirm `https://drinkingwater.shop/robots.txt` and both sitemaps load, then submit
   `sitemap.xml` and `sitemap.images.xml` in Google Search Console and Bing Webmaster Tools.
5. Request a missing URL (for example `/missing-page`) and confirm the 404 page appears
   with a real 404 status.

Other hosts: on Nginx or a static host (Netlify, Cloudflare Pages, S3), `.htaccess` is
ignored; recreate the HTTPS/host redirects, the error pages and the cache headers in that
platform's own configuration.

### Changing the domain

Replace `https://drinkingwater.shop` in: `index.html` (canonical, Open Graph, Twitter,
JSON-LD), `cookiepolicy.html` (canonical, Open Graph), `robots.txt`, both sitemaps and the
redirect rules in `.htaccess` (the hostnames are escaped there, `drinkingwater\.shop`).

## Contact form

The form in the footer of `index.html` uses `action="mailto:info@drinkingwater.shop"`, so it
opens the visitor's email program instead of sending from the server, and it only works
for visitors who have one configured. To receive messages directly, point the form's
`action` at a form-handling endpoint (a server script or a form service), keep the
`name` attributes (`Name`, `Email`, `Message`), and update `cookiepolicy.html` if the new
service stores or sets anything. To change the address, edit it in the form `action`, the
mail link next to it, the JSON-LD `email` field and `cookiepolicy.html`.

## Known limitations

- The site has no postal address, telephone number, certifications or reviews, so none are
  published in structured data. Add them (and a `LocalBusiness` entry) only when they are real.
- The hotspots in `index.html` position themselves with `style="--x; --y"` attributes that
  already existed; they are the only inline styles and were not changed.

---

# Design and scene notes (original documentation)

An interactive study of the journey drinking water takes from source to glass,
built as twelve chapters you descend through.

## Running it

The page uses ES modules and an import map, so it needs a server rather than
`file://`:

```bash
cd drinkingwater-shop
python3 -m http.server 5173
# open http://localhost:5173
```

GSAP, ScrollTrigger and Three.js load from CDN. If you'd rather vendor them,
drop the files in `assets/js/vendor/` and swap the tags in `index.html`.

## Structure

```
drinkingwater-shop/
├── index.html              all 14 sections, shell chrome, script tags
├── README.md
└── assets/
    ├── css/
    │   ├── base.css        tokens, reset, themes, type scale
    │   ├── layout.css      12-column grid, chapter scaffolding, footer
    │   ├── components.css  loader, nav, depth gauge, meniscus, toggles
    │   ├── sections.css    per-chapter treatments
    │   └── responsive.css  breakpoints, largest to smallest
    ├── js/
    │   ├── main.js         entry point and boot order
    │   ├── modules/
    │   │   ├── loader.js       loading screen fill
    │   │   ├── navigation.js   floating chapter menu
    │   │   ├── progress.js     water level + depth gauge
    │   │   ├── controls.js     sound and theme toggles
    │   │   ├── reveal.js       GSAP ScrollTrigger motion
    │   │   └── panels.js       filter layers, container materials
    │   └── three/
    │       ├── three-scene.js  orchestrator: renderer, camera, loop, resize
    │       ├── quality.js      device tiering + runtime perf guard
    │       ├── environment.js  palette, lights, env map, volumetric lamps
    │       ├── water.js        animated tank surface
    │       ├── chambers.js     glass vessels, media beds, lab framework
    │       ├── pipes.js        transparent transfer lines with flow pulses
    │       ├── particles.js    suspended motes + rising bubbles
    │       ├── droplet.js      the glowing drop and its impact ripple
    │       ├── shaders.js      all GLSL sources
    │       └── ambient.js      earlier point field, kept unused as reference
    └── media/              (empty — no stock imagery by design)
```

## Design tokens

| Token | Deep (default) | Lab light |
| --- | --- | --- |
| `--bg` | `#02080F` | `#EEF5F9` |
| `--bg-raised` | `#061626` | `#FFFFFF` |
| `--ink` | `#D7E9F4` | `#061626` |
| `--ink-soft` | `#7F9EB4` | `#4B6E87` |
| `--accent` | `#3FD9C9` | `#0B8C8C` |

Type is two families: Instrument Serif for display and chapter numerals,
Inter Tight for everything else. Fluid scale from `--t-xs` to `--t-2xl`.

## Decisions worth knowing

- **The progress line is a water level**, filling downward on the left edge,
  rather than a bar across the top.
- **The chapter indicator is a depth gauge** on the right. Numbering is used
  because the content genuinely is a sequence.
- **Motion is rationed.** One orchestrated load sequence into the hero, then
  headline lifts and the purification rules drawing themselves. No blanket
  fade-and-slide on every section.
- **The comparison chapter uses a real table**, not a card grid, because the
  content is tabular.
- `data-scene` elements are reserved mounts for the per-chapter Three.js
  scenes that come next. They render as dashed placeholders today.

## The background scene

A persistent water purification facility renders behind the whole page:
three glass vessels on a transparent deck, transfer pipes carrying visible
pulses of light between them, bubbles breaking out of the treated columns,
and a glowing droplet at the outlet that falls on a loop and ripples the
tank surface where it lands. The pulses always travel intake → vessel →
vessel → outlet, so the direction of treatment is readable without a caption.

Everything is deliberately cheap. There is no fluid solve: the surface is a
displaced plane driven by four travelling waves plus one ripple term, and
all particle motion happens in the vertex shader so the CPU never touches a
buffer after boot.

### Performance

`quality.js` picks a budget at boot from pointer type, viewport, core count,
device memory, save-data and the unmasked GL renderer string:

| | high | mid | low |
| --- | --- | --- | --- |
| Pixel ratio cap | 2 | 1.6 | 1.25 |
| Water segments | 128 | 80 | 44 |
| Motes / bubbles | 1400 / 420 | 700 / 220 | 300 / 90 |
| Glass | real transmission | reflective fallback | reflective fallback |
| Target | 60fps | 60fps | 30fps |

A runtime guard samples frame cost and steps the budget down once if the
device can't hold its target, so a thermally throttled phone degrades
instead of stuttering. The loop also pauses on `visibilitychange`, and
`prefers-reduced-motion` renders one composed still frame rather than
removing the scene. If WebGL is missing, `body.no-webgl` supplies a layered
gradient and the page carries on.

### Integration notes

- The canvas is `position: fixed`, `z-index: 0`, `pointer-events: none`;
  `main` sits at `z-index: 1`. No control is ever blocked.
- Resize ignores height-only changes under 120px, so the scene doesn't
  jitter as mobile browser chrome collapses on scroll.
- The theme toggle is watched via `MutationObserver` — palette, fog, tone
  mapping exposure and the environment map all swap with it.
- Camera drift is slow and bounded, with pointer parallax on desktop and
  `deviceorientation` drift on touch, plus a small descent tied to scroll.
- The live scene is exposed as `window.__dwsScene` while the chapter scenes
  are being built.

## Next steps

1. Chapter scenes mounted into the `data-scene` elements: aquifer
   cross-section, pipeline flythrough, cartridge cutaway.
2. Pin and scrub the purification chapter so the six rooms advance on scroll.
3. Real copy and tested figures for quality, storage and materials.
4. Ambient audio uses one optional local waterfall recording behind the sound
  toggle; it stays muted until the visitor opts in and follows chapter progress.

### Audio attribution

The dominant waterfall recording is [Waterfall and birds sounds.wav](https://commons.wikimedia.org/wiki/File:Waterfall_and_birds_sounds.wav) by Blight55, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It is used locally at `assets/media/waterfall-and-birds-sounds.wav`.
5. Smooth-scroll layer if the native feel isn't enough on trackpads.

## Update: the fixed landscape homepage

The immersive gateway (`icon-scene.js` / `icon-scene.css`) is now the whole
homepage experience, matching the fixed, non-scrolling, hotspot-driven
interaction style of Penderecki's Garden's "The Maestro's Manor":

- The 7 hotspots now read: **Water Source, Purification Area, Filtration &
  Treatment, Quality Testing, Clean Water Storage, Can Filling & Packaging,
  Finished Storage & Dispatch** — each still pulls its heading, description
  and detail content live from its existing chapter section (`source`,
  `purification`, `laboratory`, `quality`, `storage`, `handling`,
  `materials`); no new copy was written.
- The persistent Three.js facility (vessels, pipes, particles, the outlet
  droplet) is no longer hidden behind the gateway's can-and-water close-up —
  it now **is** the landscape, with the can and bubble field layered on top
  as foreground detail. Nothing 3D was rebuilt; `chambers.js`/`pipes.js`/
  `particles.js`/`droplet.js` are unchanged.
- Clicking a hotspot now eases the camera to that chapter's own hand-tuned
  waypoint (`three/journey.js`, the same shots the old scroll journey used),
  so each hotspot opens onto a genuinely different, relevant vantage of the
  facility instead of a small nudge around a fixed close-up.
- The scrolling 12-chapter version of the content still exists in the DOM
  unchanged (nothing was deleted), but stays reachable only as source data
  for the overlay — `body.immersive-mode` keeps it out of normal scroll, so
  the homepage itself never scrolls.

## Custom events

The interactive pieces emit events on `document.body` so scenes can subscribe
without reaching into the DOM:

- `dws:sound` → `{ on: boolean }`
- `dws:layer` → `{ layer: 'mesh' | 'sediment' | 'carbon' | 'membrane' | 'core' }`
- `dws:material` → `{ material: 'glass' | 'steel' | 'copper' | 'tritan' | 'pet' }`

## Landscape loading and fallback (update)

- **One landscape only.** The old procedural island (icosahedron ground, tube paths,
  instanced trees) and the stand-in fallback platform were removed from
  `buildReferenceLandscape()` in `assets/js/three/three-scene.js`. The landscape is the `massif_du_devoluy.glb` terrain
  with the `water_treatment_plant.glb` equipment on it. The unused `assets/js/landscape.js`
  (a second, duplicate `initWaterFacility` call) was deleted.
- **3D streams in.** The page and loader are visible immediately. 3D starts after the first
  paint (`main.js` > `startScenes()`), the scene build yields to the browser between heavy
  steps, and the models load asynchronously. `body.landscape-ready` is added when terrain
  and equipment are in place; that reveals the landscape preview thumbnail. No CSS or
  fallback landscape is drawn in the meantime.
- **If the terrain model fails**, no stand-in ground is built and the equipment is not
  placed; the hotspots still open their panels directly (`landscape-entry.js`) and
  `landscape-ready` is not set. Check the browser console for
  `Landscape GLB failed to load.`
- **Loader** (`loader.js`) no longer waits for `window.load`, 3D models or audio: it needs the
  parsed DOM plus fonts (fonts capped at 700 ms), a 450 ms minimum fill and a 2 s hard cap.
- **Models** are re-encoded with the same filenames (`?v=opt1` busts the 30-day cache):
  terrain 67.1 MB to 32.7 MB (16-bit indices, 8-bit normals via `KHR_mesh_quantization`,
  16-bit UVs, 4096 px texture to 3072 px JPEG; vertex positions unchanged), plant 12.9 MB
  to 11.2 MB (two opaque PNG textures to JPEG).
- **Mobile hotspot layout**: portrait phones use a two-column zig-zag, short landscape screens
  use narrower labels (end of `icon-scene.css`).
