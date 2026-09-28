# meeting-notes

A Claude Code plugin that turns raw meeting notes into decisions, action items
and open questions, and keeps them in a small local store you can search
later. Each user's data stays on their own machine — there's no server to
run and no account to sign up for.

## Install

```bash
claude plugin marketplace add REPLACE_WITH_YOUR_GITHUB_USERNAME/meeting-notes-plugin
claude plugin install meeting-notes@harshit-plugins
```

Or do both in one step inside a session:

```
/plugin install meeting-notes --marketplace REPLACE_WITH_YOUR_GITHUB_USERNAME/meeting-notes-plugin
```

The first time it runs, Claude Code will ask you to approve the plugin's
`store` MCP server before it connects — a normal one-time prompt for any new
MCP server, not something specific to this plugin. Approve it once.

Node.js dependencies install automatically on first use (a `SessionStart`
hook runs `npm install` the first time, only if needed), so there's nothing
else to set up.

## Use it

```
/meeting-notes:action-items
```

Paste some notes, e.g.:

```
Sync with Riya and Amit, 12 Sept. We agreed to ship v2 on the 30th.
Riya will update the pricing page. Amit to check the billing bug by Friday.
Not sure yet if we need a second QA round.
```

Claude produces a summary and saves it. Later, in the same or a new session,
try:

- "What are my open action items?"
- "What did we decide about v2?"
- "Mark the billing bug check as done."

Run `/mcp` to confirm the server shows as connected
(`plugin:meeting-notes:store`).

## What's inside

- **Skill** `skills/action-items/SKILL.md` → the `/meeting-notes:action-items`
  command, and Claude also invokes it automatically when you paste notes.
- **MCP server** `server/index.js` → a local stdio server that persists
  meetings to a JSON file and exposes tools to save, list, search and
  complete them.
- **Hook** `hooks/hooks.json` → installs the server's dependencies
  automatically on first use.
- **Test client** `server/test-client.mjs` → a standalone check that calls
  every tool directly, without Claude Code.

## Tools the server exposes

| Tool | Purpose |
|------|---------|
| `save_meeting` | Store a parsed summary: decisions, action items, open questions |
| `list_meetings` | List saved meetings, optionally filtered by title |
| `get_meeting` | Fetch one meeting's full record by id |
| `list_action_items` | List action items across all meetings, filter by owner/status |
| `complete_action_item` | Mark an action item done by id |
| `search_meetings` | Keyword search across all saved meetings |

## Where the data lives

The server stores meetings in a JSON file at the path Claude Code gives it in
`CLAUDE_PLUGIN_DATA` (survives plugin updates, per-user, per-machine). When
run outside Claude Code for testing, it falls back to `server/.data/meetings.json`.

## Limitations

- Plain JSON on disk, no encryption, no access control. Fine for personal
  meeting notes; don't use it for anything genuinely sensitive.
- Each machine has its own store — this doesn't sync across your devices.

---

## For the maintainer: publishing this

**Before the first push**, replace `REPLACE_WITH_YOUR_GITHUB_USERNAME` in
this file, `.claude-plugin/plugin.json` (`homepage` and `repository`), and
pick your repo name to match (this doc assumes `meeting-notes-plugin`).

### 1. Create the repo and push

```bash
git init
git add .
git commit -m "Initial release: meeting-notes plugin"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/meeting-notes-plugin.git
git push -u origin main
```

Make sure `server/node_modules/` and `server/.data*/` are excluded — the
`.gitignore` already handles this.

### 2. Validate before every release

```bash
claude plugin validate --strict .
```

### 3. Confirm the install path works

```bash
claude plugin marketplace add YOUR_USERNAME/meeting-notes-plugin
claude plugin install meeting-notes@harshit-plugins
```

Start a session (not from inside this repo's own directory, to avoid Claude
Code also picking it up as a project-local `.mcp.json`) and run
`/meeting-notes:action-items`.

### 4. Anyone can now install it

Once pushed, anyone in the world can run the two commands under **Install**
above. No submission, no approval needed — a public GitHub repo with
`.claude-plugin/marketplace.json` at its root *is* a public marketplace.

### 5. Reach more people: submit to Anthropic's community marketplace

This gets `meeting-notes` listed in every user's built-in `/plugin` →
**Discover** tab, so people don't need to know your repo at all.

1. Run `claude plugin validate ./meeting-notes` locally one more time.
2. Submit through one of:
   - claude.ai (needs a Team/Enterprise org + Directory permission):
     [claude.ai/admin-settings/directory/submissions/plugins/new](https://claude.ai/admin-settings/directory/submissions/plugins/new)
   - Console (works for individual authors):
     [platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit)
3. There can be a delay before it appears. Check by searching "meeting-notes"
   in [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json).
4. Once listed, users add it with:
   ```bash
   claude plugin marketplace add anthropics/claude-plugins-community
   claude plugin install meeting-notes@claude-community
   ```

### Releasing updates

- **Never rename** `name` in `plugin.json` after people have installed it —
  existing installs are tracked under that name and would break. Change
  `displayName` instead if you want a different label.
- Bump `version` in `plugin.json` on every release. Users get it by running
  `claude plugin update meeting-notes@harshit-plugins`, or automatically if
  you turn on auto-update for your marketplace.
- Tag releases with `claude plugin tag --push` if you want version ranges to
  resolve cleanly for anyone depending on this plugin.
