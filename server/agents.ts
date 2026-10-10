import type { PaseoApi, PaseoAgent } from "@getpaseo/client";

// The agent that opened a workspace speaks for it: the oldest active agent there.
export async function activeAgents(paseo: PaseoApi): Promise<PaseoAgent[]> {
  const { entries } = await paseo.agents.list({ scope: "active" });
  return entries.map(({ agent }) => agent).filter((agent) => !agent.archivedAt);
}

// The agent that opened a workspace speaks for it: the oldest active agent there.
export function workspaceOwners(agents: PaseoAgent[]): Map<string, PaseoAgent> {
  const owners = new Map<string, PaseoAgent>();
  for (const agent of agents) {
    if (!agent.workspaceId) continue;
    const owner = owners.get(agent.workspaceId);
    if (!owner || agent.createdAt < owner.createdAt) owners.set(agent.workspaceId, agent);
  }
  return owners;
}

export const parentOf = (agent: PaseoAgent) => agent.labels?.["paseo.parent-agent-id"] ?? null;

const isWorking = (agent: PaseoAgent, ended: ReadonlySet<string>) =>
  !ended.has(agent.id) && (agent.status === "running" || agent.status === "initializing");

// `ended` lists agents whose turn just ended; their snapshot can still read "running".
export function statusOf(agent: PaseoAgent, agents: PaseoAgent[], ended: ReadonlySet<string> = new Set()) {
  if (agent.pendingPermissions.length > 0 || agent.lastError) return "blocked" as const;
  if (isWorking(agent, ended)) return "running" as const;
  if (agents.some((child) => parentOf(child) === agent.id && isWorking(child, ended))) return "waiting" as const;
  return "idle" as const;
}
