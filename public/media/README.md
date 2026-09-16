# Production media — EMPTY ON PURPOSE

The authentic D Festival performance recording **has not been supplied to this
implementation** and is not in this repository.

The background video linked in the task brief lives on Google Drive
(`drive.google.com`), which this build environment's network policy blocks
(the proxy returned HTTP 403 to `CONNECT drive.google.com:443`). The file could
not be downloaded, inspected, or encoded here.

Nothing has been invented in its place: `src/entrance/mediaConfig.js` has
`master.src = null`, and no filename in this repository is presented as
existing production footage.

## What still needs to be supplied

| Asset | Required? | Notes |
|---|---|---|
| Clean landscape master | **Yes** | One master covers every viewport via `object-fit: cover` |
| Matching poster frame | **Yes** | Must be a frame from the same footage, same crop alignment |
| Approved portrait edit | Optional | Improves composition only; absence falls back to the master |
| Crop-alignment preferences | **Yes**, after previews | Currently `50% 50%` everywhere — an untuned default, not a decision |
| Official D mark | Optional | The final reveal uses a plain typographic D unless a mark is approved |
| Licensed font files | Optional | No webfonts are loaded; the display stack falls back to a system serif |

Exported sources must exclude phone UI, screen-recording indicators and
baked-in black bars. CSS cannot reconstruct image content hidden by bars
embedded in the asset itself. Preserve the original when making compressed or
cropped derivatives, and obtain approval for any editorial crop that changes
the composition.

## Wiring it up

Drop the files in this directory and set the paths in
`src/entrance/mediaConfig.js`. No other change is needed — the layout, scenes,
gestures, accessibility and fallbacks are already in place and tested against
synthetic fixtures.
