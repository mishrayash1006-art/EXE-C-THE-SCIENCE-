# Security Specification & Dirty Dozen Payloads

## Data Invariants
1. Every document in `users/{userId}` may only be read or written by the authenticated user whose `request.auth.uid == userId` (or a verified admin). Users cannot self-assign `role` or `isAdmin`.
2. Every document in `simulation_backups/{backupId}` and `simulation_cases/{caseId}` must enforce `ownerId == request.auth.uid` on create, immutable `ownerId` and `createdAt` on update, and `resource.data.ownerId == request.auth.uid` on read/list/delete.
3. All timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
4. All document IDs (`userId`, `backupId`, `caseId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `size() <= 128`).
5. All string fields enforce explicit `.size()` bounds; `keys().hasAll(...)` and `keys().hasOnly(...)` block shadow fields.
6. Write operations require verified email (`request.auth.token.email_verified == true`).

## Dirty Dozen Adversarial Payloads
1. Unauthenticated read/write to `/simulation_backups/b1` -> PERMISSION_DENIED.
2. Spoofed `ownerId` on create (`/simulation_backups/b1` with `ownerId: "victim_uid"`) -> PERMISSION_DENIED.
3. Shadow field injection (`isAdmin: true` or `role: "admin"` on `/users/{uid}`) -> PERMISSION_DENIED.
4. Unverified email (`email_verified: false`) attempting create/update -> PERMISSION_DENIED.
5. Client-forged timestamp (`createdAt` != `request.time`) -> PERMISSION_DENIED.
6. Immutable field mutation (`ownerId` or `createdAt` altered during update) -> PERMISSION_DENIED.
7. Oversized `ciphertext` (> 65536 chars) DoS payload -> PERMISSION_DENIED.
8. Invalid path ID poisoning (`/simulation_backups/bad$id..hack`) -> PERMISSION_DENIED.
9. Blanket collection `list` query without `where("ownerId", "==", uid)` -> PERMISSION_DENIED.
10. Cross-user `get` on another user's `/simulation_backups/{id}` -> PERMISSION_DENIED.
11. Wrong `algorithm` enum (`"NONE"` instead of `"AES-256-GCM"`) -> PERMISSION_DENIED.
12. Value poisoning on update (`title: 12345` or empty string) -> PERMISSION_DENIED.
