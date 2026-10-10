import type { PluginClientContext } from "@getpaseo/plugin/client";
import { OrganizerSettingsScreen } from "./client/settings-screen";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({ id: "organizer", title: "Sidebar organizer", icon: "Tags", Component: OrganizerSettingsScreen });
  return () => {};
}
