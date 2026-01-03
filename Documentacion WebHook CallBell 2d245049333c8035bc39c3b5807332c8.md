# CallBell Webhook Events – Specification

## Overview

This document defines all webhook events emitted by the system.

Each event section follows a strict structure to allow programmatic consumption by AI agents.

### Global Assumptions

- All timestamps are ISO 8601 formatted.
- Events are immutable.
- Payload objects may evolve; consumers must tolerate additional fields.
- Events are delivered at-least-once (idempotency recommended).

---

## Event: `message_created`

### Trigger

Emitted whenever a message is created (incoming or outgoing).

### Scope

- Incoming messages
- Outgoing messages
- All supported channels (e.g. WhatsApp)

### Payload Schema

```json
{
"to":"string",
"from":"string",
"text":"string",
"attachments":["string"],
"status":"received | sent",
"channel":"string",
"contact":"Contact",
"createdAt":"ISO-8601",
"metadata":"object | null"
}

```

### Optional Objects

- `messageContactCard`
- `messageContext`
- `messageForward`
- `messageInteractiveList`
- `messageLocation`
- `messageReplyButton`

### Notes for AI

- Treat optional objects as nullable.
- Use `status` to differentiate inbound vs outbound.
- Do not assume `text` is always present (attachments-only messages).

---

## Event: `message_status_updated`

### Trigger

Emitted when the delivery status of an **outgoing** message changes.

### Constraints

- Only for outgoing messages
- Only WhatsApp Business API & QR API
- Incoming messages never emit this event

### Allowed Status Values

```
enqueued | sent | delivered | read | failed | mismatch

```

### Payload Schema

```json
{
"uuid":"string",
"status":"string",
"metadata":"object | null",
"messageStatusPayload":"object"
}

```

### Edge Cases

- `failed` includes error details inside `messageStatusPayload`
- `mismatch` includes corrected phone number
- Deprecated statuses should be ignored safely

---

## Event: `contact_created`

### Trigger

Emitted when a new contact is created.

### Payload Schema (Contact)

```json
{
"uuid":"string",
"name":"string",
"phoneNumber":"string",
"source":"string",
"tags":["string"],
"avatarUrl":"string | null",
"href":"string",
"conversationHref":"string",
"createdAt":"ISO-8601"
}

```

### AI Notes

- This event is emitted once per contact.
- `uuid` is the primary identifier across all events.

---

## Event: `contact_updated`

### Trigger

Emitted when an existing contact is updated.

### Update Semantics

- No diff is provided.
- Payload represents the **full contact state** after update.

### Payload Schema

Same as `contact_created`.

### Edge Cases

- Tag changes also emit this event.
- Multiple updates may occur in short intervals.

---

## Event: `contact_deleted`

### Trigger

Emitted when a contact is deleted.

### Current Behavior

- Triggered when a conversation is deleted.

### Payload Schema

```json
{
"uuid":"string",
"deleted":"ISO-8601"
}

```

### AI Notes

- After this event, the contact should be considered invalid.
- Downstream systems should cleanup references.

---

## Event: `agent_status_updated`

### Trigger

Emitted when an agent changes availability or custom status.

### Payload Schema

```json
{
"email":"string",
"name":"string",
"available":"boolean",
"lastUpdatedAt":"ISO-8601",
"userCustomStatus":{
"id":"string",
"name":"string",
"emoji":"string",
"updatedAt":"ISO-8601"
} |null
}

```

### AI Notes

- Availability and session are independent concepts.
- Custom status is optional.

---

## Event: `agent_session_updated`

### Trigger

Emitted when an agent session changes.

### Allowed Actions

```
user_logged_in | user_logged_out | system_logged_out

```

### Payload Schema

```json
{
"action":"string",
"user":{
"email":"string",
"name":"string",
"available":"boolean",
"lastUpdatedAt":"ISO-8601"
}
}

```

### Edge Cases

- `system_logged_out` usually indicates session expiration.
- Availability does not imply active session.

---

## Event: `conversation_opened`

### Trigger

Emitted when a conversation is opened or reopened.

### Payload Schema

```json
{
"source":"string",
"href":"string",
"contact":"Contact",
"createdAt":"ISO-8601"
}

```

### AI Notes

- Same event for open and reopen.
- Consumers should not infer state transitions without history.

---

## Event: `conversation_closed`

### Trigger

Emitted when a conversation is closed.

### Payload Schema

```json
{
"source":"string",
"href":"string",
"contact":"Contact",
"createdAt":"ISO-8601",
"closedAt":"ISO-8601"
}

```

### AI Notes

- Used for resolution metrics and automation.
- Conversation may later emit `conversation_opened` again.

---

## Event: `team_membership_updated`

### Trigger

Emitted when an agent is added or removed from a team.

### Allowed Reasons

```
agent_added | agent_removed

```

### Payload Schema

```json
{
"team":{
"uuid":"string",
"name":"string",
"default":"boolean",
"members":"number",
"createdAt":"ISO-8601"
},
"user":{
"email":"string",
"available":"boolean",
"lastUpdateAt":"ISO-8601"
},
"reason":"string",
"lastUpdateAt":"ISO-8601"
}

```

### AI Notes

- Useful for permission sync and routing logic.
- Treat team membership as authoritative.

---

## Recommended AI Usage

This document can be used to:

- Generate webhook handlers
- Create DTOs / schemas
- Implement idempotency logic
- Generate tests and mocks
- Validate payloads defensively