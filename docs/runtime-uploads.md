# Runtime Uploads

This app currently uses local runtime upload folders for files that are created while the POS is running.

## Runtime folders

- `public/uploads/products` for product images uploaded from product management.
- `public/uploads/qris` for legacy/local QRIS image files.
- `public/uploads/payment-proofs` for legacy/local payment proof files.

## Git hygiene

Do not commit user-uploaded files from these folders. Keep only `.gitkeep` files so the runtime folders exist in fresh deployments.

## VPS deployment notes

On VPS deployments, these upload folders must persist across deploys and should be included in server backup routines. Avoid deployment steps that delete or overwrite `public/uploads/*` runtime content.

If deployment replaces the whole app directory, move runtime uploads to a persistent shared directory and symlink or mount it back into `public/uploads`.
