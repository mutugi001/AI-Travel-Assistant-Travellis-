import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureFile(file, initial) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
}

function readJson(file) {
  ensureFile(file, {});
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export const jsonStore = {
  async init() {
    ensureFile(CONVERSATIONS_FILE, {});
    ensureFile(LEADS_FILE, {});
    console.log("[storage] Using local JSON file storage at backend/data/");
  },

  async getConversation(conversationId) {
    const all = readJson(CONVERSATIONS_FILE);
    return all[conversationId] || null;
  },

  async saveConversation(conversationId, conversation) {
    const all = readJson(CONVERSATIONS_FILE);
    all[conversationId] = { ...conversation, updatedAt: new Date().toISOString() };
    writeJson(CONVERSATIONS_FILE, all);
    return all[conversationId];
  },

  async upsertLead(conversationId, lead) {
    const all = readJson(LEADS_FILE);
    const existing = all[conversationId];
    const record = {
      ...lead,
      conversationId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all[conversationId] = record;
    writeJson(LEADS_FILE, all);
    return record;
  },

  async getAllLeads() {
    const all = readJson(LEADS_FILE);
    return Object.values(all).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  },

  async getLead(conversationId) {
    const all = readJson(LEADS_FILE);
    return all[conversationId] || null;
  },
};
