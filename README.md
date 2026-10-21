# leinhardt.no

Personlig side for Peder Myhrer Leinhardt. En malt hytte ved elva som er CV-en. Ingen byggesteg, ingen server, hostes gratis på GitHub Pages.

## Status: steg 1, grå boks

Siden er en sanntids 3D-scene i Three.js. Akkurat nå er alt grå klosser med riktige mål, lys, kameratur og klikkpunkter. Utseende (toon-shading, palett, tåke, bloom, vann) kommer i steg 2, detaljer i steg 3, ytelse og reserve i steg 4.

## Mål brukt i scenen

Hentet fra en typisk liten tømmerhytte: grunnflate 6,0 x 4,5 m, vegghøyde 2,2 m, takvinkel 30 grader, stokker Ø 0,20 m, dør 0,9 x 2,0 m, vinduer 0,9 x 1,1 m med brystning 0,9 m, gulv 0,45 m over bakken på steinmur, veranda 1,5 m dyp, trinn 0,18 m. Alt står øverst i `src/world.js` og kan endres ett sted.

## Slik henger det sammen

| Fil | Hva |
|-----|-----|
| `index.html` | Siden. All tekst står i `<main id="hytteboka">`. Hver `section` har en `data-id` som kobler den til en gjenstand i scenen. |
| `src/world.js` | Scenen: terreng, elv, hytte med laftede vegger, veranda, interiør, trær, båt, bål, lys, kamerarigg, plukking, viltkameraet (et ekte kamera i scenen som rendrer til en tekstur). |
| `src/main.js` | Kobler scenen til siden: peker, svevende etikett, panel, inn og ut, fps-måler, viltkamera-demoen. |
| `src/detect.js` | YOLO11n i nettleseren via ONNX Runtime Web. Lastes først ved behov. |
| `assets/vendor/three/` | Three.js 0.170 (minifisert) pluss OrbitControls og etterbehandlingspassene vi skal bruke. |
| `assets/vendor/gsap.min.js` | GSAP 3.12.5 for kameraturen. |
| `assets/ort/` | Modellen (10,7 MB) og kjøretiden. |

Alt er lokalt. Ingen CDN.

## Kjøre lokalt

`python3 -m http.server 8000` i mappa, åpne `http://localhost:8000/`. Siden må serveres over http fordi den bruker ES-moduler.

`?capture` i adressen gir en fast klokke, brukt til å ta opp video av kameraturen bilde for bilde.

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
