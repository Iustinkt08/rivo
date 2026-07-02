# gunoi/ — quarantined dead code

Files moved here are **not referenced anywhere** in the codebase (verified by import-graph
scan on 2026-06-14). They are kept (not deleted) so they can be restored if needed.
Original paths are preserved under this folder. Nothing here is compiled by either app's
build (this folder is a sibling of `apps/`, outside every `tsconfig` rootDir).

| Moved file (original path) | Reason |
|---|---|
| `apps/backend/src/modules/firebase/firebase.module.ts` | Never imported in `app.module.ts`. Auth uses Supabase (jose), not Firebase. |
| `apps/backend/src/modules/auth/guards/firebase-auth.guard.ts` | 0 importers. Replaced by `SupabaseAuthGuard` (the global `APP_GUARD`). Imported `FIREBASE_ADMIN` only from the dead firebase module. |
| `apps/mobile/src/components/client/FloatingTabBar.tsx` | 0 importers. |
| `apps/mobile/src/components/common/Input.tsx` | 0 importers. Forms use native `TextInput`. |
| `apps/mobile/src/screens/client/SalonProfileScreen.tsx` | 0 importers. Superseded by `SalonDetailScreen`. |
| `apps/mobile/src/types/index.ts` | Orphan: re-exported `./navigation`, `./models`, `./api` which don't exist; 0 importers. |

## To restore a file
Move it back to its original path (shown in the table) and re-wire imports.

## To delete permanently
Once you're confident nothing here is needed, `rm -rf gunoi/`.

## Follow-up (not done here)
- `firebase-admin` in `apps/backend/package.json` is now only used by the quarantined
  files; it can be removed from dependencies once you confirm Firebase auth won't return.
