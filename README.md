# Deer Valley Driving School Availability API

This project exposes a Vercel serverless function at [`/api/availability`](./api/availability.js) for querying lesson availability from two Acuity Scheduling accounts.

## Verifying the Production Deployment on Vercel

Follow these steps inside the Vercel dashboard to make sure the API route is deployed and returning data in production.

1. **Confirm the repository layout**
   - Open the Git repository and ensure there is a top-level `api/` directory that contains `availability.js`.
   - The path should be exactly `api/availability.js` (not nested inside another folder).
2. **Check the project settings**
   - In Vercel, open the project and navigate to **Settings → General → Project Settings**.
   - Ensure the **Root Directory** field is set to `/` so the `api/` folder is included in builds.
3. **Deploy to production**
   - Go to the **Deployments** tab.
   - If the latest deployment is a preview, open it and click **Promote to Production** so that the `main` domain uses the latest build.
4. **Verify the function output**
   - Visit `https://dvds-availability.vercel.app/api/availability`.
   - Confirm the response is JSON and, if using a placeholder handler, that it returns `{ "ok": true }`.
   - After verifying, redeploy with the full Acuity integration code so the endpoint returns live availability data.

These steps ensure that Vercel detects the serverless function and serves it from the production domain.
