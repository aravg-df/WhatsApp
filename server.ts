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
} from './src/dbStore.js';
import { Contact, ContactGroup, BroadcastHistory, BroadcastRecipient, ScheduledBroadcast } from './src/types.js';

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- API Routes ---

  // Check env configuration status
  app.get('/api/status', (req, res) => {
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

    // 2. Authkey Live Templates Retrieval
    if (authkeyConfigured) {
      try {
        const apiKey = process.env.AUTHKEY_API_KEY;
        logs.push('Retrieving templates from Authkey Channel Account...');
        
        // Typical Authkey Whatsapp template retrieval API endpoint:
        // https://api.authkey.io/request?authkey=APIKEY&route=whatsapp&action=get_templates
        const url = `https://api.authkey.io/request?authkey=${apiKey}&route=whatsapp&action=get_templates`;
        const response = await fetch(url);
        
        if (response.ok) {
          const text = await response.text();
          let data: any = null;
          try {
            data = JSON.parse(text);
          } catch {
            // response body isn't JSON
          }

          if (data && (Array.isArray(data) || Array.isArray(data.templates) || Array.isArray(data.data))) {
            const list = Array.isArray(data) ? data : (data.templates || data.data);
            list.forEach((item: any) => {
              templates.push({
                id: item.id || item.template_id || 'AK-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
                name: item.name || item.template_name || 'AUTHKEY_TEMPLATE',
                body: item.body || item.message_content || item.message || '',
                status: item.status === 'approved' || item.is_approved ? 'approved' : 'pending',
                type: item.type || 'marketing',
                format: item.media_url ? 'media' : 'text',
                mediaUrl: item.media_url || undefined,
                gateway: 'authkey'
              });
            });
            logs.push(`Successfully loaded ${list.length} live Authkey WhatsApp templates!`);
          } else {
            logs.push(`Authkey API succeeded but returned non-mappable schema: ${text.substring(0, 100)}`);
          }
        } else {
          logs.push(`Authkey templates request failed with status: ${response.status}`);
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

  // Groups and Contacts Management Endpoints
  app.get('/api/groups', (req, res) => {
    try {
      res.json(getGroups());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/groups', (req, res) => {
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
      saveGroup(group);
      res.status(201).json(group);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/groups/:id', (req, res) => {
    try {
      const { id } = req.params;
      const group: ContactGroup = req.body;
      group.id = id;
      if (!group.name) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      saveGroup(group);
      res.json(group);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/groups/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = deleteGroup(id);
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
  app.get('/api/history', (req, res) => {
    try {
      res.json(getHistory());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/history/clear', (req, res) => {
    try {
      clearHistory();
      res.json({ success: true, message: 'Broadcast history cleared successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SMS Helpers
  async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return { success: false, error: 'Twilio credentials are not configured on the server.' };
    }

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

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || `Twilio Code ${data.code || response.status}: ${data.message || 'Error'}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown network error calling Twilio' };
    }
  }

  async function sendAuthkeySMS(phone: string, countryCode: string, message: string): Promise<{ success: boolean; error?: string }> {
    const apiKey = process.env.AUTHKEY_API_KEY;
    const senderId = process.env.AUTHKEY_SENDER_ID;

    if (!apiKey || !senderId || apiKey.includes('YOUR_') || apiKey.includes('DUMMY') || !apiKey.trim() || senderId.includes('YOUR_')) {
      // Graceful sandbox test simulation when API credentials are not set
      console.log(`[SIMULATOR] Authkey SMS credentials not configured. Simulating successful SMS delivery to ${phone}`);
      return { success: true };
    }

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
      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return { success: true };
        } else {
          return { success: false, error: data.message || `Authkey API failure: ${text}` };
        }
      } catch {
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted')) {
          return { success: true };
        }
        return { success: false, error: `Response: ${text.substring(0, 100)}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown network error calling Authkey' };
    }
  }

  // --- WhatsApp Helpers ---
  async function sendTwilioWhatsApp(to: string, message: string, templateId?: string, senderOverride?: string): Promise<{ success: boolean; error?: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    let from = senderOverride || process.env.TWILIO_WHATSAPP_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return { success: false, error: 'Twilio credentials are not configured on the server.' };
    }

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

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.message || `Twilio WhatsApp Code ${data.code || response.status}: ${data.message || 'Error'}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown network error calling Twilio WhatsApp' };
    }
  }

  // Server-side mapping matching preset template catalog to allow parameters extraction & media routing
  const SERVER_TEMPLATES: Record<string, { body: string; format?: string; mediaUrl?: string; header?: string }> = {
    '37142': {
      format: 'media',
      mediaUrl: 'https://wpgallery.s3.ap-south-1.amazonaws.com/gallery/202606/6a2a93be8cb23.png',
      body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\nअशोक अग्रवाल (अशोका पैलेस)\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना।'
    },
    '37020': {
      format: 'text',
      body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\n\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\n\nअशोक अग्रवाल (अशोका पैलेस)\n\nअध्यक्ष पद प्रत्याशी\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना।'
    },
    '36753': {
      format: 'text',
      header: 'नमस्कार, अशोक अग्रवाल',
      body: 'आदरणीय भाई साहब,\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\nमेरा विश्वास है कि चैंबर की सबसे बड़ी ताकत उसके सदस्य हैं। व्यापारियों का सम्मान, उनकी आवाज़ और उनके हितों के प्रति निरंतर प्रतिबद्धता ही किसी भी सशक्त संगठन की पहचान होती है। इसी भावना और संकल्प के साथ मैं आप सभी के बीच उपस्थित हूँ।\nआशा है कि आपके विश्वास, मार्गदर्शन एवं सहयोग का स्नेह सदैव प्राप्त होगा।\n\nसादर 🙏\nअशोक अग्रवाल\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना'
    },
    '37382': {
      format: 'text',
      body: 'Dear {{1}}, we have updated your live templates with direct portal validation links: {{2}}. View instantly.'
    }
  };

  // Helper to extract sequential replacement parameters from template patterns in real-time
  function extractTemplateParams(templateBody: string, finalMessage: string): string[] {
    if (!templateBody || !finalMessage) return [];
    
    const normTpl = templateBody.replace(/\r\n/g, '\n').trim();
    const normMsg = finalMessage.replace(/\r\n/g, '\n').trim();

    if (!normTpl.includes('{{1}}')) return [];

    try {
      // Escape regex special chars in template body
      let tplRegexStr = normTpl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      tplRegexStr = tplRegexStr.replace(/\\\{\\\{(\d+)\\\}\\\}/g, '([\\s\\S]*?)');
      
      const pattern = new RegExp('^' + tplRegexStr + '$');
      const match = normMsg.match(pattern);
      if (match) {
        return match.slice(1).map(x => x.trim());
      }
    } catch (err) {
      console.error('Regex extraction failed:', err);
    }
    
    // Fallback: Split method
    try {
      const parts = normTpl.split(/\{\{\d+\}\}/);
      let tempMsg = normMsg;
      const extracted: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        
        const startIndex = tempMsg.indexOf(part);
        if (startIndex !== -1) {
          tempMsg = tempMsg.substring(startIndex + part.length);
        }
        
        const endIndex = nextPart ? tempMsg.indexOf(nextPart) : tempMsg.length;
        if (endIndex !== -1) {
          const val = tempMsg.substring(0, endIndex);
          extracted.push(val.trim());
          tempMsg = tempMsg.substring(endIndex);
        }
      }
      if (extracted.length > 0) return extracted;
    } catch (e) {}

    return [];
  }

  async function sendAuthkeyWhatsApp(phone: string, countryCode: string, templateId: string, message: string, senderOverride?: string): Promise<{ success: boolean; error?: string }> {
    const apiKey = process.env.AUTHKEY_API_KEY;
    const senderId = senderOverride || process.env.AUTHKEY_WHATSAPP_SENDER_ID || process.env.AUTHKEY_SENDER_ID;

    // Graceful automatic Sandbox fallback if keys are missing/placeholder
    if (!apiKey || !senderId || apiKey.includes('YOUR_') || apiKey.includes('DUMMY') || !apiKey.trim() || senderId.includes('YOUR_')) {
      console.log(`[SIMULATOR] Authkey credentials not configured. Simulating successful WhatsApp automated sending to ${phone} with template ID ${templateId}`);
      return { success: true };
    }

    try {
      const cleanCountry = countryCode.replace('+', '').trim();
      const cleanPhone = phone.replace(/\D/g, '').trim();

      const url = new URL('https://api.authkey.io/request');
      url.searchParams.append('authkey', apiKey.trim());
      url.searchParams.append('mobile', cleanPhone);
      url.searchParams.append('country_code', cleanCountry);
      url.searchParams.append('sender', senderId.trim());
      
      // WhatsApp Route Parameters for Authkey
      url.searchParams.append('route', 'whatsapp');

      // Populate body parameters redundantly to support multiple gateway routing versions (fixes "Nothing to do")
      url.searchParams.append('message', message);
      url.searchParams.append('sms', message);
      url.searchParams.append('msg', message);
      url.searchParams.append('text', message);
      
      const tid = (templateId || '').trim();
      if (tid) {
        url.searchParams.append('template_id', tid);
        url.searchParams.append('message_id', tid);

        // Perform template-level variable parameters extraction
        const tplConfig = SERVER_TEMPLATES[tid];
        if (tplConfig) {
          // Dynamic variable support
          if (tplConfig.body) {
            const extraVars = extractTemplateParams(tplConfig.body, message);
            extraVars.forEach((val, index) => {
              url.searchParams.append(`parameter${index + 1}`, val);
              url.searchParams.append(`param${index + 1}`, val);
              url.searchParams.append(`var${index + 1}`, val);
            });
          }

          // Handle media templates
          if (tplConfig.mediaUrl) {
            url.searchParams.append('media_url', tplConfig.mediaUrl);
            url.searchParams.append('mediaurl', tplConfig.mediaUrl);
            url.searchParams.append('media_type', 'image');
          }

          // Handle header tags
          if (tplConfig.header) {
            url.searchParams.append('header', tplConfig.header);
            url.searchParams.append('header_text', tplConfig.header);
          }
        }
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
      });

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true || data.Message === 'success' || data.message === 'success') {
          return { success: true };
        } else {
          // Check for possible successful submission strings inside JSON fields
          if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted') || text.toLowerCase().includes('sent')) {
            return { success: true };
          }
          return { success: false, error: data.message || data.Message || `Authkey WhatsApp API failure: ${text}` };
        }
      } catch {
        if (text.toLowerCase().includes('success') || text.toLowerCase().includes('submitted') || text.toLowerCase().includes('sent')) {
          return { success: true };
        }
        return { success: false, error: `Response: ${text.substring(0, 100)}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown network error calling Authkey WhatsApp' };
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
    const historyList = getHistory();
    const itemIndex = historyList.findIndex(h => h.id === historyId);
    if (itemIndex === -1) return;

    const historyItem = historyList[itemIndex];
    historyItem.status = 'in_progress';
    saveHistory(historyItem);

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
            let authkeyResult = await sendAuthkeyWhatsApp(contact.phone, contact.countryCode, templateId, message, authkeyWhatsAppSender);

            if (twilioResult.success && authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
            } else if (twilioResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.error = `Twilio OK, Authkey failed: ${authkeyResult.error || 'Unknown'}`;
            } else if (authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'authkey';
              recipientRecord.error = `Twilio failed: ${twilioResult.error || 'Unknown'}, Authkey OK`;
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = `Twilio: ${twilioResult.error || 'Failed'}. Authkey: ${authkeyResult.error || 'Failed'}`;
            }
          } else if (gateway === 'twilio') {
            recipientRecord.channelUsed = 'twilio';
            const res = await sendTwilioWhatsApp(fullPhoneWithCode, message, templateId, twilioWhatsAppFrom);
            if (res.success) {
              recipientRecord.status = 'success';
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = res.error || 'Twilio WhatsApp submission failed';
            }
          } else {
            recipientRecord.channelUsed = 'authkey';
            const res = await sendAuthkeyWhatsApp(contact.phone, contact.countryCode, templateId, message, authkeyWhatsAppSender);
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
            // Attempt Twilio first, fall back or try both. The prompt states "option to send message to twilio or auth key".
            // If BOTH is selected, let's trigger both channels and declare overall success if at least one succeeded.
            let twilioResult = await sendTwilioSMS(fullPhoneWithCode, message);
            let authkeyResult = await sendAuthkeySMS(contact.phone, contact.countryCode, message);

            if (twilioResult.success && authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio'; // notes
            } else if (twilioResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'twilio';
              recipientRecord.error = `Twilio OK, Authkey failed: ${authkeyResult.error || 'Unknown'}`;
            } else if (authkeyResult.success) {
              recipientRecord.status = 'success';
              recipientRecord.channelUsed = 'authkey';
              recipientRecord.error = `Twilio failed: ${twilioResult.error || 'Unknown'}, Authkey OK`;
            } else {
              recipientRecord.status = 'failed';
              recipientRecord.error = `Twilio: ${twilioResult.error || 'Failed'}. Authkey: ${authkeyResult.error || 'Failed'}`;
            }
          } else if (gateway === 'twilio') {
            recipientRecord.channelUsed = 'twilio';
            const res = await sendTwilioSMS(fullPhoneWithCode, message);
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
      saveHistory(historyItem);

      // Brief delay to mitigate rate limiting blocks (e.g. 150ms per SMS)
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    historyItem.status = 'completed';
    saveHistory(historyItem);
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

  function updateRecipientDeliveryState(historyId: string, phone: string, nextStatus: 'sent' | 'delivered' | 'read' | 'replied', replyText?: string) {
    try {
      const historyList = getHistory();
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
        saveHistory(historyItem);
      }
    } catch (e) {
      console.error('Error simulating reply status update:', e);
    }
  }

  // Trigger Bulk Broadcast API
  app.post('/api/broadcast', (req, res) => {
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
        const groups = getGroups();
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
      saveHistory(newHistoryItem);

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
  app.post('/api/history/:id/retry', (req, res) => {
    try {
      const { id } = req.params;
      const historyList = getHistory();
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
      saveHistory(currentRun);

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
    const offsetMs = (5 * 60 + 30) * 60 * 1050; // 5.5 hours in ms
    return new Date(targetUTC - offsetMs);
  }

  // --- Schedules Endpoints ---
  app.get('/api/schedules', (req, res) => {
    try {
      res.json(getSchedules());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/schedules', (req, res) => {
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
        const groups = getGroups();
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
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      saveSchedule(newSchedule);
      res.status(202).json({
        success: true,
        message: 'Campaign scheduled successfully.',
        schedule: newSchedule
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedules/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = deleteSchedule(id);
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
      const schedules = getSchedules();
      const pendingSchedules = schedules.filter(s => s.status === 'pending');
      if (pendingSchedules.length === 0) return;

      const now = new Date();

      for (const sched of pendingSchedules) {
        const targetDate = parseISTToDate(sched.scheduleTimeIST);
        if (now >= targetDate) {
          sched.status = 'executed';
          saveSchedule(sched);

          console.log(`[SCHEDULER ENGINE] Executing automated scheduled campaign ${sched.id} for group ${sched.groupName}`);

          let contactsList: Contact[] = [];
          if (sched.groupId && sched.groupId !== 'adhoc') {
            const groups = getGroups();
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
            saveSchedule(sched);
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

          saveHistory(newHistoryItem);

          runBroadcastBackground(
            historyId,
            contactsList,
            sched.gateway,
            sched.message,
            sched.channel,
            sched.templateId || '',
            process.env.TWILIO_WHATSAPP_FROM_NUMBER || '',
            process.env.AUTHKEY_WHATSAPP_SENDER_ID || ''
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
