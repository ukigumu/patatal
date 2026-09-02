# Patatal

**Potato-field botvillage** - a browser farm where each Grok Bot is a potato in the surco and the scarecrow is the orchestrator. Click a plant to ping that agent; the field stays local unless you wire webhooks.

Original work. Not an Animal Crossing island. Not a poteto clone.

## What you see

`public/art/field.png` is the farm. Click the scarecrow or a potato plant. The hover plaque uses `public/art/scarecrow.png` and `public/art/potatoes.png`.

Spanish labels sit on the wooden signs. Code and JSON stay in English.

| Name | Label | Role on the field |
| --- | --- | --- |
| Orchestrator | Espantapájaros | Points. Never harvests. Local ping only. |
| Developer | Desarrollador | Potato |
| Project Manager | Jefa de proyecto | Potato |
| Mail | Correo | Potato |
| Social | Social | Potato |
| Ops | Operaciones | Potato |
| Secrets | Secretos | Potato |
| Accounting | Cuentas | Potato |
| Meetings | Reuniones | Potato |
| Products | Productos | Potato |
| Proposals | Propuestas | Potato |
| Repo Diary | Diario del repo | Potato |
| AI News | Noticias IA | Potato |
| WhatsApp | WhatsApp | Potato |
| Crazy Groki | Groki loca | Potato |

## How a click travels

The browser posts JSON to the same origin `/click`. It never sees a webhook URL or a sender key.

`server.mjs` reads `WEBHOOK_URL` and `WEBHOOK_KEY` from the environment. Those values are not in this repo. If both are set, the server posts `{action, potato, agent_id}` to that URL with `Authorization: Bearer` and `X-Automation-Key`. `action` is `ping` on a click and `probe` for health.

A click on the scarecrow stays on this machine. The server answers. It does not forward.

If the env vars are empty, every click stays local. Fill them on the host when you want a potato to wake a bot.

## How to run

You need Node 18 or newer.

1. Copy `.env.example` to `.env` if you want a local env file. Leave the webhook values empty unless you already have them.
2. Load the env in your shell. Do not paste a sender key into chat or into the repo.
3. Start the farm.

```bash
node server.mjs
```

The farm listens on `http://0.0.0.0:3847`. Open that URL and click a potato.

```bash
ppnpm test
```

The test starts a throwaway webhook listener and checks that a potato ping forwards and a scarecrow ping does not.

## Env

| Name | What the host puts there |
| --- | --- |
| `WEBHOOK_URL` | Webhook URL from the routine panel |
| `WEBHOOK_KEY` | Sender key from the same panel |
| `PORT` | Listen port. Defaults to `3847` |

Do not invent a URL or a key. Do not commit `.env`.
