# Elexon source verification

Checked on 28 October 2026 against [official OpenAPI](https://data.elexon.co.uk/swagger/v1/swagger.json), [Elexon API portal](https://developer.data.elexon.co.uk/), and direct successful requests to `https://data.elexon.co.uk/bmrs/api/v1`.

- `GET /datasets/WINDFOR/stream` accepts `publishDateTimeFrom` and `publishDateTimeTo`; returns a JSON array with `dataset`, `startTime`, `publishTime`, and `generation`.
- `GET /datasets/FUELHH/stream` accepts the same publication window parameters; also supports settlement-date and fuel-type filters. We retrieve the publication stream and filter `WIND` locally to test and preserve a consistent normalization path.
- Both stream responses are full arrays, without a paginated envelope or a continuation token. Daily windows bound response sizes. Adjacent windows can repeat inclusive publication boundaries, handled by source keys.
- FUELHH is average MW over half-hour settlement intervals, confirmed in its official schema description and [Elexon's glossary](https://www.elexon.co.uk/bsc/glossary/half-hourly-generation-by-fuel-type/).
- WINDFOR uses MW, described by the [official API portal](https://developer.data.elexon.co.uk/) for the wind forecast endpoint. The stream records themselves do not repeat the unit field.
- Actual observed responses have explicit `Z` timestamps. The app rejects source timestamps without a timezone and normalizes timezone-aware offsets to UTC.
- Forecast publication dates and delivery dates differ. In the retrieved January history WINDFOR has hourly delivery starts and multiple publication versions, including post-delivery publications. These versions must not replace earlier forecasts in retrospective decision-time evaluation.

Reproducible probes (URL-encode query values as required by your shell/client):

```text
/datasets/WINDFOR/stream?publishDateTimeFrom=2025-12-31T00:00:00Z&publishDateTimeTo=2026-01-01T00:00:00Z
/datasets/FUELHH/stream?publishDateTimeFrom=2026-01-01T00:00:00Z&publishDateTimeTo=2026-01-02T00:00:00Z
```

The first probe returned 584 forecast versions across eight publications with 73 hourly delivery starts each. The second returned 980 all-fuel records before WIND and delivery-window filtering. This is evidence for the observed behavior; the app does not hard-code those per-request counts.

The complete snapshot retrieval spans 73 daily windows: 40 WINDFOR windows from 25 December to 3 February exclusive, and 33 FUELHH windows from 1 January to 3 February exclusive. Records are subsequently constrained to January delivery. A 7-day pre-January forecast buffer exceeds the inspected 72-hour delivery horizon. This does not promise arbitrary historical publications or corrections outside the bounded retrieval window.

The 11:00 previous-day cutoff is an explicit prototype assumption. No official trading rule is asserted. Elexon provides GB operational metering and forecasts for visible generation; actual and forecast source coverage can differ and should be considered when interpreting bias.
