export interface Contact {
  id: string;
  name: string;
  phone: string;
  countryCode: string; // e.g., "91", "1", etc.
}

export interface MasterContact {
  id: string;
  name: string; // clean name without prefixes
  phone: string;
  countryCode: string;
  groupId?: string; // only goes to one group
}

export interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contacts: Contact[];
}

export interface BroadcastRecipient {
  phone: string;
  name: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  channelUsed?: 'twilio' | 'authkey';
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'replied';
  replyText?: string;
  replyTime?: string;
}

export interface BroadcastHistory {
  id: string;
  timestamp: string;
  gateway: 'twilio' | 'authkey' | 'both';
  message: string;
  groupName: string;
  totalContacts: number;
  successCount: number;
  failedCount: number;
  recipients: BroadcastRecipient[];
  status: 'completed' | 'in_progress' | 'failed';
  channel?: 'sms' | 'whatsapp';
  templateId?: string;
}

export interface SystemConfigStatus {
  twilioConfigured: boolean;
  twilioFrom: string;
  twilioWhatsAppFrom?: string;
  authkeyConfigured: boolean;
  authkeySender: string;
  authkeyWhatsAppSender?: string;
}

export interface ScheduledBroadcast {
  id: string;
  groupId: string;
  groupName: string;
  customContacts?: Contact[];
  gateway: 'twilio' | 'authkey' | 'both';
  channel: 'sms' | 'whatsapp';
  templateId?: string;
  message: string;
  scheduleTimeIST: string; // "YYYY-MM-DD HH:mm"
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  createdAt: string;
}
