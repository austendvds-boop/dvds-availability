# DVDs Availability API

Production deployment: https://dvds-availability.vercel.app/

## Endpoints

- [`GET /api/ping`](https://dvds-availability.vercel.app/api/ping) – health check returning `{ "ok": true, "message": "pong" }`.
- [`GET /api/zip-route?zip=85254`](https://dvds-availability.vercel.app/api/zip-route?zip=85254) – resolve an Arizona ZIP to the nearest city calendar, appointment type, and cached calendar ID.
- [`GET /api/calendars`](https://dvds-availability.vercel.app/api/calendars) – proxy to Acuity calendars for the main account (`?account=parents` switches credentials).
- [`GET /api/availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23`](https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23) – fetch availability for a city using the stored calendar ID (omit `date` to default to the current day in America/Phoenix).

Calendar IDs live in `api/availability.js` under the `CALENDAR_IDS` map. Update those values after calling `/api/calendars` for each account so Acuity lookups do not require a network round-trip on every request. When a value is `null`, the API will fall back to resolving the calendar ID dynamically and cache the result in memory for subsequent requests.

All endpoints are zero-config Vercel serverless functions designed for the Deer Valley Driving School frontend.

## Troubleshooting & verification

1. Ensure the Acuity environment variables are present in Vercel (Preview + Production):
   - `ACUITY_MAIN_USER_ID`, `ACUITY_MAIN_API_KEY`
   - `ACUITY_PARENTS_USER_ID`, `ACUITY_PARENTS_API_KEY`
   - `TZ_DEFAULT` (defaults to `America/Phoenix` when omitted)
2. Call `/api/calendars` for each account and copy the numeric `id` values into `CALENDAR_IDS` inside `api/availability.js` so the router can return calendar IDs without a lookup.
3. Verify live availability from a terminal (replace placeholders as needed):

   ```bash
   curl -i "https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778"
   ```

   The response will include an `X-Request-Id` header; use that identifier when tailing Vercel logs if Acuity returns a non-200 response.

4. If a request fails, check the JSON payload for `requestId`, `error`, and (when applicable) `acuityStatus`, then open the matching serverless log entry in Vercel for more details.
