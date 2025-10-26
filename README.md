# DVDs Availability API

Production: https://dvds-availability.vercel.app/

This repo exposes zero-config Vercel serverless functions for Deer Valley Driving School. All handlers run on Node.js 20 and rely on Acuity Scheduling credentials that must be configured as environment variables in Vercel (`ACUITY_MAIN_USER_ID`, `ACUITY_MAIN_API_KEY`, `ACUITY_PARENTS_USER_ID`, `ACUITY_PARENTS_API_KEY`, and optionally aliases `ACUITY_USER_ID`, `ACUITY_API_KEY`). The default timezone is `America/Phoenix` (override with `TZ_DEFAULT`).

## Endpoints

- [`GET /api/ping`](https://dvds-availability.vercel.app/api/ping) – Health check.
- [`GET /api/locations`](https://dvds-availability.vercel.app/api/locations) – Ordered list of configured cities with the account + appointment type each location uses.
- [`GET /api/calendars?account=main`](https://dvds-availability.vercel.app/api/calendars?account=main) – Cached pass-through to Acuity calendars (`?account=parents` for the second tenant).
- [`GET /api/appointment-types?account=main`](https://dvds-availability.vercel.app/api/appointment-types?account=main) – Lists appointment types for the requested account.
- [`GET /api/zip-route?zip=85254`](https://dvds-availability.vercel.app/api/zip-route?zip=85254) – Resolves an Arizona ZIP to the canonical location, account, appointment type, and cached calendar ID.
- [`GET /api/availability?location=scottsdale&appointmentTypeId=53640646`](https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=53640646) – Fetches availability for a single calendar. Provide `calendarID` directly to bypass location resolution or add `account=parents` to force the parents account.
- [`GET /api/location-availability?location=scottsdale&appointmentTypeId=53640646&days=2`](https://dvds-availability.vercel.app/api/location-availability?location=scottsdale&appointmentTypeId=53640646&days=2) – Pools multiple calendars for a single location, merging slots across instructors for up to 7 consecutive days. Accepts `account`, `date` (defaults to today), and `days` (1–7).
- [`GET /api/month-availability?location=scottsdale&date=2025-10-01`](https://dvds-availability.vercel.app/api/month-availability?location=scottsdale&date=2025-10-01) – Returns a month-long map of pooled slot counts by day for the requested location.
- [`GET /api/resolve-location?location=scottsdale`](https://dvds-availability.vercel.app/api/resolve-location?location=scottsdale) – Diagnostics endpoint that reports which calendar identifiers are configured for a location, which calendars the appointment type allows, and the final strict intersection.
- [`GET /api/resolve-city?account=main&location=scottsdale`](https://dvds-availability.vercel.app/api/resolve-city?account=main&location=scottsdale) – Diagnostics endpoint that reveals the appointment type configured for a location and whether Acuity still exposes it for the chosen account.

CORS allows the production domains (`www.deervalleydrivingschool.com` and `dvds-availability.vercel.app`).

## Production UI (location-first)

The root [`index.html`](./index.html) is a lightweight dashboard:

1. The page fetches `/api/locations` and renders each configured city as a pill. Selecting a pill automatically sets the correct account and appointment type.
2. The **Fetch pooled availability** button queries `/api/location-availability`, showing merged instructor slots for the chosen date range.
3. Diagnostics underneath the controls surface the configured calendar IDs, Acuity’s allow list, and the final IDs the API will use. Buttons disable automatically if the strict configuration is incomplete.
4. The **Monthly availability** card calls `/api/month-availability` to paint a calendar heatmap. Clicking a day drills into that date’s live slots using the pooled endpoint.

If a city shows zero slots, verify the appointment type is enabled for the configured instructor calendars in Acuity (Appointments → Appointment Types → Calendars).

## Maintaining city mappings

### Step 1 – Update `city-types.json`

The root-level [`city-types.json`](./city-types.json) file maps each location to its default appointment type for both accounts. Use the IDs provided by the latest appointment type export (see “Manual verification”) and keep the keys lowercase. The UI and API automatically reference this map to select the correct appointment type whenever you choose a location.

### Step 2 – Capture live calendar IDs

1. Call `/api/calendars?account=main` and `/api/calendars?account=parents` in production. Copy the numeric `id` values for the instructor calendars that belong to each city.
2. Call `/api/appointment-types?account=main` and `/api/appointment-types?account=parents` to confirm the IDs configured in `city-types.json` still exist.

### Step 3 – Populate `location-config.json`

Update [`location-config.json`](./location-config.json) so each location lists the numeric calendar IDs that should be pooled. Example shape:

```json
{
  "main": {
    "scottsdale": [11494752, 11494760],
    "gilbert": [11494755]
  },
  "parents": {
    "anthem": [28722957]
  }
}
```

Each array must list the exact numeric instructor calendar IDs that belong to that city for the specified account. If an array is empty, the strict resolvers will return a helpful error and the UI buttons stay disabled until you populate it.

### Step 4 – Verify with diagnostics

After saving `location-config.json`, redeploy and call `/api/resolve-location?location=scottsdale`. The response highlights:

- `configuredIds` – the numeric IDs sourced directly from `location-config.json`
- `typeCalendarIds` – calendars Acuity says are enabled for the appointment type (if Acuity exposes that metadata)
- `intersection` – the final ID list after intersecting the strict config with the appointment type’s allow list
- `disallowed` – configured IDs that are currently not enabled for the appointment type (update the type in Acuity if you see values here)

The production UI surfaces the same diagnostics beneath the controls, so you can confirm the configuration without leaving the dashboard. The month view card underneath paints a calendar grid of pooled slot counts and lets you click a day to drill into the exact times using `/api/location-availability`.

## Troubleshooting 403 responses

Acuity returns `403 Forbidden` when an appointment type is not enabled for a specific instructor calendar. If you see this in API responses or the dashboard:

1. Open Acuity → **Appointments → Appointment Types** → select the relevant type (e.g. 53640646).
2. Scroll to the **Calendars** section and ensure every instructor calendar you want to pool is checked.
3. Save, wait a few seconds, then re-run the availability request.

The UI appends a reminder whenever a `403` response is returned.

## Manual verification checklist

1. Ensure all required environment variables exist in Vercel (Production + Preview).
2. Call `/api/calendars?account=main` and `/api/calendars?account=parents` to confirm both credentials return JSON with numeric `id` values.
3. Call `/api/appointment-types?account=main` and `/api/appointment-types?account=parents` to confirm the IDs listed in `city-types.json` are still valid.
4. Load the production dashboard, pick a location, and confirm the diagnostics show a non-empty final calendar list.
5. Fetch availability with both calendar ID and location resolution, e.g.

   ```bash
   curl "https://dvds-availability.vercel.app/api/availability?account=main&calendarID=<ID>&appointmentTypeId=53640646&date=2025-10-23"
   curl "https://dvds-availability.vercel.app/api/location-availability?location=scottsdale&appointmentTypeId=53640646&date=2025-10-23&days=3"
   curl "https://dvds-availability.vercel.app/api/month-availability?location=scottsdale&date=2025-10-01"
   ```

