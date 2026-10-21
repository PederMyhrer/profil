# leinhardt.no

Personlig side for Peder Myhrer Leinhardt. En malt hytte ved elva som er CV-en. Ingen byggesteg, ingen server, hostes gratis på GitHub Pages.

## Slik henger det sammen

| Fil | Hva |
|-----|-----|
| `index.html` | Siden. All tekst står i `<main id="hytteboka">`. Hver `section` har en `data-id` som kobler den til en ting i scenen. |
| `hotspots.json` | Hvor tingene er i bildene (normaliserte koordinater), hvor bålet og pipa er, hvor ildfluene flyr. Flytt et punkt her, aldri i koden. |
| `src/app.js` | Én WebGL-pass som gjør bildet levende: parallakse fra dybdekart, vann, blafrende lys, varm overgang gjennom døra. Partikler (røyk, ildfluer, glør, støv) på et 2D-lerret oppå. Viltkamera-demoen. |
| `assets/ext.webp`, `door.webp`, `int.webp` | De tre scenene, 1680 px. `-m.webp` er mobilversjoner. |
| `assets/*-depth.png` | Dybdekart (mørkt er langt unna). Laget for hånd fra scenens geometri, fordi Depth Anything ikke kunne lastes ned der siden ble bygget. Byttes ut med et ekte dybdekart når du har kjørt modellen lokalt: samme filnavn, 420 px bredt, gråtoner. |
| `assets/*-light.png` | Masker over de varme lyskildene. Det er disse som blafrer. |
| `assets/ext-water.png` | Maske over elva. |
| `assets/ort/` | YOLO11n som ONNX (10,7 MB) og ONNX Runtime Web. Lastes først når noen slår på viltkameraet. |
| `assets/vendor/gsap.min.js` | GSAP 3.12.5 for dør-overgangen. Ligger lokalt så siden ikke er avhengig av et CDN. |
| `assets/og.jpg` | Bildet som vises når lenken deles. |

Valg underveis: PixiJS var planen, men én håndskrevet shader gjør alt scenen trenger (parallakse, vann, lys, overgang) uten 400 kB bibliotek. Lettere, raskere og enklere å endre.

## Publisere

1. Lag et offentlig repo på GitHub, for eksempel `leinhardt.no`.
2. Last opp alt i denne mappa til `main` (inkludert `CNAME` og den tomme `.nojekyll`).
3. **Settings > Pages > Build and deployment**: *Deploy from a branch*, `main`, `/ (root)`.
4. Sjekk at `https://<brukernavn>.github.io/leinhardt.no/` virker.

## Koble på leinhardt.no

Hos registraren, under DNS:

| Type  | Navn | Verdi |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153 |
| AAAA  | @    | 2606:50c0:8001::153 |
| AAAA  | @    | 2606:50c0:8002::153 |
| AAAA  | @    | 2606:50c0:8003::153 |
| CNAME | www  | `<brukernavn>.github.io` |

Slett gamle A-poster eller parkeringsside på `@` først. Så **Settings > Pages > Custom domain**: `leinhardt.no`, vent til sjekken blir grønn, huk av **Enforce HTTPS**. Verifiser gjerne domenet under GitHub-profil > Settings > Pages.

## Budsjett

Første skjerm: 253 kB (bilde, dybde, lys, vann, GSAP, kode) pluss fonter fra Google Fonts. Interiøret: 177 kB, lastes først når musa nærmer seg døra eller etter fire sekunder. Modellen: 22 MB, kun på forespørsel.

## Tilgjengelighet og reserve

- Uten JavaScript: bakgrunnsbilde av hytta og all tekst i hytteboka.
- Uten WebGL: det samme.
- Redusert bevegelse: ingen parallakse, ingen partikler, overgangen er en overtoning.
- Alle klikkpunkter er knapper med navn, og kan nås med tastatur. Esc tar deg ut av hytta.

## Bilder og rettigheter

Se `KILDER.md`.

## Videre

- Ekte dybdekart med Depth Anything (kjør lokalt, legg inn med samme filnavn).
- Overmaling av scenene der det trengs, for eksempel laptopskjermen med et ekte deteksjonsbilde og kartet med dine egne nåler.
- Engelsk versjon.
- Lenke til GitHub når prosjektene er publisert.

## Status nå

Siden kjører på GitHub Pages fra dette repoet. Domenet leinhardt.no er ikke koblet på ennå. Når det skal gjøres: legg til en fil `CNAME` med innholdet `leinhardt.no`, følg DNS-tabellen over, og bytt `og:image` i `index.html` til `https://leinhardt.no/assets/og.jpg`.
