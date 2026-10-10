import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";

// The plugin SDK has no workspace label or pin calls yet, so the organizer opens its own
// connection to the local daemon, as the Paseo CLI does.
export async function connectDaemon(): Promise<DaemonClient> {
  const home = process.env.PASEO_HOME;
  if (!home) throw new Error("PASEO_HOME is not set in the plugin environment");
  const config = JSON.parse(readFileSync(join(home, "config.json"), "utf8"));
  const listen: string = config.daemon?.listen ?? "127.0.0.1:6767";
  if (!/^[\w.-]+:\d+$/.test(listen)) throw new Error(`Unsupported daemon listen address: ${listen}`);
  const client = new DaemonClient({
    url: `ws://${listen}/ws`,
    clientId: "paseo-sidebar-organizer",
    clientType: "cli",
    localCredential: () => {
      try {
        return readFileSync(join(home, "local-credential"), "utf8").trim() || undefined;
      } catch {
        return undefined;
      }
    },
    reconnect: { enabled: true },
  });
  await client.connect();
  return client;
}
