# DVDs Availability API

Production deployment: https://dvds-availability.vercel.app/

## Endpoints

- [`GET /api/ping`](https://dvds-availability.vercel.app/api/ping) – health check returning `{ "ok": true, "message": "pong" }`.
- [`GET /api/zip-route?zip=85254`](https://dvds-availability.vercel.app/api/zip-route?zip=85254) – resolve a ZIP code to the nearest city calendar, appointment type, and live calendar ID via Acuity.
- [`GET /api/calendars`](https://dvds-availability.vercel.app/api/calendars) – proxy to Acuity calendars for the main account (`?account=parents` switches credentials).
- [`GET /api/availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23`](https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778&date=2025-10-23) – fetch availability for a city using the resolved calendar ID (omit `date` to default to the current day in America/Phoenix).

All endpoints are zero-config Vercel serverless functions designed for use by the Deer Valley Driving School frontend. Calendars are discovered at runtime so deployments stay in sync with Acuity without manual ID updates.
