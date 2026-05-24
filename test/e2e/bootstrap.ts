import { runBridgeE2ETest } from "./bridge.e2e.test.ts";
import { runSidebarE2ETest } from "./sidebar.e2e.test.ts";

export async function run(): Promise<void> {
  await runSidebarE2ETest();
  await runBridgeE2ETest();
}
