# Case study: honest connection feedback

## Problem

The board previously changed local state before checking whether a WebSocket message could be sent. A user dragging a card while disconnected could see a new position even though the server never received the move. Some edits also sent network messages from inside React state updater functions, which should remain free of side effects.

## Change

- Check connection readiness and send before applying optimistic state.
- Pause mutations until a newly connected socket has fetched the board.
- Show a persistent connection banner and a clear error for unsent changes.
- Refresh server state after a rejected mutation and after reconnection.
- Move card-edit sends outside React state updaters.
- Reject failed or missing-row database updates for card moves before broadcasting success.
- Offer an independent sample board through the guest demo. Create board, cards and owner membership in one database transaction.

## Trade-offs

The UI stays responsive after a successful local send, but that is not a durable save acknowledgement. A connection can fail after sending, and a server snapshot can overlap newer events. There is no offline queue or guaranteed conflict resolution. A future protocol could include mutation IDs, explicit acknowledgements, revisions and replay rules. These are future work, not implemented guarantees.

## Manual demo checks

1. Open the home page and choose **Try a demo — no sign-up**. Confirm five cards and two swimlanes appear.
2. Open the board in a second tab. Move a card and confirm both views converge.
3. Disconnect the WebSocket (or stop the backend and wait for the disconnect banner). Try moving/deleting a card: its board state must not change and an error should explain why.
4. Restore the connection. Confirm server data reloads before edits are enabled.
5. With viewer access, verify that rejected edits do not remain on screen.
6. Repeat demo creation in another session. Confirm it receives a different board ID.

Automated tests use mocked browser sockets and an in-memory backend database; they do not replace a complete deployed-browser test.

## Validation performed

- Frontend: 6 regression tests passed, TypeScript check passed, production build passed.
- Backend: `go test ./...` passed, including demo independence and transaction rollback.
- Local browser: guest demo opened with five cards and two swimlanes; a dragged card updated both tabs; stopping the backend displayed the connection warning; restarting restored Connected status.
- Public deployment, Google OAuth, Docker startup and a full mobile audit were not exercised in this change.

## Interview practice

Explain these from the code rather than memorizing answers:

- How does a card move travel from the UI to another browser?
- Why is optimistic UI useful, and when can it mislead users?
- How do local state, WebSocket events and durable database state differ?
- Why does a demo board use a transaction?
- What would need to change to support durable offline edits?

Describe AI assistance honestly. Claim personal debugging, testing or design work only after you have performed and can explain it yourself.
