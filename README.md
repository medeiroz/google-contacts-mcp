# Google Contacts MCP

A small, local [Model Context Protocol](https://modelcontextprotocol.io/) server for Google Contacts (Google People API).

## Security model

This repository intentionally contains **no credentials** and does not implement OAuth login or redirects.

- Set `GOOGLE_CONTACTS_TOKEN_PATH` to an absolute path for an OAuth *authorized-user token* stored outside this repository.
- The server never falls back to a default token path, so it cannot accidentally select a different Google account.
- `.gitignore` rejects token, secret and credential JSON files.
- On each refresh, the token file is written with Unix permission `0600`.
- Write operations require `confirm: true` in the tool input.

Do not commit your OAuth token or client-secret JSON. If a credential is ever committed, revoke it immediately in Google Cloud and remove it from Git history.

## Tools

| Tool | Purpose |
|---|---|
| `list_contacts` | List one page of contacts. |
| `search_contacts` | Search all contacts locally by all words across name, email and phone. |
| `get_contact` | Fetch a contact by People API resource name. |
| `create_contact` | Create a contact; requires `confirm: true`. |
| `update_contact` | Update supplied fields; requires `confirm: true`. |
| `delete_contact` | Permanently delete a contact; requires `confirm: true`. |
| `contacts_stats` | Count all contacts. |

`list_contacts`, `search_contacts` e `get_contact` retornam também `tags`: os nomes dos rótulos/grupos do Google Contacts vinculados ao contato. Isso permite que consumidores apliquem políticas como ignorar contatos com a tag `Não Atualizar Automático` sem depender de texto no nome ou em campos pessoais.

## Requirements

- Node.js 18 or newer.
- An OAuth refresh token authorized for `https://www.googleapis.com/auth/contacts`.
- Google People API enabled in the token's Google Cloud project.

## Install

```bash
npm install
export GOOGLE_CONTACTS_TOKEN_PATH=/absolute/path/outside-this-repo/google_token.json
node index.js
```

For a Hermes stdio MCP configuration, point the command at `node`, pass the absolute `index.js` path in `args`, and pass only the external token path in `env`:

```yaml
mcp_servers:
  google-contacts:
    command: node
    args: [/absolute/path/to/google-contacts-mcp/index.js]
    env:
      GOOGLE_CONTACTS_TOKEN_PATH: /absolute/path/outside-this-repo/google_token.json
```

Restart Hermes after adding the server so it can discover the tools.

## Development

```bash
npm test
```

The tests never contact Google and do not require a token.

## License

MIT.
