# Database package

`@one-router/db` owns libSQL access, schema migrations, encrypted repositories, and portable data archives. It is a server-side package and must not be imported by the browser app.

## Dependencies

- `@libsql/client` provides local SQLite and remote libSQL/Turso transports through the same client API; Node's SQLite modules do not support the remote deployment target.
- `drizzle-orm` provides typed SQLite queries and transaction support for the repositories.
- `drizzle-kit` generates versioned SQL migrations from the Drizzle schema; runtime migrations use the checked-in SQL files only.

## Database startup

Resolve and retain the 32-byte master key with `resolveMasterKey`, then pass it to `openDatabase` with a `file:` or supported libSQL URL. Local development creates `~/.one-router/encryption.key` with owner-only permissions when absent. Production startup must provide a key; it never creates a temporary production key. Run `migrate(db)` before `seedOwner(db)`, and close the database when the owning process shuts down.

The master key is required to read an existing database. Back it up separately in a protected secret store. Losing it makes encrypted fields and attachment bytes unrecoverable. Password changes do not rotate this key.

## Logical backup and restore

Create a portable encrypted backup with `exportArchive(db, ownerId, { passphrase })`. The archive contains the owner's providers, chats, messages, linked attachments, settings, and profile, but never password hashes or sessions. The archive passphrase is separate from the database master key. Keep both the archive and its passphrase in protected storage; an archive without its passphrase cannot be restored.

Before importing, call `previewArchive(bytes, passphrase)` to authenticate and validate the archive and inspect its record counts. Restore with `importArchive(db, ownerId, bytes, { mode: 'replace', passphrase })`. Replace mode changes only that owner's application data in one transaction; it preserves the target owner account, password, and sessions. Merge mode also imports all records and remaps their IDs. Both modes validate the full archive before writing and encrypt imported fields with the target database's master key.

Replace mode deletes existing external attachment metadata. Its result lists those objects in `externalAttachments`; delete the stored objects only after the import resolves, because a failed import rolls back and keeps their metadata. Imported attachments are always stored as encrypted SQLite BLOBs.

Plaintext export is a portability option, not a backup format for secrets: provider API keys and custom headers are omitted, and plaintext imports containing either field are rejected. Remote attachment stores require an explicit reader when exporting; keep the referenced object store available until the export completes.

For disaster recovery, provision an empty database, restore its master key, run migrations, bootstrap or select the target owner, then preview and import the encrypted archive. Verify representative chats and attachments before retiring the previous database. Raw database-file snapshots are not interchangeable with `.onerouter` archives and must be restored together with their matching master key.
