# CLAUDE.md

Projektkontekst og regler for Claude Code.

## Formål

DB er en lille, neutral optager-app (PWA, 😀-ikon) til eget brug: https://pbo-dot.github.io/db/. Den optager samtaler som tekst, låser teksten, så kun Dagbog (pbo-dot/dagbog) kan læse den, og lægger den i Dagbogs indbakke. Almindelige statiske filer, intet byggetrin.

## Arbejdsform med ejeren

- Skriv på dansk, kort og i almindeligt sprog. Ejeren er ikke programmør.
- Nye funktioner drøftes og godkendes, før de bygges. Fejlrettelser må laves med det samme.
- Læg ændringer direkte på `main`. Husk at hæve cache-navnet i `sw.js`, når filer ændres.
- Kommentarer og brugertekster på dansk.

## Design (top-design anno 2026)

Ejeren ønsker, at alt nyt og alt, der ændres, lever op til top-design anno 2026. Det gælder alle ejerens apps.

- Følg ånden i Googles **Material 3 Expressive** (som på ejerens Pixel), tilpasset appens egen stil og farver.
- Stor, letlæselig skrift og stærk kontrast. Både lys og mørk tilstand skal se godt ud.
- Store trykflader (mindst 44–48 px) og runde knapper. Brug tre slags knapper: fyldt (hovedhandling), tonal (almindelig) og tekst (mindre vigtig).
- Kort uden kanter, store runde hjørner og god luft. Ensartede streg-ikoner.
- Korte tekster. Ingen lange grå hjælpetekster; forklar kun, når det er nødvendigt.
- Bløde, diskrete overgange og trykeffekter (respektér "reducer bevægelse").
- Vis altid et visuelt forslag (billede), før nye skærme eller større ændringer bygges.
