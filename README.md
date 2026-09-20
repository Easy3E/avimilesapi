# AviMiles Flight Bridge

This package DOES NOT replace or modify the submitted Roblox OAuth endpoints.

## Vercel
Copy only `vercel_additions/api/flight/` into the existing project's `api/flight/` folder.
Do not change `api/start.js`, `api/callback.js`, or `api/_common.js`.

Add Vercel environment variables:
- `AVIMILES_FLIGHT_BRIDGE_SECRET` = a new long random secret
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` = an Upstash Redis database

Existing OAuth environment variables remain unchanged.

## RRHosting
- Replace current `api.py` with `rrhosting/api.py`.
- Add `rrhosting/roblox_bridge_worker.py`.
- Add to `.env1`:
  AVIMILES_FLIGHT_BRIDGE_URL=https://avimiles-auth.vercel.app
  AVIMILES_FLIGHT_BRIDGE_SECRET=<same new secret as Vercel>
  AVIMILES_FLIGHT_BRIDGE_POLL_SECONDS=2
- Add the worker to loader.py alongside api.py and avitech.py.

## Bridge protocol
Roblox POSTs to `/api/flight/request`, then polls `/api/flight/result`.
Actions: `me`, `flights`, `start`, `attendance`, `end`.

The airline's API key is encrypted before it is placed into Redis.
Queued requests/results expire after five minutes.
