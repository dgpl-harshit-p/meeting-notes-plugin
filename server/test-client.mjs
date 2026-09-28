import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rm } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, ".data-test");
await rm(dataDir, { recursive: true, force: true });

const transport = new StdioClientTransport({
  command: "node",
  args: [join(__dirname, "index.js")],
  env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir },
});

const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ok:", msg);
}

function parse(result) {
  if (result.isError) throw new Error("Tool returned error: " + result.content[0].text);
  return JSON.parse(result.content[0].text);
}

console.log("--- listing tools ---");
const { tools } = await client.listTools();
console.log(tools.map((t) => t.name).join(", "));
assert(tools.length === 6, "expected 6 tools, got " + tools.length);

console.log("\n--- save_meeting ---");
const saved = parse(
  await client.callTool({
    name: "save_meeting",
    arguments: {
      title: "Sync with Riya and Amit",
      date: "2026-09-12",
      raw_notes: "Sync with Riya and Amit, 12 Sept. We agreed to ship v2 on the 30th. Riya will update the pricing page. Amit to check the billing bug by Friday. Not sure yet if we need a second QA round.",
      summary: "Agreed to ship v2 on the 30th; two follow-ups assigned.",
      decisions: ["Ship v2 on the 30th"],
      action_items: [
        { task: "Update the pricing page", owner: "Riya" },
        { task: "Check the billing bug", owner: "Amit", deadline: "Friday" },
      ],
      open_questions: ["Do we need a second QA round?"],
    },
  }),
);
console.log(saved);
assert(saved.action_item_count === 2, "saved meeting has 2 action items");
const meetingId = saved.id;

console.log("\n--- list_meetings ---");
const meetings = parse(await client.callTool({ name: "list_meetings", arguments: {} }));
console.log(meetings);
assert(meetings.length === 1, "one meeting listed");
assert(meetings[0].id === meetingId, "listed meeting id matches saved id");

console.log("\n--- get_meeting ---");
const full = parse(await client.callTool({ name: "get_meeting", arguments: { id: meetingId } }));
assert(full.decisions[0] === "Ship v2 on the 30th", "decision persisted correctly");
assert(full.action_items.length === 2, "both action items persisted");

console.log("\n--- list_action_items (all) ---");
const allItems = parse(await client.callTool({ name: "list_action_items", arguments: {} }));
console.log(allItems);
assert(allItems.length === 2, "two action items across store");
assert(allItems.every((i) => i.status === "open"), "both items start open");

console.log("\n--- list_action_items (owner filter) ---");
const riyaItems = parse(await client.callTool({ name: "list_action_items", arguments: { owner: "Riya" } }));
assert(riyaItems.length === 1 && riyaItems[0].owner === "Riya", "owner filter works");

console.log("\n--- complete_action_item ---");
const amitItemId = allItems.find((i) => i.owner === "Amit").item_id;
const completed = parse(await client.callTool({ name: "complete_action_item", arguments: { item_id: amitItemId } }));
console.log(completed);
assert(completed.status === "done", "item marked done");

console.log("\n--- list_action_items (status filter after completion) ---");
const openOnly = parse(await client.callTool({ name: "list_action_items", arguments: { status: "open" } }));
assert(openOnly.length === 1 && openOnly[0].owner === "Riya", "only Riya's item remains open");

console.log("\n--- search_meetings ---");
const found = parse(await client.callTool({ name: "search_meetings", arguments: { keyword: "billing" } }));
assert(found.length === 1 && found[0].id === meetingId, "keyword search finds the meeting");

const notFound = parse(await client.callTool({ name: "search_meetings", arguments: { keyword: "nonexistent-xyz" } }));
assert(notFound.length === 0, "keyword search returns empty for no match");

console.log("\n--- error handling: unknown meeting id ---");
const badGet = await client.callTool({ name: "get_meeting", arguments: { id: "does-not-exist" } });
assert(badGet.isError === true, "get_meeting on bad id returns isError");

console.log("\n--- persistence across a fresh connection ---");
await client.close();
const transport2 = new StdioClientTransport({
  command: "node",
  args: [join(__dirname, "index.js")],
  env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir },
});
const client2 = new Client({ name: "test-client-2", version: "1.0.0" });
await client2.connect(transport2);
const meetingsAfterRestart = parse(await client2.callTool({ name: "list_meetings", arguments: {} }));
assert(meetingsAfterRestart.length === 1, "data survives a server restart (persisted to disk)");
await client2.close();

await rm(dataDir, { recursive: true, force: true });
console.log("\nALL TESTS PASSED");
