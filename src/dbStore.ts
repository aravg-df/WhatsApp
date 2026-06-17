import * as fs from 'fs';
import * as path from 'path';
import { ContactGroup, BroadcastHistory, ScheduledBroadcast, MasterContact, Client } from './types.js';
import mongoose from 'mongoose';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  clients: Client[];
  groups: ContactGroup[];
  history: BroadcastHistory[];
  schedules?: ScheduledBroadcast[];
  masterContacts?: MasterContact[];
}

const DEFAULT_DB: DatabaseSchema = {
  clients: [
    { id: 'client-1', name: 'Dream Filer' }
  ],
  groups: [
    {
      id: 'g-default',
      clientId: 'client-1',
      name: 'test',
      description: 'A sample group to help you get started. Edit or delete this.',
      contacts: [
        { id: 'c-1', name: 'India Test User-Arav', phone: '9238936229', countryCode: '91' }
      ]
    }
  ],
  history: [],
  schedules: [],
  masterContacts: []
};

// --- Mongoose Models ---
const ClientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String }
});

const GroupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  contacts: { type: Array, default: [] }
});

const HistorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  gateway: { type: String },
  channel: { type: String },
  templateId: { type: String },
  templateBody: { type: String },
  messageText: { type: String },
  groupName: { type: String },
  status: { type: String },
  totalRecipients: { type: Number },
  successCount: { type: Number },
  failedCount: { type: Number },
  inQueueCount: { type: Number },
  recipients: { type: Array, default: [] },
  timestamp: { type: String },
  finishedAt: { type: String, required: false }
});

const ScheduleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  groupName: { type: String },
  groupId: { type: String },
  customContacts: { type: Array, default: [] },
  gateway: { type: String },
  channel: { type: String },
  templateId: { type: String },
  message: { type: String },
  scheduleTimeIST: { type: String },
  status: { type: String },
  createdAt: { type: String },
  twilioWhatsAppFrom: { type: String },
  authkeyWhatsAppSender: { type: String }
});

const MasterContactSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  countryCode: { type: String },
  groupAssignments: { type: mongoose.Schema.Types.Mixed, default: {} },
  rawData: { type: mongoose.Schema.Types.Mixed }
});

const ClientModel = mongoose.models.Client || mongoose.model('Client', ClientSchema);
const Group = mongoose.models.Group || mongoose.model('Group', GroupSchema);
const History = mongoose.models.History || mongoose.model('History', HistorySchema);
const Schedule = mongoose.models.Schedule || mongoose.model('Schedule', ScheduleSchema);
const MasterContactModel = mongoose.models.MasterContact || mongoose.model('MasterContact', MasterContactSchema);

let isMongoConnected = false;

export async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (uri && uri.startsWith('mongodb')) {
    try {
      const options: any = { serverSelectionTimeoutMS: 5000 };
      let cleanUri = uri;
      
      try {
        const parsedUrl = new URL(uri);
        if (parsedUrl.pathname && parsedUrl.pathname.length > 1) {
          let dbName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
          options.dbName = dbName;
          parsedUrl.pathname = '/' + dbName;
          cleanUri = parsedUrl.toString();
        }
      } catch (e) {
        // ignore
        cleanUri = uri.replace(/([^:])\/\/+([^\/?]+)/, '$1/$2');
      }

      await mongoose.connect(cleanUri, options);
      isMongoConnected = true;
      console.log('Successfully connected to MongoDB via dbStore.');
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err);
    }
  } else {
    console.log('No valid MONGO_URI provided, using local JSON storage.');
  }
}

// Ensure local JSON DB is initialized
function ensureInitializedLocal(): DatabaseSchema {
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
    if (!db.clients) db.clients = [{ id: 'client-1', name: 'Dream Filer' }];
    if (!db.groups) db.groups = [];
    if (!db.history) db.history = [];
    if (!db.schedules) db.schedules = [];
    if (!db.masterContacts) db.masterContacts = [];
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    return DEFAULT_DB;
  }
}

export function getDbLocal(): DatabaseSchema {
  return ensureInitializedLocal();
}

export function saveDbLocal(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// ---------------------------------------------
// Client helpers
// ---------------------------------------------
export async function getClients(): Promise<Client[]> {
  if (isMongoConnected) {
    const docs = await ClientModel.find().lean();
    if (docs.length === 0) {
      const defaultClient = { id: 'client-1', name: 'Dream Filer' };
      await ClientModel.create(defaultClient);
      return [defaultClient] as unknown as Client[];
    }
    return docs as unknown as Client[];
  }
  const db = getDbLocal();
  return db.clients;
}

export async function saveClient(client: Client): Promise<Client> {
  if (isMongoConnected) {
    await ClientModel.findOneAndUpdate({ id: client.id } as any, client, { upsert: true, new: true });
    return client;
  }
  const db = getDbLocal();
  const index = db.clients.findIndex(c => c.id === client.id);
  if (index !== -1) db.clients[index] = client;
  else db.clients.push(client);
  saveDbLocal(db);
  return client;
}

export async function deleteClient(id: string): Promise<boolean> {
  if (isMongoConnected) {
    const res = await ClientModel.deleteOne({ id } as any);
    if (res.deletedCount > 0) {
      await Group.deleteMany({ clientId: id } as any); // Delete all groups in this client
    }
    return res.deletedCount > 0;
  }
  const db = getDbLocal();
  const originalLength = db.clients.length;
  db.clients = db.clients.filter(c => c.id !== id);
  if (db.clients.length !== originalLength) {
    // Delete groups
    db.groups = db.groups.filter(g => g.clientId !== id);
    saveDbLocal(db);
    return true;
  }
  return false;
}

// ---------------------------------------------
// Group helpers
// ---------------------------------------------
export async function getGroups(): Promise<ContactGroup[]> {
  const masterContacts = await getMasterContacts();
  
  if (isMongoConnected) {
    const docs = await Group.find().lean();
    return docs.map(d => {
      const gId = String(d.id);
      const groupContacts = masterContacts.filter(mc => mc.groupAssignments && mc.groupAssignments[d.clientId || 'client-1'] === gId).map(mc => ({
        id: mc.id,
        name: mc.name,
        phone: mc.phone,
        countryCode: mc.countryCode
      }));
      return {
        id: gId,
        clientId: d.clientId || 'client-1',
        name: d.name,
        description: d.description,
        contacts: groupContacts,
      };
    }) as unknown as ContactGroup[];
  }
  const db = getDbLocal();
  return db.groups.map(g => {
    const groupContacts = masterContacts.filter(mc => mc.groupAssignments && mc.groupAssignments[g.clientId || 'client-1'] === g.id).map(mc => ({
        id: mc.id,
        name: mc.name,
        phone: mc.phone,
        countryCode: mc.countryCode
    }));
    return {
      ...g,
      contacts: groupContacts
    }
  });
}

export async function saveGroup(group: ContactGroup): Promise<ContactGroup> {
  // Sync back to MasterContacts: any contact inside group.contacts gets their groupAssignments mapping updated.
  const allMaster = await getMasterContacts();
  const clientId = group.clientId || 'client-1';
  
  if (isMongoConnected) {
    await Group.findOneAndUpdate({ id: group.id } as any, group, { upsert: true, new: true });
    // update masters
    for (const c of group.contacts) {
      const existing = allMaster.find(mc => mc.phone === c.phone);
      if (existing) {
         if (!existing.groupAssignments || existing.groupAssignments[clientId] !== group.id) {
           const updatePath = `groupAssignments.${clientId}`;
           await MasterContactModel.updateOne({ id: existing.id } as any, { $set: { [updatePath]: group.id } });
         }
      } else {
         const newMc = { id: c.id, name: c.name, phone: c.phone, countryCode: c.countryCode, groupAssignments: { [clientId]: group.id } };
         await MasterContactModel.findOneAndUpdate({ id: c.id } as any, newMc, { upsert: true, new: true });
      }
    }
    // Remove group ID from contacts that were deleted from this group
    const groupMasterContacts = allMaster.filter(mc => mc.groupAssignments && mc.groupAssignments[clientId] === group.id);
    for (const mc of groupMasterContacts) {
      if (!group.contacts.find(c => c.phone === mc.phone)) {
        const unsetPath = `groupAssignments.${clientId}`;
        await MasterContactModel.updateOne({ id: mc.id } as any, { $unset: { [unsetPath]: "" } });
      }
    }
    return group;
  }
  const db = getDbLocal();
  const index = db.groups.findIndex(g => g.id === group.id);
  if (index !== -1) db.groups[index] = group;
  else db.groups.push(group);
  
  // update masters locally
  if (!db.masterContacts) db.masterContacts = [];
  for (const c of group.contacts) {
      const existing = db.masterContacts.find(mc => mc.phone === c.phone);
      if (existing) {
         if (!existing.groupAssignments) existing.groupAssignments = {};
         existing.groupAssignments[clientId] = group.id;
      } else {
         db.masterContacts.push({
             id: c.id, name: c.name, phone: c.phone, countryCode: c.countryCode, groupAssignments: { [clientId]: group.id }
         });
      }
  }
  const groupMasterContacts = db.masterContacts.filter(mc => mc.groupAssignments && mc.groupAssignments[clientId] === group.id);
  for (const mc of groupMasterContacts) {
    if (!group.contacts.find(c => c.phone === mc.phone)) {
      if (mc.groupAssignments) delete mc.groupAssignments[clientId];
    }
  }

  saveDbLocal(db);
  return group;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const allGroups = await getGroups();
  const group = allGroups.find(g => g.id === id);
  if (isMongoConnected) {
    const res = await Group.deleteOne({ id } as any);
    if (res.deletedCount > 0 && group) {
      const unsetPath = `groupAssignments.${group.clientId}`;
      await MasterContactModel.updateMany(
         { [unsetPath]: id } as any,
         { $unset: { [unsetPath]: "" } }
      );
      return true;
    }
    return false;
  }
  const db = getDbLocal();
  const originalLength = db.groups.length;
  db.groups = db.groups.filter(g => g.id !== id);
  if (db.groups.length !== originalLength && group) {
    if (db.masterContacts) {
       for (const mc of db.masterContacts) {
          if (mc.groupAssignments && mc.groupAssignments[group.clientId] === id) {
             delete mc.groupAssignments[group.clientId];
          }
       }
    }
    saveDbLocal(db);
    return true;
  }
  return false;
}

// ---------------------------------------------
// History helpers
// ---------------------------------------------
export async function getHistory(): Promise<BroadcastHistory[]> {
  if (isMongoConnected) {
    const docs = await History.find().sort({ timestamp: -1 }).lean();
    return docs as unknown as BroadcastHistory[];
  }
  const db = getDbLocal();
  return db.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function saveHistory(historyItem: BroadcastHistory): Promise<BroadcastHistory> {
  if (isMongoConnected) {
    await History.findOneAndUpdate({ id: historyItem.id } as any, historyItem, { upsert: true, new: true });
    return historyItem;
  }
  const db = getDbLocal();
  const index = db.history.findIndex(h => h.id === historyItem.id);
  if (index !== -1) db.history[index] = historyItem;
  else db.history.push(historyItem);
  saveDbLocal(db);
  return historyItem;
}

export async function clearHistory(): Promise<void> {
  if (isMongoConnected) {
    await History.deleteMany({});
    return;
  }
  const db = getDbLocal();
  db.history = [];
  saveDbLocal(db);
}

// ---------------------------------------------
// Schedules helpers
// ---------------------------------------------
export async function getSchedules(): Promise<ScheduledBroadcast[]> {
  if (isMongoConnected) {
    const docs = await Schedule.find().sort({ createdAt: -1 }).lean();
    return docs as unknown as ScheduledBroadcast[];
  }
  const db = getDbLocal();
  if (!db.schedules) db.schedules = [];
  return db.schedules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveSchedule(schedule: ScheduledBroadcast): Promise<ScheduledBroadcast> {
  if (isMongoConnected) {
    await Schedule.findOneAndUpdate({ id: schedule.id } as any, schedule, { upsert: true, new: true });
    return schedule;
  }
  const db = getDbLocal();
  if (!db.schedules) db.schedules = [];
  const index = db.schedules.findIndex(s => s.id === schedule.id);
  if (index !== -1) db.schedules[index] = schedule;
  else db.schedules.push(schedule);
  saveDbLocal(db);
  return schedule;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (isMongoConnected) {
    const res = await Schedule.deleteOne({ id } as any);
    return res.deletedCount > 0;
  }
  const db = getDbLocal();
  if (!db.schedules) db.schedules = [];
  const originalLength = db.schedules.length;
  db.schedules = db.schedules.filter(s => s.id !== id);
  if (db.schedules.length !== originalLength) {
    saveDbLocal(db);
    return true;
  }
  return false;
}

// ---------------------------------------------
// MasterContact helpers
// ---------------------------------------------
export async function getMasterContacts(): Promise<any[]> {
  if (isMongoConnected) {
    const docs = await MasterContactModel.find().lean();
    return docs as unknown as any[];
  }
  const db = getDbLocal();
  if (!db.masterContacts) db.masterContacts = [];
  return db.masterContacts;
}

export async function saveMasterContact(contact: any): Promise<any> {
  if (isMongoConnected) {
    await MasterContactModel.findOneAndUpdate({ id: contact.id } as any, contact, { upsert: true, new: true });
    return contact;
  }
  const db = getDbLocal();
  if (!db.masterContacts) db.masterContacts = [];
  const index = db.masterContacts.findIndex(c => c.id === contact.id);
  if (index !== -1) db.masterContacts[index] = contact;
  else db.masterContacts.push(contact);
  saveDbLocal(db);
  return contact;
}

export async function updateMasterContactGroupId(id: string, clientId: string, groupId: string | null): Promise<void> {
  if (isMongoConnected) {
    const updatePath = `groupAssignments.${clientId}`;
    if (groupId === null) {
      await MasterContactModel.updateOne({ id } as any, { $unset: { [updatePath]: "" } });
    } else {
      await MasterContactModel.updateOne({ id } as any, { $set: { [updatePath]: groupId } });
    }
    return;
  }
  const db = getDbLocal();
  if (!db.masterContacts) db.masterContacts = [];
  const contact = db.masterContacts.find(c => c.id === id);
  if (contact) {
    if (!contact.groupAssignments) contact.groupAssignments = {};
    if (groupId === null) {
      delete contact.groupAssignments[clientId];
    } else {
      contact.groupAssignments[clientId] = groupId;
    }
    saveDbLocal(db);
  }
}

export async function deleteMasterContact(id: string): Promise<boolean> {
  if (isMongoConnected) {
    const res = await MasterContactModel.deleteOne({ id } as any);
    return res.deletedCount > 0;
  }
  const db = getDbLocal();
  if (!db.masterContacts) db.masterContacts = [];
  const originalLength = db.masterContacts.length;
  db.masterContacts = db.masterContacts.filter(c => c.id !== id);
  if (db.masterContacts.length !== originalLength) {
    saveDbLocal(db);
    return true;
  }
  return false;
}


