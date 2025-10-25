# DVDs Availability API

Production: https://dvds-availability.vercel.app/

This repo exposes zero-config Vercel serverless functions for Deer Valley Driving School. All handlers run on Node.js 20 and rely on Acuity Scheduling credentials that must be configured as environment variables in Vercel (`ACUITY_MAIN_USER_ID`, `ACUITY_MAIN_API_KEY`, `ACUITY_PARENTS_USER_ID`, `ACUITY_PARENTS_API_KEY`, and optionally aliases `ACUITY_USER_ID`, `ACUITY_API_KEY`). The default timezone is `America/Phoenix` (override with `TZ_DEFAULT`).

## Endpoints

- [`GET /api/ping`](https://dvds-availability.vercel.app/api/ping) – Health check.
- [`GET /api/calendars?account=main`](https://dvds-availability.vercel.app/api/calendars?account=main) – Cached pass-through to Acuity calendars (`?account=parents` for the second tenant).
- [`GET /api/appointment-types?account=main`](https://dvds-availability.vercel.app/api/appointment-types?account=main) – Lists appointment types for the requested account.
- [`GET /api/zip-route?zip=85254`](https://dvds-availability.vercel.app/api/zip-route?zip=85254) – Resolves an Arizona ZIP to the canonical location, account, appointment type, and cached calendar ID.
- [`GET /api/availability?location=scottsdale&appointmentTypeId=50529778`](https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778) – Fetches availability, defaulting the date to “today” in America/Phoenix. Supply `calendarID` directly if you already have the numeric ID, or add `account=parents` to force the parents account.
- [`GET /api/location-availability?location=scottsdale&appointmentTypeId=50529778&days=2`](https://dvds-availability.vercel.app/api/location-availability?location=scottsdale&appointmentTypeId=50529778&days=2) – Pools multiple calendars for a single location, merging slots across instructors for up to 7 consecutive days. Accepts `account`, `calendarID`, `date` (defaults to today), and `days` (1–7).

Every response includes `requestId` for easier log correlation. CORS allows the production domains (`www.deervalleydrivingschool.com` and `dvds-availability.vercel.app`).

## Maintaining calendar IDs

`api/availability.js` stores a `CALENDAR_IDS` map for each account. Populate those numeric IDs by calling `/api/calendars` in production and copying the returned `id` values into the map. When a value is `null`, the handler falls back to live calendar lookups and caches the results in memory.

`api/zip-route.js` exposes `LOCATION_CONFIG`, which now includes a `calendars` array for every location. Add each instructor’s calendar name or numeric ID to that array to enable pooled lookups in `/api/location-availability`.

## Manual verification

1. Ensure all required environment variables exist in Vercel (Production + Preview).
2. Call `/api/calendars?account=main` and `/api/calendars?account=parents` to confirm both credentials return JSON with numeric `id` values.
3. Call `/api/appointment-types?account=main` and make sure appointment type `50529778` exists.
4. Fetch availability with both calendar ID and location resolution, e.g.

   ```bash
   curl "https://dvds-availability.vercel.app/api/availability?account=main&calendarID=<ID>&appointmentTypeId=50529778&date=2025-10-23"
   curl "https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23"
   curl "https://dvds-availability.vercel.app/api/location-availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23&days=3"
   ```

5. Use the returned `requestId` to trace requests in Vercel logs if Acuity responds with non-200 status codes.
