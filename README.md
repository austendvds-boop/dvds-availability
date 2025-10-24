# DVDs Availability API

Production deployment: https://dvds-availability.vercel.app/

## Endpoints

- [`GET /api/ping`](https://dvds-availability.vercel.app/api/ping) – health check returning `{ "ok": true, "message": "pong" }`.
- [`GET /api/zip-route?zip=85254`](https://dvds-availability.vercel.app/api/zip-route?zip=85254) – resolve a ZIP code to the nearest city calendar and appointment type.
- [`GET /api/calendars`](https://dvds-availability.vercel.app/api/calendars) – list of city calendars and their `appointmentTypeId` values.
- [`GET /api/availability?location=scottsdale&appointmentTypeId=50529778`](https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778) – proxy to Acuity Scheduling availability with dual-account support.

All endpoints are zero-config Vercel serverless functions designed for use by the Deer Valley Driving School frontend.
