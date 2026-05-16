# Deployment

The app itself ships as static files via GitHub Pages
(`.github/workflows/deploy.yml`). The Firestore rules that protect
per-user cloud sync are deployed separately, by hand, with the Firebase
CLI.

## Static site

GitHub Pages publishes the repo root on every push to `main`. No extra
step is required — the workflow uploads the working tree as-is.

## Firestore security rules

The repository keeps its rules in [`firestore.rules`](./firestore.rules).
The file restricts read/write on `/users/{uid}` to the matching
authenticated UID:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### One-time setup

```sh
npm install -g firebase-tools
firebase login
firebase use <your-firebase-project-id>
```

If `firebase.json` is not yet present, create one that points at the
rules file:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

### Deploy the rules

Run this whenever `firestore.rules` changes, before sharing the app:

```sh
firebase deploy --only firestore:rules
```

Skipping this step leaves the project on Firebase's default rules
(typically full-open *test mode* or full-closed), either of which is
incompatible with the per-user cloud sync model used by the PWA.
