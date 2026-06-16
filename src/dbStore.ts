import * as fs from 'fs';
import * as path from 'path';
import { ContactGroup, BroadcastHistory, ScheduledBroadcast } from './types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  groups: ContactGroup[];
  history: BroadcastHistory[];
  schedules?: ScheduledBroadcast[];
}

const DEFAULT_DB: DatabaseSchema = {
  groups: [
    {
      id: 'g-default',
      name: 'Sample Group',
      description: 'A sample group to help you get started. Edit or delete this.',
      contacts: [
        { id: 'c-1', name: 'India Test User-Arav', phone: '9238936229', countryCode: '91' }
      ]
    }
  ],
  history: [],
  schedules: []
};

function ensureInitialized(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw) as DatabaseSchema;
    // Backwards compatibility and schema safety check
    if (!db.groups) db.groups = [];
    if (!db.history) db.history = [];
    if (!db.schedules) db.schedules = [];
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    return DEFAULT_DB;
  }
}

export function getDb(): DatabaseSchema {
  return ensureInitialized();
}

export function saveDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Group helpers
export function getGroups(): ContactGroup[] {
  return getDb().groups;
}

export function saveGroup(group: ContactGroup): ContactGroup {
  const db = getDb();
  const index = db.groups.findIndex(g => g.id === group.id);
  if (index !== -1) {
    db.groups[index] = group;
  } else {
    db.groups.push(group);
  }
  saveDb(db);
  return group;
}

export function deleteGroup(id: string): boolean {
  const db = getDb();
  const originalLength = db.groups.length;
  db.groups = db.groups.filter(g => g.id !== id);
  if (db.groups.length !== originalLength) {
    saveDb(db);
    return true;
  }
  return false;
}

// History helpers
export function getHistory(): BroadcastHistory[] {
  const db = getDb();
  return db.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function saveHistory(historyItem: BroadcastHistory): BroadcastHistory {
  const db = getDb();
  const index = db.history.findIndex(h => h.id === historyItem.id);
  if (index !== -1) {
    db.history[index] = historyItem;
  } else {
    db.history.push(historyItem);
  }
  saveDb(db);
  return historyItem;
}

export function clearHistory(): void {
  const db = getDb();
  db.history = [];
  saveDb(db);
}

// Schedules helpers
export function getSchedules(): ScheduledBroadcast[] {
  const db = getDb();
  if (!db.schedules) db.schedules = [];
  return db.schedules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveSchedule(schedule: ScheduledBroadcast): ScheduledBroadcast {
  const db = getDb();
  if (!db.schedules) db.schedules = [];
  const index = db.schedules.findIndex(s => s.id === schedule.id);
  if (index !== -1) {
    db.schedules[index] = schedule;
  } else {
    db.schedules.push(schedule);
  }
  saveDb(db);
  return schedule;
}

export function deleteSchedule(id: string): boolean {
  const db = getDb();
  if (!db.schedules) db.schedules = [];
  const originalLength = db.schedules.length;
  db.schedules = db.schedules.filter(s => s.id !== id);
  if (db.schedules.length !== originalLength) {
    saveDb(db);
    return true;
  }
  return false;
}
