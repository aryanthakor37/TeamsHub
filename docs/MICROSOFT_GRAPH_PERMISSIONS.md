# Microsoft Graph Permissions Reference

To operate Phase 4 of TeamsHub (Real Microsoft Graph Verification), the following minimum **Delegated Permissions** are required. 

We apply the Principle of Least Privilege. We only request what is necessary to read chat structures and message content.

| Permission | Type | Why required | API using it | Admin Consent Required? | Phase Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`User.Read`** | Delegated | Resolves the signed-in user's display name, email, and Microsoft identity ID (OID) to map the token to a `ConnectedAccount` in MongoDB. | `GET /v1.0/me` | No | Phase 4 |
| **`Chat.Read`** | Delegated | Required to fetch the list of chats the user is part of, AND required to read the messages within those chats. | `GET /v1.0/me/chats`<br>`GET /v1.0/chats/{id}/messages` | **Yes** | Phase 4 |

### Why not `Chat.ReadBasic`?
`Chat.ReadBasic` is a lower-privilege permission that does not require admin consent. However, it only allows listing chats (names and metadata). It **does not** allow reading the actual messages inside the chat. Because TeamsHub needs to render the chat history (`GET /chats/{id}/messages`), `Chat.Read` is mandatory.

### Why not `Chat.ReadWrite`?
We do not use `Chat.ReadWrite` because Phase 4 is read-only. We are not sending messages, renaming chats, or mutating data. We will add `Chat.ReadWrite` in Phase 5 when message sending is implemented.

### Why not `Chat.Read.All`?
`*.All` permissions are **Application permissions** (running as a daemon/service without a user context). TeamsHub uses **Delegated permissions** (acting on behalf of the signed-in user), guaranteeing that a user can only see chats they are already a member of.

---

> [!WARNING]
> If your organization strictly prohibits granting admin consent for `Chat.Read`, you will not be able to use the real Microsoft Graph integration for TeamsHub. You must fall back to development mode by setting `MOCK_GRAPH_DATA=true` in `server/.env`.
