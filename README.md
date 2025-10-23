# Deer Valley Driving School Availability API

This repository contains the Vercel serverless function that powers [`/api/availability`](./api/availability.js). The handler reads the Acuity Scheduling API and responds with grouped, sorted availability JSON for the Deer Valley Driving School sites.

## Step-by-step: get `/api/availability` working in production

The checklist below is written for someone who does **not** write code. Follow each step in order and the production URL <https://dvds-availability.vercel.app/api/availability> will return JSON.

1. **Confirm the file exists in the repository**
   1. Open your repository on GitHub (or the git provider you use).
   2. Look at the root folder — you should see an `api` folder next to `README.md`.
3. Click `api`, then click `availability.js`. If the file is missing, create it and paste the following temporary handler:
     ```js
     // /api/availability.js
     module.exports = (req, res) => {
       res.status(200).json({ ok: true, path: "/api/availability" });
     };
     ```
   4. Commit the change so Vercel can pick it up on the next deploy.

2. **Set the project root in Vercel**
   1. Log into Vercel and open the `dvds-availability` project.
   2. In the left sidebar choose **Settings**.
   3. Under **Project Settings → General → Build & Development Settings**, click **Edit** on the **Root Directory** row.
   4. Type `/` (a single forward slash), then click **Save**. This guarantees that the root of the repo — including the `api` folder — is deployed.
   5. In the same section, set **Framework Preset** to **Other** and leave **Output Directory** empty, then click **Save** again.

3. **Deploy and promote to production**
   1. Click **Deployments** in the left sidebar.
   2. Press **Deploy to Production** if the button is available. If the newest build is listed as *Preview*, click that deployment, then click **Promote to Production** in the top-right corner.
   3. Wait for the deployment status to change to **Ready**.

4. **Check that Vercel detected the function**
   1. Inside the project, open the **Functions** tab.
   2. You should see an entry named `api/availability` with the runtime `Node.js 20.x`. If it is missing, go back to Step 1 to verify the file path and commit.

5. **Test the live endpoint**
   1. Visit <https://dvds-availability.vercel.app/api/availability> in a browser.
   2. You should see JSON. If you kept the temporary handler, it will show `{ "ok": true, "path": "/api/availability" }`.

6. **Restore the full Acuity integration**
   1. Once the test JSON loads correctly, edit `api/availability.js` and replace the temporary handler with the full Acuity code already in this repository (the file currently contains the production handler).
   2. Commit the change and push.
   3. Back in Vercel, trigger another production deployment (repeat Step 4) so the live endpoint serves real availability data.

Following the checklist above ensures the production deployment always includes the `/api/availability` serverless function and returns JSON instead of a 404.
