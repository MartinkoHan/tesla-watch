# Daily Tesla check: guide for the run

This repo publishes https://tesla.han.sk, a page of used Tesla Model Y cars that a buyer in Bratislava and his father are choosing from. Once a day you re-read the car sites, update one data file, run one build command, push, and (only if something changed) send one e-mail. Both readers mostly open the page and the e-mail on a phone.

## How the pieces fit

| File | Who writes it | What it is |
|---|---|---|
| `data/cars.json` | **you** | The cars on the page today, plus short lists for the "left out / also checked" section. The only file you edit. |
| `build.js` | fixed | Checks the data, works out costs and what changed since yesterday, and writes everything below. |
| `templates/page.html` | fixed | The page design. |
| `index.html` | build | The published page. Never edit it by hand: the next build overwrites it. |
| `data/changes.json` | build | What changed today (new, sold, price). |
| `out/` | build | `email.html`, `email.txt`, `subject.txt`, `result.json`. Not committed. |

Your job is research and accurate data. The design is fixed on purpose so the page and e-mail look the same every day. If you think the design or this guide should change, say so in your run summary instead of changing it.

**You never calculate** transport, fees, VAT, totals, the list of changes, the date line or the e-mail text. The build does all of that from the fields below. This is why the fields have to be right.

## The run, step by step

1. **Start clean.** `git fetch origin main && git checkout main && git reset --hard origin/main`. The `data/cars.json` you now have is yesterday's state. Do not reuse car data remembered from earlier runs in this conversation: re-read the sites.
2. **Read the sources** (see "Sources"). Keep scratch files outside the repo.
3. **Edit `data/cars.json`** (see "The data file" and "What counts as a change").
4. **Build:** `node build.js`. If it prints problems, fix `data/cars.json` and run it again until it passes. Read its last two lines: they say what changed and whether an e-mail was written.
5. **Commit and push to main.** `git add -A`, author `Claude <noreply@anthropic.com>`, commit message = `commitMessage` from `out/result.json`, no attribution trailers of any kind. Push even when only the date changed, so the page shows today's check. If the push is refused, retry once for a network error. If it still fails, send no e-mail (the page would be stale) and say so in the summary.
6. **E-mail, only if `out/email.html` exists and the push succeeded** (see "Sending the e-mail").
7. **Summary:** what changed, whether the push and e-mail succeeded, any site that could not be read.

## Which cars qualify

Tesla Model Y, all of these:

- **All-wheel drive only.** Long Range AWD, Dual Motor, Allrad, "Maximale Reichweite Dual", Performance. Not RWD, not "Standard".
- **At most 70 000 km and at most 55 000 €.** Slovak cars up to 57 000 € are also listed as near-misses, because nothing in Slovakia is under the cap and the readers want to see how close it gets. The page marks them "over budget" by itself.
- **HW4 (AI4) computer**, which the buyer needs for FSD:
  - Every Juniper (the refreshed design, first registered 2025 or later) has it: `juniper: true`, `hw4: "juniper"`.
  - 2024 cars qualify only if built after the switch: Berlin-built (VIN `XP7Y…`) from about September 2024 (VIN serial ≥ 445000), Shanghai-built (VIN `LRWY…`) from February 2024. In practice include AWD cars first registered 8/2024 or later and set `hw4` honestly:
    - `"confirmed"`: a Controls › Software screen photo shows "Computer for Full Self-Driving 4" / "AI4", or the VIN proves it.
    - `"seller"`: the ad text says HW4 / AI4.
    - `"likely"`: first registered 10/2024 or later, nothing else known.
    - `"unconfirmed"`: first registered 8–9/2024, nothing else known.
  - Leave out any car whose ad or photo shows HW3, and 2024 cars registered before 8/2024.
- **No damaged cars.** Skip a car whose ad mentions damage (poškozená, beschädigt, Unfallwagen, havarované…) or whose photos show body damage. Mention it in `leftOut`.
- **Also leave out** auctions (for example exdrazby.cz), US imports, accessory ads, and ads that look fake (about half the price of similar cars, no description, many ads from one dealer). Mention them in `leftOut`.

Markets: Slovakia, Czechia, Austria, Germany. Convert CZK once per run with https://api.frankfurter.dev/v1/latest?from=EUR&to=CZK and put the Kč price in a note.

## The data file

`data/cars.json` looks like this (one car shown):

```json
{
  "updated": "2026-11-12",
  "cars": [
    {
      "id": "hamm-10-2024",
      "url": "https://www.autoscout24.de/angebote/0a6580b2-460c-4300-81c5-fe3efe0765f5",
      "source": "autoscout24",
      "title": "Model Y Long Range Dual AWD",
      "version": "Long Range",
      "juniper": false,
      "price": 43700,
      "firstReg": "10/2024",
      "km": 28500,
      "country": "DE",
      "town": "Hamm",
      "plate": "HAM",
      "seller": "Car Friends (dealer)",
      "sellerType": "dealer",
      "distanceKm": 1050,
      "hw4": "likely",
      "autopilot": null,
      "photo": "https://prod.pictures.autoscout24.net/listing-images/<guid>_<photoid>.jpg/720x540.webp",
      "swPhoto": null,
      "notes": ["Pearl white, black interior, full service history, no accidents listed"],
      "firstSeen": "2026-11-08"
    }
  ],
  "removed": [],
  "leftOut": [],
  "alsoChecked": [],
  "notChecked": [],
  "run": { "toolCalls": 0, "sources": 0, "listingsOpened": 0, "tokensLowK": 0, "tokensHighK": 0 }
}
```

Per car:

| Field | Meaning |
|---|---|
| `id` | Stable name for this physical car: town, month and year of first registration, lowercase with dashes (`hamm-10-2024`). **Never change the id of a car that is already listed**, even if its ad moves to a new link. The build recognises cars by id, so a changed id shows up as one car sold and another one new. If the id is taken, add `-b`. |
| `url` | Link to the ad. If a seller relists the same car under a new link, update `url` and keep `id`. |
| `source` | `autoscout24`, `autobazar.eu`, `bazos.cz`, `bazos.sk`, `aaaauto`, `drivetesla` or `other`. |
| `title` | Short model name as a buyer would say it, in English. No town, no price. |
| `version` | `"Long Range"` or `"Performance"`. |
| `juniper` | `true` for the refreshed design (first registered 2025+), otherwise `false`. |
| `price` | Asking price in whole euros, VAT included. |
| `firstReg` | First registration as `"M/YYYY"`, for example `"8/2024"`. |
| `km` | Mileage, whole number. |
| `country` | `SK`, `CZ`, `AT` or `DE`. |
| `town` | Town only, in its local spelling (`"Praha"`, `"Wiener Neustadt"`). No country. |
| `plate` | The 1–3 letter district code of that town's licence plates (`"G"` for Graz, `"KE"` for Košice, `"A"` for Praha). It is drawn as a small plate on the photo. |
| `seller` | Seller name as shown, or `"Private seller"`. |
| `sellerType` | `"dealer"` or `"private"`. Decides the VAT estimate, so take it from the ad. |
| `vatInvoice` | Optional. Set `true` only for a private-seller ad that says VAT can be shown or deducted. |
| `distanceKm` | Rough road distance from the town to Bratislava, whole km. `0` for Slovak cars. Decides the transport estimate. |
| `hw4` | `"juniper"`, `"confirmed"`, `"seller"`, `"likely"` or `"unconfirmed"` (rules above). |
| `autopilot` | `"basic"`, `"enhanced"`, `"fsd"`, or `null` when the ad does not say. |
| `photo` | One exterior photo link, or `null`. AutoScout24: `https://prod.pictures.autoscout24.net/listing-images/<guid>_<photoid>.jpg/720x540.webp`. Autobazar.eu: the 1200x900 main photo link from the ad page. Bazoš photos do not load on other sites: use `null`. |
| `photoNote` | Required when `photo` is `null`: one short sentence, for example `"No photos in this ad"` or `"Bazoš.cz doesn't allow its photos elsewhere. Open the ad to see them"`. |
| `swPhoto` | Link to the Controls › Software screen photo if the ad has one, otherwise `null`. |
| `notes` | Up to 4 short lines (max 160 characters each) a buyer would want before clicking: colour, warranty, tow bar, a contradiction in the ad, the Kč price, what to ask the seller. Plain English sentences. Do not repeat what the page already shows (price, km, HW4 status, VAT, distance). |
| `firstSeen` | Leave existing values alone. For a new car you may leave it out: the build fills in today's date. |

Top level:

- `updated`: today's date in Bratislava, `YYYY-MM-DD`. Change it on every run.
- `removed`: only for cars you take off the list for a reason other than being sold, as `{ "id": "...", "reason": "one sentence" }`. Reset it to `[]` at the start of each run.
- `leftOut`: one sentence per damaged car, auction, US import or suspicious ad you skipped today.
- `alsoChecked`: one sentence per source that was read but added nothing (for example reserved cars on DriveTesla.sk).
- `notChecked`: names of sites that could not be read today. Shown on the page and in the e-mail.
- `run`: your honest tally for this run. `toolCalls`, `sources` and `listingsOpened` are counts you keep while working. `tokensLowK`–`tokensHighK` is a rough range in thousands, estimated from how much text you read and wrote; you cannot read exact usage, and the e-mail already words it as an estimate.

## What counts as a change

The build compares today's file with yesterday's (the version at git HEAD), so what you do to the list is what gets announced:

- **New car:** add it. It is announced as "New".
- **Price changed:** edit `price`. It is announced as a price change, and the page shows the old price struck through.
- **Sold:** delete the car, but only after checking. A car missing from search results is not proof: open its ad. AutoScout24 returns HTTP 410 or a "no longer available" page for sold cars. If the ad is still live, keep the car.
- **Removed for another reason** (price rose above the limit, damage found, turned out to be HW3): delete the car and add an entry to `removed` with the reason.
- **A site could not be read** (blocked, captcha, 403): keep all of that site's cars exactly as they are and add the site to `notChecked`. Deleting them would announce them as sold to two people who may act on it.

If the build says nothing changed, there is no e-mail. That is the normal result on most days.

## Sources

Read everything from the container shell: `curl -L` with a desktop browser User-Agent, parsed with node or python, or the pre-installed Playwright Chromium when a page needs JavaScript. To look at photos, download them to the scratch directory and open them with the Read tool.

1. **AutoScout24, Austria and Germany.** `https://www.autoscout24.de/lst/tesla/model-y?fregfrom=2024&cy=D%2CA&kmto=70000&priceto=55000&sort=price&desc=0` and further pages (`&page=N`, 20 per page; `numberOfResults` is in the HTML). The `__NEXT_DATA__` JSON has `pageProps.listings` with `id`, `price.priceRaw`, `tracking.firstRegistration`, `tracking.mileage`, `vehicle.modelVersionInput`, `location` and `seller.type`. For each new car, fetch the ad page; collect photo ids with `/listing-images\/[0-9a-f-]+_[0-9a-f-]+\.jpg/g` (keep ids starting with the car's guid); read the `description` in `listingDetails` for HW4 / AI4 / HW3 / damage words. To save effort, build one contact sheet of all new cars' thumbnails (`…/listing-images/<id>.jpg/120x90.webp`, one numbered row per car, a local HTML page screenshotted with Playwright), view it once, and zoom only into likely screen photos at 720x540.
2. **Autobazar.eu, Slovakia.** `https://www.autobazar.eu/en/vysledky-parametre/osobne-vozidla/tesla/model-y/2025/`, and the same with `/2026/` and `/2024/`. Data is in `__NEXT_DATA__`; 2024 AWD ad pages show the VIN.
3. **DriveTesla.sk.** `https://drivetesla.sk/kategoria-produktu/tesla/tesla-model-y/`. Use prices "s DPH". Cars marked "Rezervované" are not listed; mention them in `alsoChecked`.
4. **AAA Auto.** `https://www.aaaauto.sk/ojazdene-vozidla/tesla/model-y` and `https://www.aaaauto.cz/ojete-vozy/tesla/model-y`. VINs are in the HTML: use them for the HW4 rule.
5. **Bazoš.cz.** `https://auto.bazos.cz/tesla/?hledat=model+y+2025` and `…model+y+2024`. Split on `<div class="inzeraty inzeratyflex">`; read `h2.nadpis`, `.popis`, `.inzeratycena`, `.inzeratylok`; open promising ads for km, registration, damage and VIN. Photos (`www.bazos.cz/img/...`) can be downloaded to check for damage.
6. **Bazoš.sk**, same searches on `auto.bazos.sk`, only if the rest went quickly.

## Sending the e-mail

Only when `out/email.html` exists and the push succeeded. Send one e-mail with `mcp__Gmail__send_message` to the recipients named in the task prompt (they are kept out of this repo on purpose):

- **subject:** the line in `out/subject.txt`.
- **htmlBody:** the contents of `out/email.html`, **exactly as built**. Read the file and pass it through character for character. Do not rewrite, reformat, shorten or "improve" it, and do not add images: the layout is tested as it is, and small changes break it in Gmail.
- **body:** the contents of `out/email.txt`, exactly as built.

Never contact sellers, fill in forms, or e-mail anyone else.

## If something goes wrong

- **Build reports problems:** they name the car and field. Fix the data, not `build.js`.
- **Build crashes or the page looks broken:** do not push a broken page and do not send an e-mail. `git reset --hard origin/main` so yesterday's page stays up, and describe the error in the summary.
- **Unsure whether a car qualifies:** include it with the cautious status (`"unconfirmed"`) and say what is unclear in a note. The readers would rather see a doubtful car flagged than miss it.
