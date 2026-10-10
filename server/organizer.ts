import type { PaseoApi } from "@getpaseo/client";
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
  labels: WorkspaceLabels,
): Promise<string | null> {
  const workspaceId = agent.workspaceId;
  if (!workspaceId) return null;

  if (agent.parentAgentId) {
    const parent = paseo.agents.ref(agent.parentAgentId);
    await parent.refresh();
    if (parent.workspaceId === workspaceId) return null;
  }

  const workspace = await paseo.workspaces.ref(workspaceId).refresh();
  if (!workspace || workspace.labels?.length) return null;

  const role = settings.roles.find((rule) => agent.title?.includes(rule.match));
  const needsHuman = agent.parentAgentId === null;
  return labels.apply(workspaceId, settings, {
    role: role ? { name: role.name, color: role.color } : undefined,
    attention: needsHuman,
    status: "running",
    pin: needsHuman && settings.attention.pin ? true : undefined,
  });
}
