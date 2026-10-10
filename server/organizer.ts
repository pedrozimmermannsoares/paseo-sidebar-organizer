import type { PaseoApi } from "@getpaseo/client";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { OrganizerSettings } from "../shared/settings";
import type { WorkspaceLabels } from "./labels";

interface CreatedAgent {
  id: string;
  workspaceId: string | null;
  parentAgentId: string | null;
  title: string | null;
}

// Labels belong to the workspace, so only the agent that opens a workspace organizes it.
export async function organizeWorkspace(
  agent: CreatedAgent,
  settings: OrganizerSettings,
  paseo: PaseoApi,
  daemon: DaemonClient,
  labels: WorkspaceLabels,
): Promise<string | null> {
  const workspaceId = agent.workspaceId;
  if (!workspaceId) return null;

  // Pin before anything else: Paseo cannot create a pinned workspace, so the sidebar first shows
  // the new workspace unpinned and moves it when the pin lands. A person's new agent pins its
  // workspace even when the workspace already existed.
  const needsHuman = agent.parentAgentId === null;
  if (needsHuman && settings.attention.pin) {
    const workspace = await paseo.workspaces.ref(workspaceId).refresh();
    if (workspace && !workspace.pinnedAt) await daemon.setWorkspacePinned(workspaceId, true);
  }

  if (agent.parentAgentId) {
    const parent = paseo.agents.ref(agent.parentAgentId);
    await parent.refresh();
    if (parent.workspaceId === workspaceId) return null;
  }

  const workspace = await paseo.workspaces.ref(workspaceId).refresh();
  if (!workspace || workspace.labels?.length) return null;

  const role = settings.roles.find((rule) => agent.title?.includes(rule.match));
  return labels.apply(workspaceId, settings, {
    role: role ? { name: role.name, color: role.color } : undefined,
    attention: needsHuman,
    status: "running",
  });
}
