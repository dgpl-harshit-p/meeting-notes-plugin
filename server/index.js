import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  saveMeeting,
  listMeetings,
  getMeeting,
  listActionItems,
  completeActionItem,
  searchMeetings,
} from "./store.js";

const server = new McpServer({
  name: "meeting-notes-store",
  version: "1.0.0",
});

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(err) {
  return {
    content: [{ type: "text", text: `Error: ${err.message}` }],
    isError: true,
  };
}

server.tool(
  "save_meeting",
  "Save a parsed meeting summary (decisions, action items, open questions) to the local store so it can be found later.",
  {
    title: z.string().describe("Short title for the meeting"),
    date: z.string().optional().describe("Meeting date, YYYY-MM-DD. Defaults to today if omitted."),
    raw_notes: z.string().optional().describe("The original notes as given by the user"),
    summary: z.string().optional().describe("Two-sentence summary"),
    decisions: z.array(z.string()).optional().describe("List of decisions made"),
    action_items: z
      .array(
        z.object({
          task: z.string(),
          owner: z.string().optional(),
          deadline: z.string().optional(),
        }),
      )
      .optional()
      .describe("List of action items"),
    open_questions: z.array(z.string()).optional().describe("List of unresolved questions"),
  },
  async (args) => {
    try {
      return ok(await saveMeeting(args));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "list_meetings",
  "List saved meetings, optionally filtered by a title substring.",
  {
    query: z.string().optional().describe("Substring to match against meeting titles"),
  },
  async ({ query }) => {
    try {
      return ok(await listMeetings(query));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_meeting",
  "Get the full saved record for one meeting by its id.",
  {
    id: z.string().describe("Meeting id, from list_meetings or search_meetings"),
  },
  async ({ id }) => {
    try {
      return ok(await getMeeting(id));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "list_action_items",
  "List action items across all saved meetings, optionally filtered by owner or status.",
  {
    owner: z.string().optional().describe("Filter to items owned by this person"),
    status: z.enum(["open", "done"]).optional().describe("Filter by status. Defaults to showing all statuses."),
  },
  async ({ owner, status }) => {
    try {
      return ok(await listActionItems({ owner, status }));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "complete_action_item",
  "Mark an action item as done by its id.",
  {
    item_id: z.string().describe("Action item id, from list_action_items"),
  },
  async ({ item_id }) => {
    try {
      return ok(await completeActionItem(item_id));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "search_meetings",
  "Search saved meetings by keyword across their title, notes, summary, decisions, action items and open questions.",
  {
    keyword: z.string().describe("Keyword or phrase to search for"),
  },
  async ({ keyword }) => {
    try {
      return ok(await searchMeetings(keyword));
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
