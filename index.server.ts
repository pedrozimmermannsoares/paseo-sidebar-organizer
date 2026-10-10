import { createPaseoApi } from "@getpaseo/client";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { isWorkspaceOwner } from "./server/agents";
import { connectDaemon } from "./server/daemon";
import { WorkspaceLabels } from "./server/labels";
import { organizeWorkspace } from "./server/organizer";
import { humanStartedTurn, sweep } from "./server/status";
import { isAttentionWorkspace, type OrganizerSettings, organizerSettings } from "./shared/settings";

const SWEEP_INTERVAL_MS = 30 * 60_000;

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(organizerSettings);
  const ready = connectDaemon().then((daemon) => {
    const paseo = createPaseoApi(daemon);
    return { daemon, paseo, labels: new WorkspaceLabels(paseo, daemon) };
  });
  ready.catch((error) => console.error(`Failed to connect to the Paseo daemon: ${String(error)}`));

  type Context = Awaited<typeof ready>;
  async function run(task: (values: OrganizerSettings, context: Context) => Promise<string | string[] | null>, failure: string) {
    try {
      const current = await settings.read();
      if (current.status !== "ready") {
        console.error(`Organizer settings are invalid: ${current.error}`);
        return;
      }
      const result = await task(current.values, await ready);
      for (const line of [result ?? []].flat()) console.log(line);
    } catch (error) {
      console.error(`${failure}: ${String(error)}`);
    }
  }

  // Status events only speak for the agent that owns its workspace.
  function onOwnerEvent(
    agent: { id: string; workspaceId: string | null },
    failure: string,
    task: (values: OrganizerSettings, context: Context, workspaceId: string) => Promise<string | null>,
  ) {
    return run(async (values, context) => {
      const workspaceId = agent.workspaceId;
      if (!workspaceId || !(await isWorkspaceOwner(context.paseo, agent))) return null;
      return task(values, context, workspaceId);
    }, failure);
  }

  // Paseo cannot create a pinned workspace. Deciding at creation, from the first agent's
  // parent label, lets the pin land with the workspace instead of after its agent starts.
  const creations: { human: boolean; at: number }[] = [];
  server.before("workspace.create", ({ request }) => {
    const human = Boolean(request.agent) && !request.agent?.labels?.["paseo.parent-agent-id"];
    creations.push({ human, at: Date.now() });
  });
  server.on("workspace.created", ({ workspace }) =>
    run(async (values, { daemon }) => {
      while (creations.length && Date.now() - creations[0].at > 30_000) creations.shift();
      if (!creations.shift()?.human || !values.attention.pin) return null;
      await daemon.setWorkspacePinned(workspace.id, true);
      return `${workspace.id}: pinned at creation`;
    }, `Failed to pin workspace ${workspace.id}`),
  );

  server.on("agent.created", ({ agent }) =>
    run((values, { paseo, daemon, labels }) => organizeWorkspace(agent, values, paseo, daemon, labels), `Failed to organize workspace ${agent.workspaceId}`),
  );

  // Agents whose current turn started with a person's message.
  const yourTurns = new Set<string>();

  server.on("agent.turn_started", ({ agent }) =>
    onOwnerEvent(agent, `Failed to mark workspace ${agent.workspaceId} as running`, async (values, { paseo, labels }, workspaceId) => {
      const human = await humanStartedTurn(paseo, agent.id);
      if (human) yourTurns.add(agent.id);
      else yourTurns.delete(agent.id);
      // Talking to an agent a person opened brings its workspace back to the pinned group. Agents
      // with a parent are skipped: their parent's `paseo send` looks like a person's message.
      const pin = human && agent.parentAgentId === null && values.attention.pin ? { pin: true } : {};
      return labels.apply(workspaceId, values, { status: "running", ...(human ? { reply: false } : {}), ...pin });
    }),
  );

  server.on("agent.turn_ended", ({ agent, outcome }) =>
    onOwnerEvent(agent, `Failed to update workspace ${agent.workspaceId} after a turn`, async (values, { paseo, labels }, workspaceId) => {
      const answeredYou = yourTurns.delete(agent.id) && outcome.kind === "completed";
      const workspace = answeredYou && values.replyAfterYourTurn ? await paseo.workspaces.ref(workspaceId).refresh() : null;
      const reply = Boolean(workspace && isAttentionWorkspace(values, workspace));
      return labels.apply(workspaceId, values, {
        status: outcome.kind === "failed" ? "blocked" : "idle",
        ...(reply ? { reply: true } : {}),
      });
    }),
  );

  server.on("agent.permission_requested", ({ agent, request }) =>
    onOwnerEvent(agent, `Failed to mark workspace ${agent.workspaceId} as waiting`, (values, { labels }, workspaceId) =>
      labels.apply(workspaceId, values, request.kind === "question" ? { status: "blocked", reply: true } : { status: "blocked" }),
    ),
  );

  // Answering a question or a permission request is the person's reply.
  server.on("agent.permission_resolved", ({ agent }) =>
    onOwnerEvent(agent, `Failed to update workspace ${agent.workspaceId} after a permission`, (values, { labels }, workspaceId) =>
      labels.apply(workspaceId, values, { status: "running", reply: false }),
    ),
  );

  const sweepNow = () => run((values, { paseo, labels }) => sweep(paseo, labels, values), "Failed to sweep workspaces");
  void sweepNow();
  const timer = setInterval(sweepNow, SWEEP_INTERVAL_MS);

  return async () => {
    clearInterval(timer);
    await (await ready.catch(() => null))?.daemon.close();
  };
}
