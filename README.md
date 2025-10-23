# DVDs Availability API

This project exposes three zero-config Vercel serverless endpoints for checking appointment availability.

## Endpoints

### `GET /api/ping`
Simple health check that returns `{ "ok": true, "message": "pong" }` so you can confirm the deployment is online.

### `GET /api/zip-route`
Provides ZIP-to-city and city-to-calendar routing information.

Examples:

- `https://dvds-availability.vercel.app/api/zip-route?zip=85254`
- `https://dvds-availability.vercel.app/api/zip-route?city=scottsdale`

### `GET /api/availability`
Proxies the Acuity Scheduling availability API using the configured credentials (`ACUITY_USER_ID` and `ACUITY_API_KEY`).

Required query parameters:

- `location` or `zip` – mapped to an internal calendar ID
- `appointmentTypeId` – forwarded to Acuity

Optional:

- `startDate` – YYYY-MM-DD formatted date to anchor the search window

Example:

```
https://dvds-availability.vercel.app/api/availability?location=scottsdale&appointmentTypeId=50529778
```

The response mirrors Acuity's JSON with additional routing metadata.
