# Copilot Studio agent — setup for Shelfwise (POC)

For the colleague who owns the Copilot Studio agent. Shelfwise sends **one shelf or cooler photo
per conversation** to the agent and expects **one JSON object back**. The app maps that reply
to its own contract, using catalogue IDs and prices in øre. It checks every value and
reconciles overlapping photos itself. Foundry remains the target once IT grants access; only
the adapter changes.

The repository is public: environment IDs, agent names and tenant IDs are never committed.
They go into build variables (section 5).

## 1. Entra ID app registration (sign-in)

Testers sign in to Shelfwise with their organisation account, and the agent runs on their behalf
with a delegated token. **No secret is used.** This may need an IT or application admin.

1. Entra ID → App registrations → New: name "Shelfwise POC", **single tenant**.
2. Authentication → Add a platform → **Single-page application**, with these redirect URIs:
   - `https://illusive.github.io/shelfwise/`
   - `https://192.168.2.218:8443/` (local Docker test server)
   - `http://localhost:5173/` (development)
3. API permissions → Add → APIs my organization uses → **Power Platform API** → Delegated →
   **`CopilotStudio.Copilots.Invoke`** → then **Grant admin consent**. If Power Platform API
   isn't listed, the tenant must register it first. See Microsoft Learn: "Integrate with web
   or native apps using Microsoft 365 Agents SDK".
4. Send us the **Directory (tenant) ID** and the **Application (client) ID**.

## 2. Agent settings

1. **Settings → Security → Authentication:** keep **Authenticate with Microsoft**. Share the
   agent with the testers or a security group.
2. **Channels → Web app / Native app:** copy the connection string (the "direct connect" URL)
   and send it to us. It looks like
   `https://<env>.environment.api.powerplatform.com/copilotstudio/agenticruntime/3p/dataverse-backed/authenticated/bots/<schema-name>/conversations?api-version=2022-03-01-preview`.
   We already have one; tell us if it changes.
3. **Allow file input** (images) on the agent. The embed code we were given has
   `enableFileAttachment=false`, so check it's allowed for the agent itself, not only the iframe.
4. **Generative AI → Knowledge:** turn on **Allow ungrounded responses**. This is needed to
   answer from a photo without a matching knowledge source.
5. **Knowledge:** upload [`catalogue.csv`](copilot-studio/catalogue.csv). It holds our brand
   and product IDs. Any ID that isn't in it is treated as "unknown".
6. **Behaviour:** see section 3. Turn off or ignore the greeting. Shelfwise starts a conversation
   without the greeting and sends the photo as the first message.
7. **Publish** after every change; the app talks to the published agent.

## 3. What the agent should do

Each incoming message has one image attachment plus a short instruction starting with
`shelfwise-photo-v1`. The agent replies with **only** a JSON object (a ```json block is fine;
no other prose). Recommended: a topic that triggers on `shelfwise-photo-v1` and calls a
**Prompt** (AI Builder) with an image input and JSON output, then sends the JSON as the reply.

Suggested prompt (adjust freely):

> You analyse one photo from a Danish grocery store: a shelf, a cooler (glass door), or a
> floor/end-cap display of beverages.
>
> Return ONLY JSON in the `shelfwise-photo-v1` format (example below).
>
> - `locationType`: `shelf` (ambient), `cooler` (refrigerated) or `display` (floor/end-cap).
>   Set `usable: false` with `issues` if the photo is too blurry/dark or not a beverage shelf.
>   Issues: blurry, glare, reflection, too-dark, obstructed, low-resolution, not-a-shelf.
> - `facings`: every front-row product visible, left to right. Group adjacent identical
>   facings into one entry with `count` and a `box` spanning them. Use `brandId`/`productId`
>   from the catalogue (knowledge file) only. If you are not sure, use `status: "candidate"`;
>   if you can't tell, use `status: "unknown"` with null IDs. Never invent IDs. Count every
>   beverage, including competitors and unknowns.
> - `priceLabels`: every shelf label. Price in DKK as shown (`priceDkk`); pant separately in
>   `deposit`; multibuy as `{quantity, totalDkk}`; `priceType` regular/promotion/member. If you
>   can't read it, set `status: "unresolved"` with a reason and `priceDkk: null`. Never guess.
> - `promotions`: signs and wobblers; `displays`: secondary displays.
> - `box`: `[x, y, width, height]` as fractions 0–1 of the photo from the top-left. Use null if
>   unsure.
> - `score`: your own confidence 0–1.

Full example: [`photo-result.example.json`](copilot-studio/photo-result.example.json).
Shelfwise's tests check that this example is accepted.

**Field reference**

| Field                                       | Values                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `usable`                                    | boolean                                                                                                |
| `locationType`                              | `shelf` · `cooler` · `display` · null                                                                  |
| `issues[]`                                  | `blurry` `glare` `reflection` `too-dark` `obstructed` `low-resolution` `not-a-shelf`                   |
| `facings[].status`                          | `matched` · `candidate` · `unknown`                                                                    |
| `facings[].category`                        | `beer` `soft-drinks` `water` `energy-functional` `rtd-cider` `other` · null                            |
| `facings[].count`                           | 1–60 (identical adjacent facings)                                                                      |
| `priceLabels[].status` / `unresolvedReason` | `resolved` · `unresolved` / `unreadable` `ambiguous-product` `ambiguous-condition` `partially-visible` |
| `priceLabels[].priceType`                   | `regular` `promotion` `member` `unknown`                                                               |
| `promotions[].mechanic`                     | `multibuy` `price-cut` `member-price` `bundle` `other`                                                 |

Shelfwise is lenient. An invalid field becomes unknown or empty rather than failing the photo.
An unreadable reply is retried twice, then that photo is reported as "could not be analysed".

## 4. Facts we need from you

- Tenant ID and client ID (section 1), and the direct-connect URL if it changes.
- Environment type (production vs trial/developer) and billing (message packs or
  pay-as-you-go). Copilot Studio quotas per environment: **50 AI requests/min and
  1,000/hour** with 1–10 message packs, and **10/min and 200/hour on trial/developer
  environments** (about 2 visits of 10 photos per hour). Each photo is about one request.
- Region (EU?), DLP policies, and how long conversation transcripts are kept. Transcripts,
  including the photos, are stored in the environment's Dataverse.
- One sample reply for a test photo, so we can check it before testers start.

## 5. How Shelfwise is switched over

Set these build variables (public IDs only, no secrets): GitHub repository **Variables** for
Pages, or `.env` for Docker.

```sh
VITE_ANALYSIS_PROVIDER=copilot-studio
VITE_CS_DIRECT_CONNECT_URL=https://<env>.environment.api.powerplatform.com/copilotstudio/agenticruntime/3p/dataverse-backed/authenticated/bots/<schema-name>/conversations?api-version=2022-03-01-preview
VITE_CS_TENANT_ID=<tenant id>
VITE_CS_CLIENT_ID=<application (client) id>
```

Testers then open the user menu (top right), choose **Log ind med Microsoft**, and analyse
visits as usual. Mock analysis remains the default when these aren't set.
