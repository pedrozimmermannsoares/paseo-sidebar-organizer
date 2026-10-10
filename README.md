# Sidebar organizer for Paseo

A [Paseo](https://paseo.sh) plugin that labels and pins workspaces so the sidebar shows, at a glance:

- which conversations you take part in, and which are background agents;
- what each agent is doing right now;
- which agents wait for your answer.

Each workspace row gets up to four kinds of labels, always in this order:

| Label | Default | When |
| --- | --- | --- |
| Role | none | The first rule whose text appears in the title of the workspace's first agent. You define the rules, for example `🔨` → `Executor`. |
| Attention | `You` (pink), and the workspace is pinned | The workspace was opened by a person, not by another agent. Removed, and the workspace unpinned, after 3 days without activity unless the agent waits for your reply. With the label hidden, the pin alone marks these workspaces and every pinned workspace counts. |
| Status | `Running` (blue), `Idle` (green), `Blocked` (orange) | Follows the agent that opened the workspace. Blocked means a pending permission, a pending question, or a failed turn. Each status can be tracked without a label. |
| Reply | `Reply` (red) | A turn that started with your message ended in a workspace that involves you, the agent asked you a question through the provider's question tool, or an agent or script added the label. Removed when you send a message or answer. Schedule and heartbeat runs neither add nor remove it. |

Labels you add by hand stay in front of these and are never removed.

## Install

Requires Paseo 0.11.2 or later, with plugins enabled in Settings → Plugins, and npm on the daemon host.

```bash
paseo plugin add git:pedrozimmermannsoares/paseo-sidebar-organizer
```

## Configure

Open Settings → Plugins → Sidebar organizer. You can change every label name and color, turn pinning, status labels and the automatic reply label off, set the inactivity period (0 turns it off), and edit the role rules. Label colors are limited to the ten colors the Paseo sidebar supports.

An agent or script can mark a workspace as waiting for your reply by assigning the reply label with the same name and color as in the settings. The plugin removes it when you answer.

## How it works

The daemon runs the plugin's server entry. It listens to these lifecycle events:

- `agent.created`: an agent with no parent pins its workspace right away, even an existing one. A new workspace also gets its role and attention labels. A child agent that runs inside its parent's workspace changes nothing, and a workspace that already has labels keeps them.
- `agent.turn_started`, `agent.turn_ended`, `agent.permission_requested`, `agent.permission_resolved`: status and reply labels for the oldest active agent of each workspace. Your message to an agent with no parent pins its workspace again.

When it starts, and every 30 minutes, it brings every active workspace up to date and releases inactive conversations.

A turn counts as started by you when the agent's `lastUserMessageAt` changed in the last 60 seconds. Paseo does not update that field for schedule and heartbeat prompts. Messages sent with `paseo send` do update it, so they count as yours.

## Access and limits

- The plugin SDK in Paseo 0.11 has no calls to label or pin workspaces. The plugin opens its own WebSocket connection to the local daemon, as the Paseo CLI does, using `@getpaseo/client` and the daemon's local credential from `$PASEO_HOME/local-credential`. It reads the daemon address from `$PASEO_HOME/config.json` and supports only a local TCP address. It sends nothing outside the daemon.
- It depends on `@getpaseo/client/internal/daemon-client`, an internal module. A future Paseo release can change it.
- Labels and pins are shared by everyone connected to the same daemon.
- Paseo cannot create a workspace already pinned. When the creation request carries the first agent, as it does from the app, the plugin pins the workspace as it is created, using the agent's `paseo.parent-agent-id` label to tell a person from an agent. `paseo run --new-workspace` creates the workspace first, so that workspace is pinned a moment later, when its agent starts.
- The status reflects the first agent of the workspace. Other agents in the same workspace do not change it.
- The plugin remembers in memory which turns you started. A turn that is running while the plugin restarts or updates does not get the automatic reply label when it ends.

## Development

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"
paseo plugin logs paseo-sidebar-organizer
```

## License

MIT
