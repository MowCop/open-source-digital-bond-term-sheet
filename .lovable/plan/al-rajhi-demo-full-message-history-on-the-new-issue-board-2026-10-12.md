# Al Rajhi demo: full message history on the New Issue Board

## What you'll see
- The demo deal (Al Rajhi Bank Tier 2 Social Sukuk) shows all four syndicate updates on the New Issue Board straight away, oldest first:
  - 1.1 IPTs T+200bps area: 3 Sep 2026, 08:49 UTC, with the Offering Circular and Supplement attached
  - 2.0 Books over $1.6bn: 10:30 UTC
  - 3.0 Launched, $600mn at T+170: 12:15 UTC
  - 4.0 Priced, 6.232%: 15:40 UTC
- Each update shows the full original text from the Word files, including the bank's legal footer.
- The saved term sheet stages (IPT, Guidance, Launch, Priced) are dated to the same times, so the board and the Digital Term Sheet history match. The Announcement stage keeps the deal's start time.
- **Next message** no longer posts anything to the deal chat. It still moves the deal's stage and shows suggested values in Fill for you to review.
- The chat stays as it is for now. Changes to it come in a later update.
- The existing Al Rajhi Sukuk Limited deal is not changed.

## Technical details
- `src/data/alRajhiDemo.ts`: each step's `body` becomes the full verbatim text read from `reference/al-rajhi-tier2/*.txt`, footer included. The `sentAt` values are unchanged.
- A new `seedDemoBoard(app, deal)` in `AlRajhiDemoPanel.tsx` creates one sent message per step via the normal message path: `status: 'sent'`, `sentAt` and `createdAt` set to the step time, `dealIds` = demo deal, the PDFs attached on 1.1, and `bulletinSource: 'manual'`. It skips any step that is already on the board, so nothing gets duplicated. It runs inside `setupAlRajhiDemo`, and once now for the existing demo deal.
- Snapshot inserts set `released_at` from each step's `sentAt`. The existing demo releases are updated to the same times.
- `playNext` drops the `sendChatMessage` call. Reset stops resetting the chat but still resets the stage and the replay position.
- Check that the board sorts these by `sentAt` (oldest first within the deal). If it sorts by another field, fix that ordering.
- Update the `reference/al-rajhi-tier2/README.md` and `mem://reference/al-rajhi-demo` notes. Then check the board and the stage history in the preview.
