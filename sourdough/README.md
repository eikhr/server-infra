# Sourdough calculator

Live: https://www.eikhr.no/sourdough/

Original calculator from Downloads, bundled with React, Vite and Tailwind CSS.

From `/home/eik/server-infra`, deploy changes with:

```sh
docker compose up -d --build --no-deps sourdough
```

Dependencies are locked in package-lock.json. For local development: `npm ci && npm run dev`.
