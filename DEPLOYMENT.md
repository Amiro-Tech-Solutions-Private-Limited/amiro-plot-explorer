# Deploy to Netlify

This application is a static React + Vite site. No backend or environment variables are required.

1. In Netlify, choose **Add new project** > **Import an existing project** > **GitHub**.
2. Select `Amiro-Tech-Solutions-Private-Limited/amiro-plot-explorer` and the `main` branch.
3. Leave the base directory empty. The repository's `netlify.toml` sets:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node.js: `24`
4. Choose **Deploy project**. Netlify will provide the live URL when the build finishes.

Future pushes to `main` trigger a new deployment when continuous deployment is enabled.
The `public/_redirects` file is copied into `dist` and supports single-page app routing.

## Verify locally

```sh
npm ci
npm run build
npm run preview
```

## Manual deployment

For a deployment without connecting GitHub, build locally and upload the contents of
`dist` at https://app.netlify.com/drop. Subsequent updates require another upload.
