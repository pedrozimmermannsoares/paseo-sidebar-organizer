import type { PaseoApi } from "@getpaseo/client";
import { isAttentionWorkspace, type OrganizerSettings } from "../shared/settings";
import { activeAgents, statusOf, workspaceOwners } from "./agents";
import type { WorkspaceLabels } from "./labels";

// Schedule and heartbeat prompts do not update lastUserMessageAt, so a recent value means a
// person's message started this turn.
const HUMAN_TURN_WINDOW_MS = 60_000;

export async function humanStartedTurn(paseo: PaseoApi, agentId: string) {
  const handle = paseo.agents.ref(agentId);
  await handle.refresh();
  const at = handle.current()?.lastUserMessageAt;
  return Boolean(at && Date.now() - Date.parse(at) <= HUMAN_TURN_WINDOW_MS);
}

// Brings every active workspace to its owner's current state and releases stale conversations.
export async function sweep(paseo: PaseoApi, labels: WorkspaceLabels, settings: OrganizerSettings) {
  const agents = await activeAgents(paseo);
  const owners = workspaceOwners(agents);
  const { entries } = await paseo.workspaces.list();
  const notes: string[] = [];

  for (const workspace of entries) {
    const owner = owners.get(workspace.id);
    if (!owner) continue;
    const status = statusOf(owner, agents);
    const question = owner.pendingPermissions.some((request) => request.kind === "question");
    const stale = isStale(settings, status, owner.updatedAt, workspace, Date.now());

    const note = await labels.apply(workspace.id, settings, {
      status,
      ...(question ? { reply: true } : {}),
      ...(stale ? { attention: false, pin: false } : {}),
    });
    if (note) notes.push(note);
  }
  return notes;
}

// A pinned conversation goes back to the fleet after `releaseAfterDays` without activity,
// unless the agent is working or still waits for a reply.
export function isStale(
  settings: Pick<OrganizerSettings, "releaseAfterDays" | "attention" | "reply">,
  status: string,
  updatedAt: string,
  workspace: { labels?: readonly string[]; pinnedAt?: string | null },
  now: number,
) {
  return (
    settings.releaseAfterDays > 0 &&
    status !== "running" &&
    Date.parse(updatedAt) < now - settings.releaseAfterDays * 86_400_000 &&
    isAttentionWorkspace(settings, workspace) &&
    !workspace.labels?.includes(settings.reply.name)
  );
}
