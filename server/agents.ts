import type { PaseoApi, PaseoAgent } from "@getpaseo/client";

// The agent that opened a workspace speaks for it: the oldest active agent there.
export async function workspaceOwners(paseo: PaseoApi): Promise<Map<string, PaseoAgent>> {
  const { entries } = await paseo.agents.list({ scope: "active" });
  const owners = new Map<string, PaseoAgent>();
  for (const { agent } of entries) {
    if (!agent.workspaceId || agent.archivedAt) continue;
    const owner = owners.get(agent.workspaceId);
    if (!owner || agent.createdAt < owner.createdAt) owners.set(agent.workspaceId, agent);
  }
  return owners;
}

export async function isWorkspaceOwner(paseo: PaseoApi, agent: { id: string; workspaceId: string | null }) {
  if (!agent.workspaceId) return false;
  return (await workspaceOwners(paseo)).get(agent.workspaceId)?.id === agent.id;
}

export function statusOf(agent: PaseoAgent) {
  if (agent.pendingPermissions.length > 0 || agent.lastError) return "blocked" as const;
  if (agent.status === "running" || agent.status === "initializing") return "running" as const;
  return "idle" as const;
}
