import express from 'express';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import {
  getGroups,
  saveGroup,
  deleteGroup,
  getHistory,
  saveHistory,
  clearHistory,
  getSchedules,
  saveSchedule,
  deleteSchedule,
  connectMongo,
  getMasterContacts,
  saveMasterContact,
  updateMasterContactGroupId,
  deleteMasterContact,
  getClients,
  saveClient,
  deleteClient
} from './src/dbStore.js';
import { Contact, ContactGroup, BroadcastHistory, BroadcastRecipient, ScheduledBroadcast, MasterContact } from './src/types.js';

// Load environment variables
dotenv.config();

async function startServer() {
  await connectMongo();
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- API Routes ---

  // Check env configuration status
  app.get('/api/status', async (req, res) => {
    const twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
    const authkeyConfigured = !!(
      process.env.AUTHKEY_API_KEY &&
      process.env.AUTHKEY_SENDER_ID
    );

    res.json({
      twilioConfigured,
      twilioFrom: process.env.TWILIO_FROM_NUMBER || '',
      twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM_NUMBER || '',
      authkeyConfigured,
      authkeySender: process.env.AUTHKEY_SENDER_ID || '',
      authkeyWhatsAppSender: process.env.AUTHKEY_WHATSAPP_SENDER_ID || '',
    });
  });

  // Get live WhatsApp templates from Twilio & Authkey systems directly
  app.get('/api/whatsapp/templates', async (req, res) => {
    const twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN
    );
    const authkeyConfigured = !!(
      process.env.AUTHKEY_API_KEY &&
      process.env.AUTHKEY_SENDER_ID
    );

    const templates: any[] = [];
    const logs: string[] = [];

    // 1. Live Twilio Content API Retrieval
    if (twilioConfigured) {
      try {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
        
        logs.push('Querying Twilio WhatsApp Content API (v1/Content)...');
        const response = await fetch('https://content.twilio.com/v1/Content', {
          headers: { 'Authorization': authHeader }
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data && Array.isArray(data.contents)) {
            data.contents.forEach((item: any) => {
              let body = '';
              let format: 'text' | 'media' | 'quick_reply' | 'cta' | 'otp' = 'text';
              let buttonText1 = undefined;
              let buttonText2 = undefined;
              let ctaText = undefined;
              let ctaUrl = undefined;
              let ctaPhone = undefined;

              if (item.types) {
                const textType = item.types['twilio/text'];
                const mediaType = item.types['twilio/media'];
                const cardType = item.types['twilio/card'];
                const quickReplyType = item.types['twilio/quick_reply'];

                if (mediaType) {
                  body = mediaType.body || '';
                  format = 'media';
                } else if (textType) {
                  body = textType.body || '';
                  format = 'text';
                } else if (quickReplyType) {
                  body = quickReplyType.body || '';
                  format = 'quick_reply';
                  if (Array.isArray(quickReplyType.actions)) {
                    buttonText1 = quickReplyType.actions[0]?.title;
                    buttonText2 = quickReplyType.actions[1]?.title;
                  }
                } else if (cardType) {
                  body = cardType.body || '';
                  format = 'cta';
                  if (Array.isArray(cardType.actions)) {
                    const urlAction = cardType.actions.find((a: any) => a.type === 'URL');
                    const phoneAction = cardType.actions.find((a: any) => a.type === 'PHONE');
                    if (urlAction) {
                      ctaText = urlAction.title;
                      ctaUrl = urlAction.url;
                    }
                    if (phoneAction) {
                      ctaPhone = phoneAction.phone;
                    }
                  }
                }
              }

              templates.push({
                id: item.sid,
                name: item.friendly_name || item.sid,
                body: body,
                status: 'approved',
                type: 'utility',
                format: format,
                gateway: 'twilio',
                buttonText1,
                buttonText2,
                ctaText,
                ctaUrl,
                ctaPhone
              });
            });
            logs.push(`Successfully loaded ${data.contents.length} live Twilio Content templates!`);
          } else {
            logs.push('Twilio API returned success but empty contents array.');
          }
        } else {
          const errText = await response.text();
          logs.push(`Twilio Content listing responded status ${response.status}: ${errText.substring(0, 150)}`);
        }
      } catch (err: any) {
        logs.push(`Twilio fetch exception: ${err.message}`);
      }
    } else {
      logs.push('Twilio profile is not configured on this server instance.');
    }

    if (authkeyConfigured) {
      logs.push('Fetching live Meta templates from Authkey...');
      try {
        const apiKey = process.env.AUTHKEY_API_KEY!;
        const authkeyResponse = await fetch('https://console.authkey.io/restapi/getAllTemplate.php', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ channel: 'whatsapp' })
        });
        
        if (authkeyResponse.ok) {
          const bodyTxt = await authkeyResponse.text();
          try {
            const data = JSON.parse(bodyTxt);
            if (data.status && Array.isArray(data.data)) {
              data.data.forEach((temp: any) => {
                templates.push({
                  id: String(temp.wid),
                  name: temp.temp_name || String(temp.wid),
                  body: temp.temp_body || '',
                  status: temp.temp_status === 1 ? 'approved' : 'pending',
                  type: temp.temp_category || 'marketing',
                  format: 'text',
                  gateway: 'authkey'
                });
              });
              logs.push(`Successfully loaded ${data.data.length} live Authkey WhatsApp templates!`);
            } else {
              logs.push('Authkey API returned valid JSON without expected template layout.');
            }
          } catch (e) {
            logs.push(`Failed to parse Authkey template response: ${bodyTxt.substring(0, 100)}`);
          }
        } else {
          logs.push(`Authkey API responded with status ${authkeyResponse.status}`);
        }
      } catch (err: any) {
        logs.push(`Authkey fetch exception: ${err.message}`);
      }
    } else {
      logs.push('Authkey profile is not configured on this server instance.');
    }

    res.json({
      success: true,
      twilioConfigured,
      authkeyConfigured,
      templates,
      logs
    });
  });

  // Master Contacts Endpoints
  app.get('/api/master-contacts', async (req, res) => {
    try {
      res.json(await getMasterContacts());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/master-contacts/bulk', async (req, res) => {
    try {
      const contacts: MasterContact[] = req.body.contacts;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Expected an array of contacts' });
      }
      for (const c of contacts) {
        if (!c.id) {
          c.id = 'mc-' + Math.random().toString(36).substring(2, 9);
        }
        await saveMasterContact(c);
      }
      res.json({ success: true, message: `Saved ${contacts.length} master contacts.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/master-contacts/bulk-group', async (req, res) => {
    try {
      const { contactIds, groupId, clientId } = req.body;
      if (!Array.isArray(contactIds) || !clientId) {
        return res.status(400).json({ error: 'Expected an array of contactIds and a clientId' });
      }
      for (const id of contactIds) {
        await updateMasterContactGroupId(id, clientId, groupId || null);
      }
      res.json({ success: true, message: `Updated group for ${contactIds.length} contacts.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/master-contacts/bulk-delete', async (req, res) => {
    try {
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds)) {
        return res.status(400).json({ error: 'Expected an array of contactIds' });
      }
      for (const id of contactIds) {
        await deleteMasterContact(id);
      }
      res.json({ success: true, message: `Deleted ${contactIds.length} contacts.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Balance Endpoints
  app.get('/api/balance/twilio', async (req, res) => {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      if (!sid || !token) {
        return res.status(400).json({ error: 'Twilio not configured' });
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
      const response = await fetch(url, { headers: { 'Authorization': authHeader } });
      const data = await response.json() as any;
      
      if (response.ok) {
        res.json({ balance: data.balance, currency: data.currency });
      } else {
        res.status(500).json({ error: data.message || 'Failed to fetch Twilio balance' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/balance/authkey', async (req, res) => {
    try {
      const apiKey = process.env.AUTHKEY_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Authkey not configured' });
      }

      const response = await fetch(`https://console.authkey.io/restapi/getbalance.php?authkey=${apiKey.trim()}`);
      const text = await response.text();
      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = { balance: text }; // Fallback if API returns raw text for balance
      }
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clients Endpoints
  app.get('/api/clients', async (req, res) => {
    try {
      res.json(await getClients());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      const client = req.body;
      if (!client.name) return res.status(400).json({ error: 'Client name is required' });
      if (!client.id) client.id = 'client-' + Math.random().toString(36).substring(2, 9);
      res.json(await saveClient(client));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Groups and Contacts Management Endpoints
  app.get('/api/groups', async (req, res) => {
    try {
      res.json(await getGroups());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/groups', async (req, res) => {
    try {
      const group: ContactGroup = req.body;
      if (!group.name) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      if (!group.id) {
        group.id = 'g-' + Math.random().toString(36).substring(2, 9);
      }
      if (!group.contacts) {
        group.contacts = [];
      }
      await saveGroup(group);
      res.status(201).json(group);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/groups/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const group: ContactGroup = req.body;
      group.id = id;
      if (!group.name) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      await saveGroup(group);
      res.json(group);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/groups/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteGroup(id);
      if (deleted) {
        res.json({ success: true, message: 'Group deleted successfully' });
      } else {
        res.status(404).json({ error: 'Group not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // History Endpoints
  app.get('/api/history', async (req, res) => {
    try {
      res.json(await getHistory());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/history/clear', async (req, res) => {
    try {
      await clearHistory();
      res.json({ success: true, message: 'Broadcast history cleared successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Balance Helpers
  async function getTwilioBalanceLive(): Promise<number> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return 0;
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
      const response = await fetch(url, { headers: { 'Authorization': authHeader } });
      const data = await response.json() as any;
      if (response.ok) {
        return parseFloat(data.balance);
      }
    } catch { }
    return 0;
  }

  async function getAuthkeyBalanceLive(): Promise<number> {
    const apiKey = process.env.AUTHKEY_API_KEY;
    if (!apiKey) return 0;
    try {
      const response = await fetch(`https://console.authkey.io/restapi/getbalance.php?authkey=${apiKey.trim()}`);
      const text = await response.text();
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
        return parseFloat(parsed.balance || 0);
      } catch (e) {
        return parseFloat(text); // Fallback if API returns raw text for balance
      }
    } catch { }
    return 0;
  }

  // SMS Helpers
  async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; error?: string; cost?: number }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return { success: false, error: 'Twilio credentials are not configured on the server.' };
    }

    const startBalance = await getTwilioBalanceLive();

    try {
      // Normalize number
      let normalizedTo = to.trim();
      if (!normalizedTo.startsWith('+')) {
        normalizedTo = '+' + normalizedTo;
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
      
      const params = new URLSearchParams();
      params.append('To', normalizedTo);
      params.append('From', from.trim());
      params.append('Body', message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data = await response.json() as any;
      const endBalance = await getTwilioBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));

      if (response.ok) {
        return { success: true, cost: cost > 0 ? cost : undefined };
      } else {
        return { success: false, error: data.message || `Twilio Code ${data.code || response.status}: ${data.message || 'Error'}`, cost: cost > 0 ? cost : undefined };
      }
    } catch (err: any) {
      const endBalance = await getTwilioBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));
      return { success: false, error: err.message || 'Unknown network error calling Twilio', cost: cost > 0 ? cost : undefined };
    }
  }

  async function sendAuthkeySMS(phone: string, countryCode: string, message: string): Promise<{ success: boolean; error?: string; cost?: number }> {
    const apiKey = process.env.AUTHKEY_API_KEY;
    const senderId = process.env.AUTHKEY_SENDER_ID;

    if (!apiKey || !senderId || apiKey.includes('YOUR_') || apiKey.includes('DUMMY') || !apiKey.trim() || senderId.includes('YOUR_')) {
      // Graceful sandbox test simulation when API credentials are not set
      console.log(`[SIMULATOR] Authkey SMS credentials not configured. Simulating successful SMS delivery to ${phone}`);
      return { success: true };
    }

    const startBalance = await getAuthkeyBalanceLive();

    try {
      const cleanCountry = countryCode.replace('+', '').trim();
      // Ensure phone is clean digits
      const cleanPhone = phone.replace(/\D/g, '').trim();

      const url = new URL('https://api.authkey.io/request');
      url.searchParams.append('authkey', apiKey.trim());
      url.searchParams.append('mobile', cleanPhone);
      url.searchParams.append('country_code', cleanCountry);
      url.searchParams.append('sender', senderId.trim());
      url.searchParams.append('message', message);
      url.searchParams.append('route', '4'); // Default route '4' (Transactional)

      const response = await fetch(url.toString(), {
        method: 'GET',
      });

      const text = await response.text();
      const endBalance = await getAuthkeyBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));

      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return { success: true, cost: cost > 0 ? cost : undefined };
        } else {
          return { success: false, error: data.message || `Authkey API failure: ${text}`, cost: cost > 0 ? cost : undefined };
        }
      } catch {
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted')) {
          return { success: true, cost: cost > 0 ? cost : undefined };
        }
        return { success: false, error: `Response: ${text.substring(0, 100)}`, cost: cost > 0 ? cost : undefined };
      }
    } catch (err: any) {
      const endBalance = await getAuthkeyBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));
      return { success: false, error: err.message || 'Unknown network error calling Authkey', cost: cost > 0 ? cost : undefined };
    }
  }

  // --- WhatsApp Helpers ---
  async function sendTwilioWhatsApp(to: string, message: string, templateId?: string, senderOverride?: string): Promise<{ success: boolean; error?: string; cost?: number }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    let from = senderOverride || process.env.TWILIO_WHATSAPP_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return { success: false, error: 'Twilio credentials are not configured on the server.' };
    }

    const startBalance = await getTwilioBalanceLive();

    try {
      let normalizedTo = to.trim();
      if (!normalizedTo.startsWith('whatsapp:')) {
        normalizedTo = 'whatsapp:' + (normalizedTo.startsWith('+') ? '' : '+') + normalizedTo;
      }

      let normalizedFrom = from.trim();
      if (!normalizedFrom.startsWith('whatsapp:')) {
        normalizedFrom = 'whatsapp:' + (normalizedFrom.startsWith('+') ? '' : '+') + normalizedFrom;
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
      
      const params = new URLSearchParams();
      params.append('To', normalizedTo);
      params.append('From', normalizedFrom);
      
      if (templateId && templateId.trim()) {
        params.append('ContentSid', templateId.trim());
        params.append('Body', message);
      } else {
        params.append('Body', message);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data = await response.json() as any;
      const endBalance = await getTwilioBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));

      if (response.ok) {
        return { success: true, cost: cost > 0 ? cost : undefined };
      } else {
        return { success: false, error: data.message || `Twilio WhatsApp Code ${data.code || response.status}: ${data.message || 'Error'}`, cost: cost > 0 ? cost : undefined };
      }
    } catch (err: any) {
      const endBalance = await getTwilioBalanceLive();
      const cost = parseFloat((startBalance - endBalance).toFixed(5));
      return { success: false, error: err.message || 'Unknown network error calling Twilio WhatsApp', cost: cost > 0 ? cost : undefined };
    }
  }

  async function sendAuthkeyWhatsAppBulk(recipients: Contact[], templateId: string, message: string, senderOverride?: string): Promise<{ success: boolean; error?: string; costPerMessage?: number }> {
    const apiKey = process.env.AUTHKEY_API_KEY;
    const senderId = senderOverride || process.env.AUTHKEY_SENDER_ID || '';

    if (!apiKey || !apiKey.trim() || apiKey.includes('YOUR_') || apiKey.includes('DUMMY')) {
      console.log(`[SIMULATOR] Authkey credentials not configured. Simulating successful WhatsApp automated bulk sending to ${recipients.length} contacts with template ID ${templateId}`);
      return { success: true };
    }

    const startBalance = await getAuthkeyBalanceLive();

    try {
      const url = 'https://console.authkey.io/restapi/requestjson_v2.0.php';
      
      const payloadData = recipients.map(contact => {
        const cleanPhone = contact.phone.replace(/\D/g, '').trim();
        return {
          mobile: cleanPhone
        };
      });

      const body = {
        version: "2.0",
        country_code: recipients.length > 0 ? recipients[0].countryCode.replace('+', '').trim() : "91",
        wid: templateId.trim(),
        type: "text",
        data: payloadData
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apiKey.trim()}`
        },
        body: JSON.stringify(body)
      });

      const text = await response.text();
      const endBalance = await getAuthkeyBalanceLive();
      const totalCost = parseFloat((startBalance - endBalance).toFixed(5));
      let costPerMessage: number | undefined = undefined;
      if (totalCost > 0 && recipients.length > 0) {
        costPerMessage = parseFloat((totalCost / recipients.length).toFixed(5));
      }

      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true || data.Message === 'success' || data.message === 'success' || data.status === 'Success') {
          return { success: true, costPerMessage };
        } else {
          if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted') || text.toLowerCase().includes('sent')) {
            return { success: true, costPerMessage };
          }
          return { success: false, error: data.message || data.Message || `Authkey WhatsApp Bulk API failure: ${text}`, costPerMessage };
        }
      } catch {
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted') || text.toLowerCase().includes('sent')) {
          return { success: true, costPerMessage };
        }
        return { success: false, error: `Response: ${text.substring(0, 100)}`, costPerMessage };
      }
    } catch (err: any) {
      const endBalance = await getAuthkeyBalanceLive();
      const totalCost = parseFloat((startBalance - endBalance).toFixed(5));
      let costPerMessage: number | undefined = undefined;
      if (totalCost > 0 && recipients.length > 0) {
        costPerMessage = parseFloat((totalCost / recipients.length).toFixed(5));
      }
      return { success: false, error: err.message || 'Unknown network error calling Authkey WhatsApp Bulk API', costPerMessage };
    }
  }

  // Core Broadcast Worker (Asynchronous background processing)
  async function runBroadcastBackground(
    historyId: string, 
    recipientsToProcess: Contact[], 
    gateway: 'twilio' | 'authkey' | 'both', 
    message: string,
    channel: 'sms' | 'whatsapp' = 'sms',
    templateId = '',
    twilioWhatsAppFrom = '',
    authkeyWhatsAppSender = ''
  ) {
    const historyList = await getHistory();
    const itemIndex = historyList.findIndex(h => h.id === historyId);
    if (itemIndex === -1) return;

    const historyItem = historyList[itemIndex];
    historyItem.status = 'in_progress';
    await saveHistory(historyItem);

    if (gateway === 'authkey' && channel === 'whatsapp' && recipientsToProcess.length > 0) {
      const res = await sendAuthkeyWhatsAppBulk(recipientsToProcess, templateId, message, authkeyWhatsAppSender);
      
      let succ = historyItem.successCount;
      let fail = historyItem.failedCount;

      for (const contact of recipientsToProcess) {
        const fullPhoneWithCode = `${contact.countryCode.startsWith('+') ? '' : '+'}${contact.countryCode}${contact.phone.replace(/\D/g, '')}`;
        const recipientRecord: BroadcastRecipient = {
          phone: fullPhoneWithCode,
          name: contact.name || 'Unknown Contact',
          status: res.success ? 'success' : 'failed',
          channelUsed: 'authkey',
          error: res.error || (res.success ? undefined : 'Authkey WhatsApp bulk submission failed'),
          cost: res.costPerMessage
        };
        
        const recIndex = historyItem.recipients.findIndex(r => r.phone === fullPhoneWithCode);
        if (recIndex >= 0) {
          historyItem.recipients[recIndex] = recipientRecord;
        } else {
          historyItem.recipients.push(recipientRecord);
        }

        if (res.success) succ++;
        else fail++;
      }

      historyItem.successCount = succ;
      historyItem.failedCount = fail;
      historyItem.status = 'completed';
      await saveHistory(historyItem);
      return;
    }

    let successCount = historyItem.successCount;
    let failedCount = historyItem.failedCount;

    // Process sequential to throttle SMS rates safely and update DB state live
    for (let i = 0; i < recipientsToProcess.length; i++) {
      const contact = recipientsToProcess[i];
      const fullPhoneWithCode = `${contact.countryCode.startsWith('+') ? '' : '+'}${contact.countryCode}${contact.phone.replace(/\D/g, '')}`;
      
      const recipientRecord: BroadcastRecipient = {
        phone: fullPhoneWithCode,
        name: contact.name || 'Unknown Contact',
        status: 'pending',
      };

      // Find if we already have this recipient recorded, if yes update it, else add it
      const recIndex = historyItem.recipients.findIndex(r => r.phone === fullPhoneWithCode);
      
      try {
        if (channel === 'whatsapp') {
          if (gateway === 'both') {
            let twilioResult = await sendTwilioWhatsApp(fullPhoneWithCode, message, templateId, twilioWhatsAppFrom);
            let authkeyResult = await sendAuthkeyWhatsAppBulk([contact], templateId, message, authkeyWhatsAppSender);

            if (twilioResult.success && authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.cost = twilioResult.cost;
            } else if (twilioResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.error = `Twilio OK, Authkey failed: ${authkeyResult.error || 'Unknown'}`;
              recipientRecord.cost = twilioResult.cost;
            } else if (authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'authkey';
              recipientRecord.error = `Twilio failed: ${twilioResult.error || 'Unknown'}, Authkey OK`;
              recipientRecord.cost = authkeyResult.costPerMessage;
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = `Twilio: ${twilioResult.error || 'Failed'}. Authkey: ${authkeyResult.error || 'Failed'}`;
              recipientRecord.cost = (twilioResult.cost || 0) + (authkeyResult.costPerMessage || 0) || undefined;
            }
          } else if (gateway === 'twilio') {
            recipientRecord.channelUsed = 'twilio';
            const res = await sendTwilioWhatsApp(fullPhoneWithCode, message, templateId, twilioWhatsAppFrom);
            recipientRecord.cost = res.cost;
            if (res.success) {
              recipientRecord.status = 'success';
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = res.error || 'Twilio WhatsApp submission failed';
            }
          } else {
            recipientRecord.channelUsed = 'authkey';
            const res = await sendAuthkeyWhatsAppBulk([contact], templateId, message, authkeyWhatsAppSender);
            recipientRecord.cost = res.costPerMessage;
            if (res.success) {
              recipientRecord.status = 'success';
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = res.error || 'Authkey WhatsApp submission failed';
            }
          }
        } else {
          // Standard SMS
          if (gateway === 'both') {
            let twilioResult = await sendTwilioSMS(fullPhoneWithCode, message);
            let authkeyResult = await sendAuthkeySMS(contact.phone, contact.countryCode, message);

            if (twilioResult.success && authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.cost = twilioResult.cost;
            } else if (twilioResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.error = `Twilio OK, Authkey failed: ${authkeyResult.error || 'Unknown'}`;
              recipientRecord.cost = twilioResult.cost;
            } else if (authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'authkey';
              recipientRecord.error = `Twilio failed: ${twilioResult.error || 'Unknown'}, Authkey OK`;
              recipientRecord.cost = authkeyResult.cost;
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = `Twilio: ${twilioResult.error || 'Failed'}. Authkey: ${authkeyResult.error || 'Failed'}`;
              recipientRecord.cost = (twilioResult.cost || 0) + (authkeyResult.cost || 0) || undefined;
            }
          } else if (gateway === 'twilio') {
            recipientRecord.channelUsed = 'twilio';
            const res = await sendTwilioSMS(fullPhoneWithCode, message);
            recipientRecord.cost = res.cost;
            if (res.success) {
              recipientRecord.status = 'success';
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = res.error || 'Twilio submission failed';
            }
          } else {
            // authkey
            recipientRecord.channelUsed = 'authkey';
            const res = await sendAuthkeySMS(contact.phone, contact.countryCode, message);
            recipientRecord.cost = res.cost;
            if (res.success) {
              recipientRecord.status = 'success';
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = res.error || 'Authkey submission failed';
            }
          }
        }
      } catch (err: any) {
        recipientRecord.status = 'failed';
        recipientRecord.error = err.message || 'Internal failure';
      }

      // Record count changes
      if (recipientRecord.status === 'success') {
        successCount++;
        recipientRecord.deliveryStatus = 'sent';
        
        // Launch mock delivery and reply status updates asynchronously
        const targetPhone = fullPhoneWithCode;
        setTimeout(() => {
          updateRecipientDeliveryState(historyId, targetPhone, 'delivered');
          
          setTimeout(() => {
            updateRecipientDeliveryState(historyId, targetPhone, 'read');
            
            // 40% chance of recipient replying back
            if (Math.random() < 0.40) {
              setTimeout(() => {
                const randomReply = SIMULATED_REPLIES[Math.floor(Math.random() * SIMULATED_REPLIES.length)];
                updateRecipientDeliveryState(historyId, targetPhone, 'replied', randomReply);
              }, 3000 + Math.random() * 3500);
            }
          }, 2000 + Math.random() * 2500);
        }, 1500 + Math.random() * 1500);
      } else {
        failedCount++;
      }

      // Update recipient state
      if (recIndex !== -1) {
        historyItem.recipients[recIndex] = recipientRecord;
      } else {
        historyItem.recipients.push(recipientRecord);
      }

      historyItem.successCount = successCount;
      historyItem.failedCount = failedCount;
      
      // Save progress
      await saveHistory(historyItem);

      // Brief delay to mitigate rate limiting blocks (e.g. 150ms per SMS)
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    historyItem.status = 'completed';
    await saveHistory(historyItem);
  }

  // Simulator configurations
  const SIMULATED_REPLIES = [
    "Hi, yes! I would love to know more.",
    "Thanks for the update. Is this available today?",
    "Awesome! Confirm my reservation.",
    "Please unsub me from this list.",
    "Can I reply to this number directly?",
    "Perfect, I've received it. Thank you!",
    "Looks great, thank you so much!",
    "Got it! Let me check this later.",
    "Great initiative! Cheers.",
    "Is there an alternative link for payments?"
  ];

  async function updateRecipientDeliveryState(historyId: string, phone: string, nextStatus: 'sent' | 'delivered' | 'read' | 'replied', replyText?: string) {
    try {
      const historyList = await getHistory();
      const itemIndex = historyList.findIndex(h => h.id === historyId);
      if (itemIndex === -1) return;
      const historyItem = historyList[itemIndex];
      const recIndex = historyItem.recipients.findIndex(r => r.phone === phone);
      if (recIndex !== -1) {
        historyItem.recipients[recIndex].deliveryStatus = nextStatus;
        if (nextStatus === 'replied' && replyText) {
          historyItem.recipients[recIndex].replyText = replyText;
          historyItem.recipients[recIndex].replyTime = new Date().toISOString();
        }
        await saveHistory(historyItem);
      }
    } catch (e) {
      console.error('Error simulating reply status update:', e);
    }
  }

  // Trigger Bulk Broadcast API
  app.post('/api/broadcast', async (req, res) => {
    try {
      const { groupId, customContacts, gateway, message, channel, templateId, twilioWhatsAppFrom, authkeyWhatsAppSender } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message content cannot be empty' });
      }

      if (!gateway || !['twilio', 'authkey', 'both'].includes(gateway)) {
        return res.status(400).json({ error: 'Valid gateway selection must be twilio, authkey, or both' });
      }

      let recipientsList: Contact[] = [];
      let targetGroupName = 'Ad-hoc Group';

      if (groupId && groupId !== 'adhoc') {
        const groups = await getGroups();
        const foundGroup = groups.find(g => g.id === groupId);
        if (!foundGroup) {
          return res.status(404).json({ error: 'Select contact group not found' });
        }
        recipientsList = foundGroup.contacts || [];
        targetGroupName = foundGroup.name;
      } else if (customContacts && Array.isArray(customContacts)) {
        recipientsList = customContacts;
      }

      if (recipientsList.length === 0) {
        return res.status(400).json({ error: 'No recipient contacts defined to broadcast to' });
      }

      // Initialize Broadcast history entry
      const historyId = 'blast-' + Math.random().toString(36).substring(2, 9);
      const newHistoryItem: BroadcastHistory = {
        id: historyId,
        timestamp: new Date().toISOString(),
        gateway,
        message,
        groupName: targetGroupName,
        totalContacts: recipientsList.length,
        successCount: 0,
        failedCount: 0,
        recipients: [],
        status: 'in_progress',
        channel: channel || 'sms',
        templateId: templateId || '',
      };

      // Save initial record
      await saveHistory(newHistoryItem);

      // Fire and forget background worker
      runBroadcastBackground(
        historyId, 
        recipientsList, 
        gateway, 
        message, 
        channel || 'sms', 
        templateId || '', 
        twilioWhatsAppFrom || '', 
        authkeyWhatsAppSender || ''
      );

      res.status(202).json({
        success: true,
        message: 'Broadcasting started successfully in the background.',
        historyId,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retry Failed Contacts of specific Broadcast run
  app.post('/api/history/:id/retry', async (req, res) => {
    try {
      const { id } = req.params;
      const historyList = await getHistory();
      const currentRun = historyList.find(h => h.id === id);

      if (!currentRun) {
        return res.status(404).json({ error: 'Broadcast history run not found' });
      }

      const failedRecipients = currentRun.recipients.filter(rec => rec.status === 'failed');

      if (failedRecipients.length === 0) {
        return res.status(400).json({ error: 'There are no failed recipients to retry' });
      }

      // Reconstruct Contact interface for matching failed numbers
      const contactsToRetry: Contact[] = failedRecipients.map((rec, idx) => {
        // Recover simple phone & country code if split
        let rawPhone = rec.phone.replace('+', '');
        let countryCode = '91'; // default fall back
        let phoneNo = rawPhone;

        if (rawPhone.startsWith('91') && rawPhone.length > 10) {
          countryCode = '91';
          phoneNo = rawPhone.substring(2);
        } else if (rawPhone.startsWith('1') && rawPhone.length > 10) {
          countryCode = '1';
          phoneNo = rawPhone.substring(1);
        }

        return {
          id: `retry-${idx}-${Date.now()}`,
          name: rec.name,
          phone: phoneNo,
          countryCode,
        };
      });

      // Update current history status to prepare for background retry
      currentRun.status = 'in_progress';
      // Reset only failed count to preserve previous success states if desired, but
      // cleaner is to subtract the failures we are retrying from failedCount
      currentRun.failedCount = currentRun.failedCount - failedRecipients.length;
      await saveHistory(currentRun);

      // Fire and forget retry worker with original channel & templates saved in currentRun info
      runBroadcastBackground(
        currentRun.id, 
        contactsToRetry, 
        currentRun.gateway, 
        currentRun.message,
        currentRun.channel || 'sms',
        currentRun.templateId || ''
      );

      res.json({
        success: true,
        message: `Retry started in background for ${contactsToRetry.length} failing contacts.`,
        historyId: currentRun.id,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Helper to convert IST Scheduled string "YYYY-MM-DD HH:mm" to exact system UTC Date ---
  function parseISTToDate(istString: string): Date {
    const normalized = istString.replace('T', ' ');
    const [datePart, timePart] = normalized.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // IST is UTC+5:30. Subtract 5h 30m offset to yield matching UTC Date object
    const targetUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offsetMs = (5 * 60 + 30) * 60 * 1000; // 5.5 hours in ms
    return new Date(targetUTC - offsetMs);
  }

  // --- Schedules Endpoints ---
  app.get('/api/schedules', async (req, res) => {
    try {
      res.json(await getSchedules());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/schedules', async (req, res) => {
    try {
      const { groupId, customContacts, gateway, message, channel, templateId, twilioWhatsAppFrom, authkeyWhatsAppSender, scheduleTimeIST } = req.body;

      if (!scheduleTimeIST) {
        return res.status(400).json({ error: 'Schedule time is required' });
      }

      if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message content cannot be empty' });
      }

      let targetGroupName = 'Ad-hoc Group';
      let count = 0;

      if (groupId && groupId !== 'adhoc') {
        const groups = await getGroups();
        const foundGroup = groups.find(g => g.id === groupId);
        if (!foundGroup) {
          return res.status(404).json({ error: 'Select contact group not found' });
        }
        targetGroupName = foundGroup.name;
        count = foundGroup.contacts ? foundGroup.contacts.length : 0;
      } else if (customContacts && Array.isArray(customContacts)) {
        count = customContacts.length;
      }

      const scheduleId = 'sched-' + Math.random().toString(36).substring(2, 9);
      const newSchedule: ScheduledBroadcast = {
        id: scheduleId,
        groupId,
        groupName: `${targetGroupName} (${count} contacts)`,
        customContacts,
        gateway,
        channel: channel || 'sms',
        templateId,
        message,
        scheduleTimeIST,
        twilioWhatsAppFrom,
        authkeyWhatsAppSender,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await saveSchedule(newSchedule);
      res.status(202).json({
        success: true,
        message: 'Campaign scheduled successfully.',
        schedule: newSchedule
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteSchedule(id);
      if (deleted) {
        res.json({ success: true, message: 'Scheduled campaign cancelled successfully.' });
      } else {
        res.status(404).json({ error: 'Scheduled campaign not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Background loop checking for pending scheduler elements (every 10 seconds)
  setInterval(async () => {
    try {
      const schedules = await getSchedules();
      const pendingSchedules = schedules.filter(s => s.status === 'pending');
      if (pendingSchedules.length === 0) return;

      const now = new Date();

      for (const sched of pendingSchedules) {
        const targetDate = parseISTToDate(sched.scheduleTimeIST);
        if (now >= targetDate) {
          sched.status = 'executed';
          await saveSchedule(sched);

          console.log(`[SCHEDULER ENGINE] Executing automated scheduled campaign ${sched.id} for group ${sched.groupName}`);

          let contactsList: Contact[] = [];
          if (sched.groupId && sched.groupId !== 'adhoc') {
            const groups = await getGroups();
            const foundGroup = groups.find(g => g.id === sched.groupId);
            if (foundGroup) {
              contactsList = foundGroup.contacts || [];
            }
          } else if (sched.customContacts) {
            contactsList = sched.customContacts;
          }

          if (contactsList.length === 0) {
            console.log(`[SCHEDULER ENGINE] Aborted schedule ${sched.id} - contact group was empty.`);
            sched.status = 'failed';
            await saveSchedule(sched);
            continue;
          }

          // Create broadcast history entry
          const historyId = 'blast-sched-' + Math.random().toString(36).substring(2, 9);
          const newHistoryItem: BroadcastHistory = {
            id: historyId,
            timestamp: new Date().toISOString(),
            gateway: sched.gateway,
            message: sched.message,
            groupName: sched.groupName + ' (Scheduled)',
            totalContacts: contactsList.length,
            successCount: 0,
            failedCount: 0,
            recipients: [],
            status: 'in_progress',
            channel: sched.channel,
            templateId: sched.templateId || '',
          };

          await saveHistory(newHistoryItem);

          runBroadcastBackground(
            historyId,
            contactsList,
            sched.gateway,
            sched.message,
            sched.channel,
            sched.templateId || '',
            sched.twilioWhatsAppFrom || process.env.TWILIO_WHATSAPP_FROM_NUMBER || '',
            sched.authkeyWhatsAppSender || process.env.AUTHKEY_WHATSAPP_SENDER_ID || ''
          );
        }
      }
    } catch (e) {
      console.error('[SCHEDULER CRITICAL ERROR] Failed running schedule checks:', e);
    }
  }, 10000);

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
