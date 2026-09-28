import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

// CLAUDE_PLUGIN_DATA is set by Claude Code to a directory that survives
// plugin updates. Fall back to a local .data folder for standalone testing
// (e.g. running this server directly with an MCP client, or with mcp-cli).
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(process.cwd(), ".data");
const DB_FILE = join(DATA_DIR, "meetings.json");

async function ensureDir() {
  await mkdir(dirname(DB_FILE), { recursive: true });
}

async function load() {
  await ensureDir();
  try {
    const raw = await readFile(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { meetings: [] };
    throw err;
  }
}

async function save(db) {
  await ensureDir();
  await writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function saveMeeting({ title, date, raw_notes, summary, decisions, action_items, open_questions }) {
  const db = await load();
  const meeting = {
    id: randomUUID(),
    title,
    date: date || new Date().toISOString().slice(0, 10),
    raw_notes: raw_notes || "",
    summary: summary || "",
    decisions: decisions || [],
    action_items: (action_items || []).map((item) => ({
      id: randomUUID(),
      task: item.task,
      owner: item.owner || "Unassigned",
      deadline: item.deadline || "No date set",
      status: "open",
    })),
    open_questions: open_questions || [],
    created_at: new Date().toISOString(),
  };
  db.meetings.push(meeting);
  await save(db);
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    action_item_count: meeting.action_items.length,
  };
}

export async function listMeetings(query) {
  const db = await load();
  let meetings = db.meetings;
  if (query) {
    const q = query.toLowerCase();
    meetings = meetings.filter((m) => m.title.toLowerCase().includes(q));
  }
  return meetings
    .map((m) => ({ id: m.id, title: m.title, date: m.date, action_item_count: m.action_items.length }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getMeeting(id) {
  const db = await load();
  const meeting = db.meetings.find((m) => m.id === id);
  if (!meeting) throw new Error(`No meeting found with id ${id}`);
  return meeting;
}

export async function listActionItems({ owner, status } = {}) {
  const db = await load();
  const items = [];
  for (const meeting of db.meetings) {
    for (const item of meeting.action_items) {
      if (owner && item.owner.toLowerCase() !== owner.toLowerCase()) continue;
      if (status && item.status !== status) continue;
      items.push({
        item_id: item.id,
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        status: item.status,
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        meeting_date: meeting.date,
      });
    }
  }
  return items.sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));
}

export async function completeActionItem(itemId) {
  const db = await load();
  for (const meeting of db.meetings) {
    const item = meeting.action_items.find((i) => i.id === itemId);
    if (item) {
      item.status = "done";
      item.completed_at = new Date().toISOString();
      await save(db);
      return { item_id: item.id, task: item.task, status: item.status, meeting_title: meeting.title };
    }
  }
  throw new Error(`No action item found with id ${itemId}`);
}

export async function searchMeetings(keyword) {
  const db = await load();
  const q = keyword.toLowerCase();
  const matches = [];
  for (const meeting of db.meetings) {
    const haystacks = [
      meeting.title,
      meeting.summary,
      meeting.raw_notes,
      ...meeting.decisions,
      ...meeting.open_questions,
      ...meeting.action_items.map((i) => i.task),
    ];
    const hit = haystacks.some((h) => (h || "").toLowerCase().includes(q));
    if (hit) {
      matches.push({ id: meeting.id, title: meeting.title, date: meeting.date });
    }
  }
  return matches;
}
