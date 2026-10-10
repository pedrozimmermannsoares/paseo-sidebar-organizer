import { type PluginSurfaceProps, useSettings } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { LABEL_COLORS, type LabelColor, type OrganizerSettings, STATUS_KEYS, type StatusKey, organizerSettings } from "../shared/settings";

const colorOptions = LABEL_COLORS.map((color) => ({ label: color, value: color }));
const releaseOptions = [0, 1, 2, 3, 5, 7, 14].map((days) => ({ label: days ? `${days} days` : "Never", value: String(days) }));
const statusTitles: Record<StatusKey, string> = { running: "Running", waiting: "Waiting for child agents", idle: "Idle", blocked: "Blocked" };

export function OrganizerSettingsScreen(_props: PluginSurfaceProps) {
  const settings = useSettings(organizerSettings);
  const [draft, setDraft] = useState<{ values: OrganizerSettings; revision: string } | null>(null);

  if (settings.status === "loading") return null;
  if (settings.status === "error" || settings.status === "invalid") {
    return (
      <SettingsSection title="Organizer">
        <SettingsCard>
          <SettingsRow label="Failed to load settings" error={settings.error} />
          <SettingsAction label="Restore defaults" actionLabel="Reset" onPress={() => void settings.reset()} />
        </SettingsCard>
      </SettingsSection>
    );
  }

  const current = draft ?? { values: settings.values, revision: settings.revision };
  const edit = (values: OrganizerSettings) => setDraft({ values, revision: current.revision });
  const { attention, roles } = current.values;
  const setRole = (index: number, patch: Partial<OrganizerSettings["roles"][number]>) =>
    edit({ ...current.values, roles: roles.map((role, i) => (i === index ? { ...role, ...patch } : role)) });

  return (
    <>
      <SettingsSection title="Needs you">
        <SettingsCard>
          <SettingsInput
            label="Label name"
            hint="Added to workspaces opened by a person, not by another agent."
            initialValue={attention.name}
            onChangeText={(name) => edit({ ...current.values, attention: { ...attention, name } })}
          />
          <SettingsSelect
            label="Color"
            value={attention.color}
            options={colorOptions}
            onValueChange={(color) =>
              edit({ ...current.values, attention: { ...attention, color: color as LabelColor } })
            }
          />
          <SettingsSwitch
            label="Show as a label"
            hint="Off: the pin alone marks these workspaces, and every pinned workspace counts."
            value={attention.show}
            onValueChange={(show) => edit({ ...current.values, attention: { ...attention, show } })}
          />
          <SettingsSwitch
            label="Pin to the top of the sidebar"
            value={attention.pin}
            onValueChange={(pin) => edit({ ...current.values, attention: { ...attention, pin } })}
          />
          <SettingsSelect
            label="Release after inactivity"
            hint="Unpins the workspace and removes this label. Waiting for your reply keeps it."
            value={String(current.values.releaseAfterDays)}
            options={releaseOptions}
            onValueChange={(days) => edit({ ...current.values, releaseAfterDays: Number(days) })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Status">
        <SettingsCard>
          <SettingsSwitch
            label="Show the agent status"
            hint="Running, idle, or blocked by a permission request or a failed turn."
            value={current.values.status.enabled}
            onValueChange={(enabled) => edit({ ...current.values, status: { ...current.values.status, enabled } })}
          />
        </SettingsCard>
        {STATUS_KEYS.map((key) => (
          <SettingsCard key={key}>
            <SettingsInput
              label={statusTitles[key]}
              initialValue={current.values.status[key].name}
              onChangeText={(name) =>
                edit({ ...current.values, status: { ...current.values.status, [key]: { ...current.values.status[key], name } } })
              }
            />
            <SettingsSwitch
              label="Show as a label"
              hint="Turn off when Paseo already shows this status."
              value={current.values.status[key].show}
              onValueChange={(show) =>
                edit({ ...current.values, status: { ...current.values.status, [key]: { ...current.values.status[key], show } } })
              }
            />
            <SettingsSelect
              label="Color"
              value={current.values.status[key].color}
              options={colorOptions}
              onValueChange={(color) =>
                edit({
                  ...current.values,
                  status: { ...current.values.status, [key]: { ...current.values.status[key], color: color as LabelColor } },
                })
              }
            />
          </SettingsCard>
        ))}
      </SettingsSection>

      <SettingsSection title="Waiting for your reply">
        <SettingsCard>
          <SettingsInput
            label="Label name"
            hint="Added when an agent asks you a question. It goes away when you send a message or answer."
            initialValue={current.values.reply.name}
            onChangeText={(name) => edit({ ...current.values, reply: { ...current.values.reply, name } })}
          />
          <SettingsSwitch
            label="Also after every answer to you"
            hint="In workspaces that involve you, when a turn you started ends."
            value={current.values.replyAfterYourTurn}
            onValueChange={(replyAfterYourTurn) => edit({ ...current.values, replyAfterYourTurn })}
          />
          <SettingsSelect
            label="Color"
            value={current.values.reply.color}
            options={colorOptions}
            onValueChange={(color) =>
              edit({ ...current.values, reply: { ...current.values.reply, color: color as LabelColor } })
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Roles from the agent title">
        {roles.map((role, index) => (
          <SettingsCard key={index}>
            <SettingsInput
              label="Title contains"
              initialValue={role.match}
              onChangeText={(match) => setRole(index, { match })}
            />
            <SettingsInput label="Label name" initialValue={role.name} onChangeText={(name) => setRole(index, { name })} />
            <SettingsSelect
              label="Color"
              value={role.color}
              options={colorOptions}
              onValueChange={(color) => setRole(index, { color: color as LabelColor })}
            />
            <SettingsAction
              label="Remove this rule"
              actionLabel="Remove"
              onPress={() => edit({ ...current.values, roles: roles.filter((_, i) => i !== index) })}
            />
          </SettingsCard>
        ))}
        <SettingsCard>
          <SettingsAction
            label="The first matching rule wins"
            actionLabel="Add rule"
            onPress={() => edit({ ...current.values, roles: [...roles, { match: "🤖", name: "Agent", color: "teal" }] })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Save">
        <SettingsCard>
          <SettingsAction
            label={draft ? "Unsaved changes" : "No changes"}
            actionLabel={settings.saving ? "Saving" : "Save"}
            disabled={!draft || settings.saving}
            onPress={async () => {
              if (draft && (await settings.save(draft.values, draft.revision))) setDraft(null);
            }}
          />
          {settings.saveError ? <SettingsRow label="Failed to save" error={settings.saveError} /> : null}
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
