import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const LABEL_COLORS = ["violet", "sky", "emerald", "orange", "pink", "indigo", "teal", "red", "amber", "blue"] as const;

const color = z.enum(LABEL_COLORS);
const label = z.object({ name: z.string().min(1), color });
const statusLabel = label.extend({ show: z.boolean().default(true) });

export const STATUS_KEYS = ["running", "idle", "blocked"] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const organizerSettings = defineSettings({
  id: "organizer",
  scope: "host",
  version: 1,
  schema: z.object({
    // Workspaces opened by a person, not by another agent.
    attention: label.extend({ pin: z.boolean() }).default({ name: "You", color: "pink", pin: true }),
    // Set by an agent that waits for a person's reply; removed when that person sends a message.
    reply: label.default({ name: "Reply", color: "red" }),
    // `show: false` tracks a status without a chip, e.g. when Paseo already shows it.
    status: z
      .object({ enabled: z.boolean(), running: statusLabel, idle: statusLabel, blocked: statusLabel })
      .default({
        enabled: true,
        running: { name: "Running", color: "blue", show: true },
        idle: { name: "Idle", color: "emerald", show: true },
        blocked: { name: "Blocked", color: "orange", show: true },
      }),
    // Add the reply label when a turn started by a person's message ends in an attention workspace.
    replyAfterYourTurn: z.boolean().default(true),
    // Unpin and drop the attention label after this many days without activity. 0 turns it off.
    releaseAfterDays: z.number().int().min(0).default(3),
    // First rule whose `match` appears in the agent title wins.
    roles: z.array(label.extend({ match: z.string().min(1) })).default([]),
  }),
});

export type OrganizerSettings = z.infer<typeof organizerSettings.schema>;
export type LabelColor = (typeof LABEL_COLORS)[number];
export type Label = z.infer<typeof label>;
