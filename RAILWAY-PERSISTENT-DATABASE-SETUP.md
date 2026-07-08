# Railway Persistent Database Setup

Use this before entering real admin/client/USDT data again.

## What changed

The server now supports a safe database folder using:

```text
DATA_DIR
```

If `DATA_DIR` is set, all private files are saved there instead of inside the uploaded website files.

Protected files include:

- `clients.json`
- `usdt-orders.json`
- `purchase-requests.jsonl`
- `users.json`
- `journal-entries.json`
- `auth-otps.json`
- `sessions.json`

## Railway steps

1. Open your Railway project.
2. Open the `tradeonix-academy` service.
3. Go to `Settings`.
4. Add a persistent volume.
5. Mount it to:

```text
/data
```

6. Go to `Variables`.
7. Add this variable:

```text
DATA_DIR=/data
```

8. Redeploy the service.

After this, admin records will be stored in the Railway volume and should not be replaced by GitHub uploads.

## Important

Do not upload the `outputs/data` folder to GitHub after real data is added. The project `.gitignore` now blocks these files, but avoid manually uploading them too.
