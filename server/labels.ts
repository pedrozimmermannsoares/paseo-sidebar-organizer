import type { PaseoApi } from "@getpaseo/client";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { type Label, type LabelColor, type OrganizerSettings, STATUS_KEYS, type StatusKey } from "../shared/settings";

export interface LabelChange {
  role?: Label;
  attention?: boolean;
  status?: StatusKey;
  reply?: boolean;
  pin?: boolean;
}

// The sidebar shows chips in assignment order. Managed labels always follow the others:
// attention, then status, then reply.
export class WorkspaceLabels {
  private queues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly paseo: PaseoApi,
    private readonly daemon: DaemonClient,
  ) {}

  apply(workspaceId: string, settings: OrganizerSettings, change: LabelChange): Promise<string | null> {
    const run = (this.queues.get(workspaceId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => this.reconcile(workspaceId, settings, change));
    this.queues.set(workspaceId, run);
    return run;
  }

  private async reconcile(workspaceId: string, settings: OrganizerSettings, change: LabelChange) {
    const workspace = await this.paseo.workspaces.ref(workspaceId).refresh();
    if (!workspace) return null;
    const current = workspace.labels ?? [];

    const statusLabels = STATUS_KEYS.map((key) => settings.status[key]);
    const managed = new Set([settings.attention.name, settings.reply.name, ...statusLabels.map((l) => l.name)]);
    const base = current.filter((name) => !managed.has(name));
    if (change.role && !base.includes(change.role.name)) base.push(change.role.name);

    const attention = change.attention ?? current.includes(settings.attention.name);
    const currentStatus = STATUS_KEYS.find((key) => current.includes(settings.status[key].name));
    const status = settings.status.enabled ? (change.status ?? currentStatus) : undefined;
    const reply = change.reply ?? current.includes(settings.reply.name);

    const desired = [
      ...base,
      ...(attention ? [settings.attention.name] : []),
      ...(status ? [settings.status[status].name] : []),
      ...(reply ? [settings.reply.name] : []),
    ];

    const notes: string[] = [];
    let prefix = 0;
    while (prefix < current.length && current[prefix] === desired[prefix]) prefix += 1;
    if (prefix < current.length || prefix < desired.length) {
      const colors = await this.colors(settings, change.role);
      const toLabel = (name: string) => ({ name, color: colors.get(name) ?? "sky" });
      for (const name of current.slice(prefix)) {
        await this.daemon.setWorkspaceLabel({ workspaceId, label: toLabel(name), assigned: false });
      }
      for (const name of desired.slice(prefix)) {
        await this.daemon.setWorkspaceLabel({ workspaceId, label: toLabel(name), assigned: true });
      }
      notes.push(desired.join(", ") || "no labels");
    }

    if (change.pin !== undefined && Boolean(workspace.pinnedAt) !== change.pin) {
      await this.daemon.setWorkspacePinned(workspaceId, change.pin);
      notes.push(change.pin ? "pinned" : "unpinned");
    }
    return notes.length ? `${workspaceId}: ${notes.join("; ")}` : null;
  }

  private async colors(settings: OrganizerSettings, role?: Label) {
    const registry = await this.daemon.listWorkspaceLabels();
    const colors = new Map<string, LabelColor>(registry.labels.map((l) => [l.name, l.color]));
    for (const l of [settings.attention, settings.reply, ...STATUS_KEYS.map((k) => settings.status[k]), ...settings.roles]) {
      colors.set(l.name, l.color);
    }
    if (role) colors.set(role.name, role.color);
    return colors;
  }
}
