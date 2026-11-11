# Store logo sources

Chain logos in `public/logos/` are used **only to make the demo store data recognisable**.
They are trademarks of their respective owners; Shelfwise claims no rights to them and they
must be replaced or removed before any production or commercial use.

| File               | Chain                          | Source                                                                                                                          | Licence / status               |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `netto.svg`        | Netto (Denmark, Salling Group) | Official header mark, inline SVG on `https://netto.dk/`                                                                         | Trademark, all rights reserved |
| `fotex.svg`        | Føtex                          | [Wikimedia Commons — Føtex logo.svg](https://commons.wikimedia.org/wiki/File:F%C3%B8tex_logo.svg)                               | Public domain (trademark)      |
| `bilka.svg`        | Bilka                          | [Wikimedia Commons — Bilka (Unternehmen) logo.svg](<https://commons.wikimedia.org/wiki/File:Bilka_(Unternehmen)_logo.svg>)      | Public domain (trademark)      |
| `rema-1000.svg`    | Rema 1000                      | [Wikimedia Commons — Rema 1000 logo.svg](https://commons.wikimedia.org/wiki/File:Rema_1000_logo.svg)                            | Public domain (trademark)      |
| `spar.svg`         | Spar                           | [Wikimedia Commons — SPAR Logo.svg](https://commons.wikimedia.org/wiki/File:SPAR_Logo.svg) — viewBox cropped to the tree symbol | CC BY-SA 4.0 (trademark)       |
| `lidl.svg`         | Lidl                           | [Wikimedia Commons — Lidl logo.svg](https://commons.wikimedia.org/wiki/File:Lidl_logo.svg)                                      | CC0 (trademark)                |
| `meny.svg`         | Meny                           | Official site, `https://meny.dk/static/meny/flat-outlined-logo.svg`                                                             | Trademark, all rights reserved |
| `kvickly.png`      | Kvickly                        | Official site icon, `https://kvickly.coop.dk/` (apple-touch-icon)                                                               | Trademark, all rights reserved |
| `superbrugsen.png` | SuperBrugsen                   | Official site icon, `https://superbrugsen.coop.dk/` (apple-touch-icon)                                                          | Trademark, all rights reserved |
| `coop-365.png`     | Coop 365                       | Official site icon, `https://365discount.coop.dk/` (apple-touch-icon)                                                           | Trademark, all rights reserved |

Retrieved 11 Nov 2026. Display (brand background, cover/contain, scale) is configured in
`src/features/shared/storeLogos.ts`. Stores without a bundled logo fall back to chain initials
(`src/features/shared/StoreLogo.tsx`).
