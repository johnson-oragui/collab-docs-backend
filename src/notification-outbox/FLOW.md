### End-to-End Flow

1. **Create (`POST /`) or Publish (`POST /:notificationId/publish`):**

- **Draft creation:** Creates `NotificationEntity` with `status = DRAFT`, `publishedAt = null`, and `draftExpiresAt` set for retention cleanup. No `NotificationRecipientEntity` or `NotificationOutboxEntity` rows exist yet.
- **Immediate publish on create (when requested with `PUBLISHED` status) or explicit publish transition:** Runs inside a database transaction (`dataSource.transaction`), acquires a pessimistic write lock on the notification row (`409 Conflict` if already published or locked by a concurrent publish), validates active recipients for the target organisation/scope (`OrganisationMembershipEntity` / `UserEntity`), and revalidates membership eligibility at publish time.
- **Immutable state & atomic outbox creation:** Marks the notification immutable (`status = PUBLISHED`, `publishedAt = now`, clears `draftExpiresAt`), inserts `NotificationRecipientEntity` rows for eligible memberships, and inserts `NotificationOutboxEntity` rows (`status = PENDING`, `attempts = 0`, `nextAttemptAt = now`, `dispatchedAt = null`, `lastError = null`, `recipientMembershipId`, `eventType`) inside that same transaction.

2. **Outbox Claim & Dispatch (`NotificationOutboxDispatcherService`):**

- Acquires Redis lock `lock:notifications:dispatch-outbox` (`SET ... NX PX`).
- Inside a transaction, selects due `NotificationOutboxEntity` rows where `status` is eligible (`PENDING` or `FAILED` with `nextAttemptAt <= now` and `attempts < MAX_ATTEMPTS`), ordered by `nextAttemptAt ASC`, `createdAt ASC`, up to `BATCH_SIZE`.
- Marks claimed rows so concurrent sweeps do not re-select them, emits `NOTIFICATION_DELIVERY_EVENT` (`NotificationDeliveryPayload` containing `outboxId`, `notificationId`, `organisationId`, `recipientMembershipId`, `eventType`, and `attempt`), and updates status:
- **Success:** Sets `status = SENT` (or your dispatched enum), `attempts = nextAttempt`, `dispatchedAt = now`, `lastError = null`.
- **Failure:** Increments `attempts`, computes exponential backoff for `nextAttemptAt`, records `lastError`, and sets `status = FAILED` (or `DEAD_LETTER` once `MAX_ATTEMPTS` is reached).

3. **Real-Time Delivery Worker & Socket.IO Membership Room:**

- A delivery listener (`NotificationDeliveryWorker`) receives `NOTIFICATION_DELIVERY_EVENT` with `recipientMembershipId` and `eventType` and pushes the event into the target membership room (e.g., `membership:${event.recipientMembershipId}`).
- If room delivery fails or throws, the dispatcher catches the error, increments `attempts`, and schedules `nextAttemptAt` for retry.

### Flow Summary Table

| Stage                   | Primary Actor / Service                            | State & Side Effects                                                                                                                                                   | Failure / Guard Behavior                                                                          |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **1. Create / Publish** | Notification Service + Transaction                 | Sets `PUBLISHED` + `publishedAt`; revalidates active recipients; creates `NotificationRecipientEntity` & `NotificationOutboxEntity` (`PENDING`, `nextAttemptAt = now`) | `409` on concurrent/duplicate publish; immutable once `PUBLISHED`; rolls back on error            |
| **2. Outbox Dispatch**  | `NotificationOutboxDispatcherService` + Redis Lock | Acquires `lock:notifications:dispatch-outbox`; claims due batch (`nextAttemptAt <= now`); emits `NOTIFICATION_DELIVERY_EVENT`                                          | Skips if lock held; updates `dispatchedAt` on success or `nextAttemptAt` + `lastError` on failure |
| **3. Room Delivery**    | `NotificationDeliveryWorker` + Socket.IO Gateway   | Emits real-time event to room keyed by `recipientMembershipId`                                                                                                         | Throws/bubbles to trigger retry backoff until `MAX_ATTEMPTS`                                      |
