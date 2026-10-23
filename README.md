# DB

En lille optager-app til [Dagbog](https://github.com/pbo-dot/dagbog). Sort skærm med et ur (klokkeslæt og dato) og en lille prik i toppen: grå = optager ikke, blå = optager.

- Optagelsen starter, når appen åbnes, og stopper ved et tryk på skærmen, eller når appen forlades.
- Talen bliver til tekst med telefonens talegenkendelse (Chrome). Teksten vises aldrig.
- Teksten krypteres med Dagbogs offentlige nøgle (RSA-OAEP + AES-GCM) og lægges i Dagbogs indbakke i samme browserlager (begge ligger på pbo-dot.github.io). Kun Dagbog kan læse den, når den er låst op.

Ingen byggetrin: siden udgives direkte fra `main` med GitHub Pages. Formatet skal passe med `src/lib/inbox.ts` og `src/lib/crypto.ts` i Dagbog.

Installér: åbn https://pbo-dot.github.io/db/ i Chrome på Android og vælg ⋮ → Installér app.
