# Bundle Finder

Describe a trip in plain words. Bundle Finder searches flights, hotels, rental cars and your membership programs, drops anything that misses a hard limit, and returns the 3–5 cheapest hotel + flight + car bundles. Each bundle comes with booking links or step-by-step booking instructions.

## Run it

You need Node.js 20 or later.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Then open http://localhost:3000.

With no keys set, the app runs in **sample mode**: made-up offers that are clearly labelled. Every screen, filter and ranking step works the same way as with live data.

## Keys (all optional)

| Variable | What it turns on | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude reads your trip description. Without a key, a simpler built-in reader handles common phrasings. | platform.claude.com |
| `DUFFEL_ACCESS_TOKEN` | Live flight and hotel prices. | duffel.com. A free test token starts with `duffel_test_`. Hotel ("Stays") access may need to be enabled on your Duffel account. |
| `MEMBERSHIP_BROWSER=1` | On your own computer only: opens membership sites in a browser window that keeps your sign-ins (needs `npm install playwright`). | — |

## How it works

1. **Read** (`lib/parse/`): Claude (`claude-opus-5-5`, structured output) turns the description into criteria: airports, dates, travelers, hotel limits, flight rules and time windows, car class and budget. Anything missing becomes a question on screen. Every value can be edited on the Plan page.
2. **Search** (`lib/adapters/`): each source runs in parallel and reports its own status.
   - **Flights and hotels** come from Duffel. (Amadeus closed its self-service APIs in July 2026.)
   - **Rental cars** use sample prices for now. No public car-rental API is connected yet.
   - **Membership sites** (Costco Travel, Chase Travel, Amex Travel, Marriott Bonvoy, Delta SkyMiles) have no public APIs. In sample mode they produce sample offers. In live mode they give step-by-step instructions for checking the site, and can open it in your signed-in browser.
3. **Filter and rank** (`lib/engine/`):
   - Hard limits are distance from the arrival airport, stars, rating, bedrooms or square feet, amenities, stops, the four flight time windows, car class and budget.
   - Points count at the value per point you set.
   - Credits and member rewards are subtracted from the price.
   - Bundles that confirm every limit rank first. A limit the source didn't report (such as room size) is shown in amber as "Unconfirmed".
4. **Book**: each match has links and numbered steps, plus a booking guide where you can record confirmation numbers.

## Tests

```bash
npm test
```

## Known gaps / next steps

- **Membership prices aren't read automatically.** Reading prices off Costco, Chase, Amex, Marriott and Delta pages needs each site's current layout, inspected on your own signed-in machine.
- **No car-rental source yet.** Car prices are samples.
- **Date flexibility (± days) is recorded but not searched yet.**
- **Duffel isn't tested against live data.** The integration follows Duffel's v2 docs but hasn't been run against a live account; check the first live search.
- **Limited airport list.** `lib/airports.ts` lists about 40 airports; add more as needed.
- **Settings stay in one browser.** Memberships and results are saved in that browser's local storage.
