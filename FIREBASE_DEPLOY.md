# Kantho Studio — Firebase Hosting + Cloud Run Deployment

This repository contains a Vite/React frontend and an Express/Node.js API server.
Firebase Hosting serves the built frontend. Requests under `/api/**` are rewritten
to the Cloud Run service `kantho-studio-api` in `asia-south1`.

## Important deployment notes

- Cloud Run is required for the Express API. Firebase Hosting alone cannot run `server.ts`.
- Cloud Run requires a billing account attached to the Google Cloud/Firebase project (Blaze plan).
- Firebase Hosting rewrites to Cloud Run have a 60-second Hosting request timeout. Long TTS jobs can therefore return 504 through the Hosting URL even if Cloud Run itself allows a longer timeout.
- The current application stores generated MP3 files and generation history in the local `.data` directory. Cloud Run's local filesystem is not durable across instance replacement or scale-out. This first deployment is suitable for a deployment smoke test, but persistent production history/audio requires migrating `.data` to Cloud Storage and Firestore before relying on it.
- Never commit `.env`, API keys, service-account JSON files, or generated audio.

## 1. Create/select a Firebase project

1. Open https://console.firebase.google.com/
2. Create a project or select an existing one.
3. Upgrade the project to the Blaze plan and attach a billing account.
4. Copy the Firebase/Google Cloud **Project ID** (not the display name).

## 2. Install and sign in to the CLIs

Install Node.js 20.19+ (or a compatible newer LTS), Firebase CLI, and Google Cloud CLI.

PowerShell:

```powershell
npm install -g firebase-tools
firebase login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with the actual project ID.

## 3. Enable required Google Cloud APIs

Run in PowerShell:

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project YOUR_PROJECT_ID
```

## 4. Create API secrets

In Google Cloud Console, open **Security > Secret Manager**.

Create these two secrets and add one secret version to each:

- Secret name: `elevenlabs-api-key` — value: your ElevenLabs API key
- Secret name: `gemini-api-key` — value: your Gemini API key

Do not put either key in frontend environment variables or commit them to GitHub.

Before deployment, grant the Cloud Run runtime service account the **Secret Manager Secret Accessor** role for both secrets. You can do this on each secret's Permissions panel. If deploying for the first time, deploy once, identify the service's runtime service account in Cloud Run, grant the role, then redeploy.

## 5. Deploy the Express API to Cloud Run

Open PowerShell in the repository root (the folder containing `package.json` and `server.ts`).

```powershell
gcloud run deploy kantho-studio-api --source . --region asia-south1 --allow-unauthenticated --set-secrets ELEVENLABS_API_KEY=elevenlabs-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest --memory 1Gi --cpu 1 --timeout 300 --max-instances 3 --project YOUR_PROJECT_ID
```

When prompted, allow Google Cloud to enable required services and create the Artifact Registry repository.

The build uses:
- `npm run build`: Vite builds `dist/`, then esbuild bundles the Express entry point to `server.js`.
- `npm start`: runs `node server.js`.
- The server listens on Cloud Run's `PORT` environment variable (defaults to 8080 locally).

After deployment, confirm that Cloud Run shows the service as **Ready**. Copy its service URL and test:

```
https://YOUR_CLOUD_RUN_URL/api/config/status
```

The response should show `elevenlabsConfigured: true` and `geminiConfigured: true` (if both secrets and permissions are configured).

## 6. Deploy Firebase Hosting

The committed `firebase.json` serves `dist/` and rewrites `/api/**` to the Cloud Run service in `asia-south1`.

From the repository root:

```powershell
npm install
npm run build
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

Firebase will publish the app to:

- `https://YOUR_PROJECT_ID.web.app`
- `https://YOUR_PROJECT_ID.firebaseapp.com`

No custom domain is required.

## 7. Smoke-test the deployed app

1. Open the `web.app` URL.
2. Confirm the API setup warning does not appear.
3. Open Voice Library and confirm account voices load.
4. Generate a short Bengali sentence first.
5. Play and download the MP3.
6. Confirm Generation History loads.

Also test the API directly at `https://YOUR_PROJECT_ID.web.app/api/config/status`.

## 8. Updating the app

After pushing code changes to GitHub, pull the latest code locally and redeploy the backend and frontend:

```powershell
gcloud run deploy kantho-studio-api --source . --region asia-south1 --allow-unauthenticated --set-secrets ELEVENLABS_API_KEY=elevenlabs-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest --memory 1Gi --cpu 1 --timeout 300 --max-instances 3 --project YOUR_PROJECT_ID
npm run build
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

## Troubleshooting

- **Cloud Run build fails:** Check that Node.js 20.19+ is selected and inspect Cloud Build logs.
- **Secret access denied:** Grant the Cloud Run runtime service account Secret Manager Secret Accessor on both secrets, then redeploy.
- **Hosting API returns 404:** Verify Cloud Run service name is exactly `kantho-studio-api`, region is exactly `asia-south1`, and redeploy Hosting.
- **Hosting API returns 502/504:** Check Cloud Run logs. Hosting-to-Cloud-Run rewrites have a 60-second request timeout; use shorter text chunks or move long-running synthesis to an asynchronous job workflow.
- **History/audio disappears:** This is the current local `.data` storage limitation. Migrate generated audio to Cloud Storage and history to Firestore for durable production storage.
