import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Users, Network, AlertTriangle, AlertCircle, 
  CheckCircle2, Play, RefreshCw, Smartphone, Check, HelpCircle,
  Clock, Calendar, Trash2, ShieldCheck, Sparkles, CheckSquare, Info,
  Image, FileText, MousePointer, ExternalLink, Phone
} from 'lucide-react';
import { Contact, ContactGroup, BroadcastHistory, SystemConfigStatus } from '../types.js';

interface BroadcastTabProps {
  groups: ContactGroup[];
  systemStatus: SystemConfigStatus | null;
  onBroadcastTriggered: (historyId: string) => void;
}

export default function BroadcastTab({ groups, systemStatus, onBroadcastTriggered }: BroadcastTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [useAdhoc, setUseAdhoc] = useState(false);
  const [adhocText, setAdhocText] = useState('');
  
  const [gatewaySelected, setGatewaySelected] = useState<'twilio' | 'authkey' | 'both'>('twilio');
  const [messageText, setMessageText] = useState('');

  // WhatsApp states
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [templateId, setTemplateId] = useState('');
  
  // Load WhatsApp customized senders from localStorage or system status
  const [twilioWhatsAppFrom, setTwilioWhatsAppFrom] = useState(() => 
    localStorage.getItem('default_twilio_whatsapp_from') || ''
  );
  const [authkeyWhatsAppSender, setAuthkeyWhatsAppSender] = useState(() => 
    localStorage.getItem('default_authkey_whatsapp_sender') || ''
  );

  // Senders customization disclosure toggle
  const [showCustomSenders, setShowCustomSenders] = useState(false);

  // Scheduling states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  });
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [schedulesList, setSchedulesList] = useState<any[]>([]);

  const [templateListTab, setTemplateListTab] = useState<'authkey' | 'twilio'>('authkey');

  const [templateType, setTemplateType] = useState<string>('marketing');
  
  // Format configurations and verification variables
  const [templateFormat, setTemplateFormat] = useState<'text' | 'media' | 'quick_reply' | 'cta' | 'otp'>('text');
  const [mediaUrl, setMediaUrl] = useState('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80');
  const [buttonText1, setButtonText1] = useState('Confirm / Yes');
  const [buttonText2, setButtonText2] = useState('Decline / No');
  const [ctaText, setCtaText] = useState('Visit Custom Portal');
  const [ctaUrl, setCtaUrl] = useState('https://ai.studio/build');
  const [ctaPhone, setCtaPhone] = useState('+15550199292');

  const [checkStatusActive, setCheckStatusActive] = useState(false);
  const [checkResult, setCheckResult] = useState<'approved' | 'pending' | 'not_found' | null>(null);
  const [checkedTemplateObj, setCheckedTemplateObj] = useState<any | null>(null);

  // Local storage for keeping track of pending WhatsApp approval simulation templates
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('approved_whatsapp_templates');
      if (saved) return JSON.parse(saved);
      
      // Pre-installed sample templates for live simulation testing out of the box!
      return [
        {
          id: '37142',
          name: 'hindi_ashok_palace_2',
          body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\nअशोक अग्रवाल (अशोका पैलेस)\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना।',
          status: 'approved',
          type: 'marketing',
          format: 'media',
          mediaUrl: 'https://wpgallery.s3.ap-south-1.amazonaws.com/gallery/202606/6a2a93be8cb23.png',
          gateway: 'authkey'
        },
        {
          id: '37020',
          name: 'hindi_ashok_palace',
          body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\n\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\n\nअशोक अग्रवाल (अशोका पैलेस)\n\nअध्यक्ष पद प्रत्याशी\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना।',
          status: 'approved',
          type: 'marketing',
          format: 'text',
          gateway: 'authkey'
        },
        {
          id: '36753',
          name: 'ashok_agrawal_utility',
          header: 'नमस्कार, अशोक अग्रवाल',
          body: 'आदरणीय भाई साहब,\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\nमेरा विश्वास है कि चैंबर की सबसे बड़ी ताकत उसके सदस्य हैं। व्यापारियों का सम्मान, उनकी आवाज़ और उनके हितों के प्रति निरंतर प्रतिबद्धता ही किसी भी सशक्त संगठन की पहचान होती है। इसी भावना और संकल्प के साथ मैं आप सभी के बीच उपस्थित हूँ।\nआशा है कि आपके विश्वास, मार्गदर्शन एवं सहयोग का स्नेह सदैव प्राप्त होगा।\n\nसादर 🙏\nअशोक अग्रवाल\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना',
          status: 'approved',
          type: 'utility',
          format: 'text',
          gateway: 'authkey'
        },
        {
          id: '37382',
          name: 'AUTHKEY_PREVIEW_37382',
          body: 'Dear {{1}}, we have updated your live templates with direct portal validation links: {{2}}. View instantly.',
          status: 'approved',
          type: 'utility',
          format: 'text',
          gateway: 'authkey'
        },
        {
          id: 'TPL-MKT20',
          name: 'PROMO_DISCOUNT_AUTUMN',
          body: 'Hello {{1}}, we configured a special 20% discount coupon for you! Use coupon code FALL20 during checkout on order {{2}}.',
          status: 'approved',
          type: 'marketing',
          format: 'text'
        },
        {
          id: 'TPL-UTL44',
          name: 'ORDER_STATUS_SHIPMENT',
          body: 'Dear {{1}}, thank you for verifying purchase ID {{2}}. Your shipment is ready and on route through fast express tracking.',
          status: 'approved',
          type: 'utility',
          format: 'media',
          mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
        },
        {
          id: 'TPL-OTP89',
          name: 'OTP_VERIFICATION_PASSCODE',
          body: 'Your safe access verification OTP credentials is code {{1}}. Security verification remains valid for 5 minutes only.',
          status: 'approved',
          type: 'otp',
          format: 'otp'
        },
        {
          id: 'TPL-MED55',
          name: 'MEETING_INTERACTIVE_CONFIRM',
          body: 'Dear {{1}}, you have a pending consultation session tomorrow. Reply with YES to validate or Speak to customer care support.',
          status: 'approved',
          type: 'interactive',
          format: 'quick_reply',
          buttonText1: 'Yes, Confirm',
          buttonText2: 'No, reschedule'
        },
        {
          id: 'TPL-CTA77',
          name: 'VISIT_PLATFORM_CTA',
          body: 'Hello {{1}}! Discover our newly loaded customized listings on our digital build platform.',
          status: 'approved',
          type: 'marketing',
          format: 'cta',
          ctaText: 'Open Build Portal',
          ctaUrl: 'https://ai.studio/build',
          ctaPhone: '+15551239999'
        }
      ];
    } catch {
      return [];
    }
  });
  
  // App-level alerts & loaders
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Live Template Sync from Twilio / Authkey status
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  // Function to sync live templates from both Twilio and Authkey
  const fetchLiveTemplates = async (quiet = true) => {
    if (!quiet) {
      setIsSyncingTemplates(true);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
    try {
      const res = await fetch('/api/whatsapp/templates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.templates && data.templates.length > 0) {
          // Merge live templates with local sample templates to avoid duplicates
          setApprovedTemplates(prev => {
            const merged = [...prev];
            data.templates.forEach((liveTpl: any) => {
              const matchIdx = merged.findIndex(t => t.id === liveTpl.id || (t.name && liveTpl.name && t.name.toLowerCase().trim() === liveTpl.name.toLowerCase().trim()));
              if (matchIdx !== -1) {
                // Merge/update
                merged[matchIdx] = { ...merged[matchIdx], ...liveTpl };
              } else {
                // Insert fresh live template at top
                merged.unshift(liveTpl);
              }
            });
            try {
              localStorage.setItem('approved_whatsapp_templates', JSON.stringify(merged));
            } catch (e) {
              console.error(e);
            }
            return merged;
          });
          if (!quiet) {
            setSuccessMessage(`Direct Sync Completed! Synced ${data.templates.length} templates from your configured WhatsApp services.`);
          }
        } else {
          if (!quiet) {
            setErrorMessage('No active live templates found. Verify credentials. Handled successfully.');
          }
        }
        if (data.logs) {
          setSyncLogs(data.logs);
        }
      } else {
        if (!quiet) {
          setErrorMessage(`Failed to connect to template api: Status ${res.status}`);
        }
      }
    } catch (e: any) {
      console.error('Error fetching live templates:', e);
      if (!quiet) {
        setErrorMessage(`Error syncing live templates: ${e.message}`);
      }
    } finally {
      if (!quiet) {
        setIsSyncingTemplates(false);
      }
    }
  };

  // Run initial quiet sync on mount
  useEffect(() => {
    // Force injection of campaign and preview templates to guarantee user sees them out-of-the-box
    setApprovedTemplates(prev => {
      const required = [
        {
          id: '37142',
          name: 'hindi_ashok_palace_2',
          body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\nअशोक अग्रवाल (अशोका पैलेस)\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना।',
          status: 'approved',
          type: 'marketing',
          format: 'media',
          mediaUrl: 'https://wpgallery.s3.ap-south-1.amazonaws.com/gallery/202606/6a2a93be8cb23.png',
          gateway: 'authkey'
        },
        {
          id: '37020',
          name: 'hindi_ashok_palace',
          body: 'आदरणीय भाई साहब, नमस्कार।\n\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\n\nवर्षों से आपने सभी को परखा है, अब एक अवसर बदलाव, नई सोच और सक्रिय नेतृत्व को दीजिए।\n\n"परख चुके हैं सबको बार-बार,\n\nअब एक मौका बदलाव को इस बार।"\n\nआपका समर्थन एवं आशीर्वाद अपेक्षित है।\n\nसादर 🙏\n\nअशोक अग्रवाल (अशोका पैलेस)\n\nअध्यक्ष पद प्रत्याशी\n\nविंध्य चैंबर ऑफ कॉमर्स एंड अभिनय, सतना।',
          status: 'approved',
          type: 'marketing',
          format: 'text',
          gateway: 'authkey'
        },
        {
          id: '36753',
          name: 'ashok_agrawal_utility',
          header: 'नमस्कार, अशोक अग्रवाल',
          body: 'आदरणीय भाई साहब,\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज के आगामी चुनाव में अध्यक्ष पद हेतु आपका स्नेह, आशीर्वाद एवं समर्थन चाहता हूँ।\nमेरा विश्वास है कि चैंबर की सबसे बड़ी ताकत उसके सदस्य हैं। व्यापारियों का सम्मान, उनकी आवाज़ और उनके हितों के प्रति निरंतर प्रतिबद्धता ही किसी भी सशक्त संगठन की पहचान होती है। इसी भावना और संकल्प के साथ मैं आप सभी के बीच उपस्थित हूँ।\nआशा है कि आपके विश्वास, मार्गदर्शन एवं सहयोग का स्नेह सदैव प्राप्त होगा।\n\nसादर 🙏\nअशोक अग्रवाल\nअध्यक्ष पद प्रत्याशी\nविंध्य चैंबर ऑफ कॉमर्स एंड इंडस्ट्रीज, सतना',
          status: 'approved',
          type: 'utility',
          format: 'text',
          gateway: 'authkey'
        },
        {
          id: '37382',
          name: 'AUTHKEY_PREVIEW_37382',
          body: 'Dear {{1}}, we have updated your live templates with direct portal validation links: {{2}}. View instantly.',
          status: 'approved',
          type: 'utility',
          format: 'text',
          gateway: 'authkey'
        }
      ];

      let updated = [...prev];
      let changed = false;
      required.forEach(item => {
        const index = updated.findIndex(t => t.id === item.id);
        if (index === -1) {
          updated.unshift(item);
          changed = true;
        } else {
          // Sync newest model changes
          updated[index] = { ...item, ...updated[index], header: item.header, mediaUrl: item.mediaUrl, gateway: item.gateway, body: item.body };
        }
      });

      if (changed || !localStorage.getItem('approved_whatsapp_templates')) {
        try {
          localStorage.setItem('approved_whatsapp_templates', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
    fetchLiveTemplates(true);
  }, []);

  // Live tracking for active broadcast
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [liveBroadcast, setLiveBroadcast] = useState<BroadcastHistory | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fill WhatsApp customized senders from system credentials on load if localStorage is empty
  useEffect(() => {
    if (systemStatus) {
      if (!twilioWhatsAppFrom && systemStatus.twilioWhatsAppFrom) {
        setTwilioWhatsAppFrom(systemStatus.twilioWhatsAppFrom);
      }
      if (!authkeyWhatsAppSender && systemStatus.authkeyWhatsAppSender) {
        setAuthkeyWhatsAppSender(systemStatus.authkeyWhatsAppSender);
      }
    }
  }, [systemStatus]);

  // Auto-fill first group if database loads
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups]);

  // Fetch all pending and executed scheduled alerts
  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedulesList(data);
      }
    } catch (e) {
      console.error('Error fetching scheduled actions:', e);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Cancel Scheduled Blast handler
  const handleCancelSchedule = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled campaign blast?')) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccessMessage('Scheduled broadcast campaign has been successfully cancelled.');
        fetchSchedules();
      } else {
        const d = await res.json();
        setErrorMessage(d.error || 'Failed to cancel schedule.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error occurred while contacting backend scheduler.');
    }
  };

  const handleSelectTemplate = (tpl: any) => {
    setChannel('whatsapp');
    setTemplateId(tpl.id || tpl.name);
    setMessageText(tpl.body);
    if (tpl.type) {
      setTemplateType(tpl.type);
    }
    if (tpl.format) {
      setTemplateFormat(tpl.format);
    } else {
      setTemplateFormat('text');
    }
    setMediaUrl(tpl.mediaUrl || '');
    setButtonText1(tpl.buttonText1 || 'Confirm / Yes');
    setButtonText2(tpl.buttonText2 || 'Decline / No');
    setCtaText(tpl.ctaText || 'Visit Custom Portal');
    setCtaUrl(tpl.ctaUrl || 'https://ai.studio/build');
    setCtaPhone(tpl.ctaPhone || '+15550199292');

    // Auto-set positive checked status!
    setCheckResult('approved');
    setCheckedTemplateObj(tpl);

    setSuccessMessage(`Selected approved template '${tpl.name}'! Pre-filled dynamic fields and locked editing canvas.`);
  };

  // Check template ID status action
  const handleCheckTemplateApproval = (overrideId?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const targetId = (typeof overrideId === 'string' ? overrideId : templateId).trim();
    if (!targetId) {
      setErrorMessage('Please provide a WhatsApp Template ID / Content ID first to run a status verification.');
      setCheckResult(null);
      setCheckedTemplateObj(null);
      return;
    }

    setCheckStatusActive(true);
    setTimeout(() => {
      const match = approvedTemplates.find(t => 
        t.name.toLowerCase().trim() === targetId.toLowerCase().trim() || 
        t.id.toLowerCase().trim() === targetId.toLowerCase().trim()
      );
      if (match) {
        setCheckResult(match.status === 'approved' ? 'approved' : 'pending');
        setCheckedTemplateObj(match);
        if (match.status === 'approved') {
          // Auto fill form variables
          setTemplateId(match.id);
          setMessageText(match.body);
          if (match.type) setTemplateType(match.type);
          if (match.format) setTemplateFormat(match.format);
          setMediaUrl(match.mediaUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80');
          setButtonText1(match.buttonText1 || 'Confirm / Yes');
          setButtonText2(match.buttonText2 || 'Decline / No');
          setCtaText(match.ctaText || 'Visit Custom Portal');
          setCtaUrl(match.ctaUrl || 'https://ai.studio/build');
          setCtaPhone(match.ctaPhone || '+15550199292');
          
          setSuccessMessage(`Registry status check: Template ID '${match.name}' is APPROVED. Pre-filled content and locked inputs successfully!`);
        } else {
          setErrorMessage(`Registry check: Template ID '${match.name}' has been found but is currently PENDING review by Meta.`);
        }
      } else {
        setCheckResult('not_found');
        setCheckedTemplateObj(null);
        setErrorMessage(`Registry check: Template ID '${targetId}' is UNREGISTERED. Please write its body text below and submit to Meta first.`);
      }
      setCheckStatusActive(false);
    }, 700);
  };

  // Register Meta WhatsApp Template Submission Simulation
  const handleRegisterWhatsAppTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetId = templateId.trim();
    if (!targetId) {
      setErrorMessage('WhatsApp Content ID / Template SID is required.');
      return;
    }
    if (!messageText.trim()) {
      setErrorMessage('Please type template draft body details for Meta review verification.');
      return;
    }

    // Save mock submitted template draft in localStorage
    const newTemplate = {
      id: 'tpl-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      name: targetId,
      body: messageText.trim(),
      status: 'pending_meta_approval',
      type: templateType,
      format: templateFormat,
      mediaUrl: templateFormat === 'media' ? mediaUrl.trim() : undefined,
      buttonText1: templateFormat === 'quick_reply' ? buttonText1.trim() : undefined,
      buttonText2: templateFormat === 'quick_reply' ? buttonText2.trim() : undefined,
      ctaText: templateFormat === 'cta' ? ctaText.trim() : undefined,
      ctaUrl: templateFormat === 'cta' ? ctaUrl.trim() : undefined,
      ctaPhone: templateFormat === 'cta' ? ctaPhone.trim() : undefined,
    };

    const nextTemplates = [newTemplate, ...approvedTemplates];
    setApprovedTemplates(nextTemplates);
    localStorage.setItem('approved_whatsapp_templates', JSON.stringify(nextTemplates));

    setSuccessMessage(`WhatsApp Template '${targetId}' submitted for approval to Meta! A simulation auto-approval will complete in 1.5 seconds.`);
    
    // Auto-approve after 1.5 seconds to show simulation in real-time
    setTimeout(() => {
      setApprovedTemplates(prev => {
        const next = prev.map(t => t.name.toLowerCase().trim() === targetId.toLowerCase().trim() ? { ...t, status: 'approved' } : t);
        localStorage.setItem('approved_whatsapp_templates', JSON.stringify(next));
        return next;
      });
      setCheckResult('approved');
      setCheckedTemplateObj(newTemplate);
    }, 1500);
  };

  // Clean custom phone entries
  const parseAdhocContacts = (text: string): Contact[] => {
    const list: Contact[] = [];
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const cells = trimmed.split(/,|\t/);
      if (cells.length >= 2) {
        const phone = cells[1].trim().replace(/\D/g, '');
        if (phone) {
          list.push({
            id: `adhoc-${idx}-${Date.now()}`,
            name: cells[0].trim() || 'Custom Cust',
            phone,
            countryCode: cells[2] ? cells[2].trim().replace(/\D/g, '') : '91'
          });
        }
      } else {
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length >= 7) {
          let code = '91';
          let phone = digits;
          if (trimmed.startsWith('+')) {
            if (digits.startsWith('91') && digits.length > 10) {
              code = '91';
              phone = digits.substring(2);
            } else if (digits.startsWith('1') && digits.length > 10) {
              code = '1';
              phone = digits.substring(1);
            }
          }
          list.push({
            id: `adhoc-${idx}-${Date.now()}`,
            name: `Contact ...${phone.substring(phone.length - 4)}`,
            phone,
            countryCode: code
          });
        }
      }
    });
    return list;
  };

  // Poll active broadcast status
  const startStatusPolling = (historyId: string) => {
    setActiveHistoryId(historyId);
    setIsSending(true);

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/history');
        if (!res.ok) return;
        const history: BroadcastHistory[] = await res.json();
        const activeItem = history.find(h => h.id === historyId);
        
        if (activeItem) {
          setLiveBroadcast(activeItem);
          if (activeItem.status === 'completed' || activeItem.status === 'failed') {
            stopStatusPolling();
            setSuccessMessage(`Automated SMS broadcast finished! Sent ${activeItem.successCount} of ${activeItem.totalContacts} recipients.`);
            onBroadcastTriggered(historyId); // refresh sibling tables
          }
        }
      } catch (e) {
        console.error('Error fetching polling status:', e);
      }
    }, 1000);
  };

  const stopStatusPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsSending(false);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Form Submit handler - post payload to trigger broadcast queue
  const handleLaunchBlast = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate gateway config
    if (gatewaySelected === 'twilio' && systemStatus && !systemStatus.twilioConfigured) {
      setErrorMessage('Cannot broadcast. Twilio settings are missing in the .env configuration.');
      return;
    }
    if (gatewaySelected === 'authkey' && systemStatus && !systemStatus.authkeyConfigured) {
      setErrorMessage('Cannot broadcast. Authkey settings are missing in the .env configuration.');
      return;
    }
    if (gatewaySelected === 'both' && systemStatus) {
      if (!systemStatus.twilioConfigured && !systemStatus.authkeyConfigured) {
        setErrorMessage('Both Twilio and Authkey gateways are not configured. Provide at least one set of keys.');
        return;
      }
    }

    let payload: any = {
      gateway: gatewaySelected,
      message: messageText.trim(),
      channel,
      templateId: channel === 'whatsapp' ? templateId.trim() : undefined,
      twilioWhatsAppFrom: channel === 'whatsapp' ? twilioWhatsAppFrom.trim() : undefined,
      authkeyWhatsAppSender: channel === 'whatsapp' ? authkeyWhatsAppSender.trim() : undefined
    };

    if (useAdhoc) {
      const contacts = parseAdhocContacts(adhocText);
      if (contacts.length === 0) {
        setErrorMessage('Please paste at least one valid recipient phone number.');
        return;
      }
      payload.groupId = 'adhoc';
      payload.customContacts = contacts;
    } else {
      if (!selectedGroupId) {
        setErrorMessage('Please create a contact group first or choose the ad-hoc numbers option.');
        return;
      }
      payload.groupId = selectedGroupId;
    }

    if (isScheduled) {
      payload.scheduleTimeIST = `${scheduleDate} ${scheduleTime}`;
    }

    try {
      const endpoint = isScheduled ? '/api/schedules' : '/api/broadcast';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected request');
      }

      if (isScheduled) {
        setSuccessMessage(`Success! Campaign blast scheduled for group at ${scheduleDate} ${scheduleTime} IST.`);
        setMessageText('');
        setTemplateId('');
        setIsScheduled(false);
        fetchSchedules(); // sync pending schedules view
      } else {
        // Launch status tracking layout
        startStatusPolling(data.historyId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred triggering the blast');
    }
  };

  const currentSegment = groups.find(g => g.id === selectedGroupId);
  const recipientCount = useAdhoc 
    ? parseAdhocContacts(adhocText).length 
    : (currentSegment ? currentSegment.contacts.length : 0);

  // Length calculation (1 SMS segment is standard 160 characters)
  const charLength = messageText.length;
  const smsSegmentsCount = Math.ceil(charLength / 160) || 0;

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs px-4 py-3 rounded-lg font-medium flex items-center gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-450" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs px-4 py-3 rounded-lg font-medium flex items-center gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Broadcast Live Status Panel */}
      {isSending && liveBroadcast && (
        <div className="bg-[#0b0b0b] text-neutral-200 rounded-xl shadow-xl p-6 space-y-4 border border-neutral-900">
          <div className="flex justify-between items-center pb-3 border-b border-neutral-900">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
              <div>
                <h4 className="font-serif font-medium text-sm text-white">Campaign Broadcast Active</h4>
                <p className="text-[10px] text-neutral-500 font-mono">Blasting automated message sequence now</p>
              </div>
            </div>
            <span className="text-[10px] bg-neutral-900 text-amber-400 border border-neutral-800 px-3 py-1 rounded-full font-mono uppercase tracking-wider font-semibold">
              {liveBroadcast.status.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-mono text-neutral-400">
              <span>Overall Progress ({liveBroadcast.successCount + liveBroadcast.failedCount} / {liveBroadcast.totalContacts} Contacts)</span>
              <span className="text-amber-500 font-bold">{Math.round(((liveBroadcast.successCount + liveBroadcast.failedCount) / liveBroadcast.totalContacts) * 100)}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${((liveBroadcast.successCount + liveBroadcast.failedCount) / liveBroadcast.totalContacts) * 100}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-center border-t border-neutral-900 pt-3 mt-1.5">
              <div className="bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900">
                <span className="text-[10px] text-neutral-500 block uppercase font-mono">Delivered OK</span>
                <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">{liveBroadcast.successCount}</span>
              </div>
              <div className="bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900">
                <span className="text-[10px] text-neutral-500 block uppercase font-mono">Failed Drops</span>
                <span className="text-sm font-semibold text-rose-400 mt-0.5 block">{liveBroadcast.failedCount}</span>
              </div>
            </div>
          </div>

          {/* Current sending items view */}
          {liveBroadcast.recipients.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-3 max-h-36 overflow-y-auto text-[11px] font-mono space-y-1 divide-y divide-neutral-900/50">
              <h5 className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wide mb-1 pb-1">Activity Log</h5>
              {liveBroadcast.recipients.slice().reverse().map((rec, i) => (
                <div key={i} className="flex justify-between py-1.5 items-center">
                  <span className="text-neutral-300">{rec.name} ({rec.phone})</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-neutral-905 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-800 font-bold uppercase">{rec.channelUsed}</span>
                    <span className={rec.status === 'success' ? 'text-emerald-400 font-medium' : 'text-rose-450 font-medium'}>
                      {rec.status === 'success' ? '✔ Sent' : `❌ ${rec.error || 'Failed'}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Drafting Form */}
      <form onSubmit={handleLaunchBlast} className="bg-[#0c0c0c] border border-neutral-900 rounded-xl shadow-xl p-6.5 space-y-6">
        <div>
          <h3 className="font-serif text-lg font-medium text-white">Initialize Message Blast</h3>
          <p className="text-xs text-neutral-400 mt-1">Draft a notification template, select an API gateway, and automate the bulk dispatching.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Side A: Target Configuration */}
          <div className="md:col-span-1 space-y-5">
            <h4 className="font-medium text-xs text-neutral-500 uppercase tracking-wider block">Recipient Source</h4>

            {/* Selector Option Toggles */}
            <div className="flex border border-neutral-850 rounded-lg p-0.5 bg-neutral-950">
              <button
                type="button"
                onClick={() => setUseAdhoc(false)}
                className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                  !useAdhoc ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Saved Group
              </button>
              <button
                type="button"
                onClick={() => setUseAdhoc(true)}
                className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                  useAdhoc ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Ad-hoc Numbers
              </button>
            </div>

            {!useAdhoc ? (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neutral-450">Select Contact Group</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="w-full text-sm border border-neutral-850 rounded-lg pl-9.5 pr-3 py-2.5 outline-none focus:ring-1 focus:ring-amber-500/50 bg-neutral-950 text-neutral-200 cursor-pointer hover:border-neutral-800 transition"
                  >
                    {groups.length === 0 ? (
                      <option value="" className="bg-[#050505] text-neutral-400">-- No Groups Created --</option>
                    ) : (
                      groups.map(g => (
                        <option key={g.id} value={g.id} className="bg-[#050505] text-neutral-200">
                          {g.name} ({g.contacts.length} numbers)
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neutral-450">Paste Raw Numbers List</label>
                <textarea
                  rows={5}
                  value={adhocText}
                  onChange={e => setAdhocText(e.target.value)}
                  placeholder="Paste manual list of numbers...
e.g.,
+919876543210
+15551234567"
                  className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-300 rounded-lg p-3 outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-neutral-600"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">One entry per row. Accepts standard formatting.</span>
              </div>
            )}

            {/* Delivery Channel selection */}
            <div className="space-y-3 pt-2">
              <h4 className="font-medium text-xs text-neutral-500 uppercase tracking-wider block">Delivery Channel</h4>
              <div className="flex border border-neutral-855 rounded-lg p-0.5 bg-neutral-950">
                <button
                  type="button"
                  onClick={() => setChannel('sms')}
                  className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                    channel === 'sms' ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                    channel === 'whatsapp' ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  WhatsApp
                </button>
              </div>
            </div>

            {channel === 'whatsapp' && (
              <div className="space-y-4 pt-4 border-t border-neutral-900/60 transition-all">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-amber-500">WhatsApp Template ID / Content ID</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={templateId}
                      onChange={e => {
                        setTemplateId(e.target.value);
                        setCheckResult(null);
                        setCheckedTemplateObj(null);
                      }}
                      placeholder="e.g. content template SID or name"
                      className="flex-1 text-xs font-mono border border-neutral-850 bg-[#070707] text-neutral-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleCheckTemplateApproval}
                      disabled={checkStatusActive}
                      className="bg-amber-550 hover:bg-amber-400 disabled:bg-neutral-900 border border-amber-600/25 disabled:border-neutral-850 text-neutral-950 disabled:text-neutral-500 font-bold px-3 py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
                    >
                      {checkStatusActive ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-600" /> : '🔍 Check Approval'}
                    </button>
                  </div>
                  <span className="text-[10px] text-[#8e8e8e] block">Registered WhatsApp template message ID standard. Click Check to verify status with Meta.</span>

                  {/* Realtime verification banners! */}
                  {checkResult === 'approved' && checkedTemplateObj && (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg space-y-1.5 mt-1.5 animate-fadeIn">
                      <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between gap-1 uppercase flex-wrap">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 
                          <span>APPROVED BY META</span>
                        </div>
                        {(checkedTemplateObj.gateway === 'authkey' || templateId.trim() === '37382') && (
                          <a 
                            href={`https://console.authkey.io/dashboard/preview-whatsapp-template/${/^\d+$/.test(templateId.trim()) ? templateId.trim() : '37382'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[9px] font-bold py-0.5 px-2 rounded border border-amber-500/25 flex items-center gap-1 transition cursor-pointer normal-case"
                            title="Open layout in external Authkey Console previewer"
                          >
                            <ExternalLink className="h-3 w-3 text-amber-400" /> View Authkey Console Link
                          </a>
                        )}
                      </div>
                      <p className="text-[9.5px] text-neutral-300 leading-normal">
                        Ready to trigger. Standard Twilio Content SID / Authkey template is fully active. Template content has been locked for this broadcast.
                      </p>
                    </div>
                  )}

                  {checkResult === 'pending' && (
                    <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg space-y-1.5 mt-1.5 animate-fadeIn">
                      <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1 uppercase">
                        <Clock className="h-4 w-4 text-amber-400 animate-pulse" /> 
                        <span>PENDING META REVIEW</span>
                      </div>
                      <p className="text-[9.5px] text-neutral-300 leading-normal">
                        This template is currently awaiting validation review. You can simulate immediate review approval by checking lists on the side panels.
                      </p>
                    </div>
                  )}

                  {checkResult === 'not_found' && (
                    <div className="bg-neutral-900/40 border border-neutral-800 p-3 rounded-lg space-y-1.5 mt-1.5 animate-fadeIn">
                      <div className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 uppercase">
                        <AlertCircle className="h-4 w-4 text-amber-550" /> 
                        <span>UNREGISTERED SID / DRAFT MODE</span>
                      </div>
                      <p className="text-[9.5px] text-neutral-450 leading-normal">
                        This ID is not found in the approved ledger. Select template layout format below and submit to Meta to get approved status!
                      </p>
                    </div>
                  )}
                </div>

                {/* Collapsible Disclosure Button to Configure Senders Override */}
                <div className="pt-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setShowCustomSenders(prev => !prev)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-500/90 hover:text-amber-400 transition cursor-pointer"
                  >
                    <span>{showCustomSenders ? '▼ Hide Customized Senders' : '▶ Customize WhatsApp Senders (Advanced overrides)'}</span>
                  </button>
                </div>

                {showCustomSenders && (
                  <div className="space-y-3.5 p-3.5 bg-neutral-950 border border-neutral-850 rounded-lg transition-all animate-fadeIn">
                    <p className="text-[10px] text-neutral-450 leading-relaxed">
                      Override standard system numbers for these campaign messages. Click the persistent button below to set them as defaults for future browser blasts.
                    </p>

                    {gatewaySelected !== 'authkey' && (
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-neutral-400">Twilio WhatsApp From Profile</label>
                        <input
                          type="text"
                          value={twilioWhatsAppFrom}
                          onChange={e => setTwilioWhatsAppFrom(e.target.value)}
                          placeholder="e.g. whatsapp:+14155250000"
                          className="w-full text-xs font-mono border border-neutral-850 bg-[#070707] text-neutral-200 rounded-lg p-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                    )}

                    {gatewaySelected !== 'twilio' && (
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-neutral-400">Authkey WhatsApp Sender Partner ID</label>
                        <input
                          type="text"
                          value={authkeyWhatsAppSender}
                          onChange={e => setAuthkeyWhatsAppSender(e.target.value)}
                          placeholder="e.g. 919876543210 (or registered sender)"
                          className="w-full text-xs font-mono border border-neutral-850 bg-[#070707] text-neutral-200 rounded-lg p-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('default_twilio_whatsapp_from', twilioWhatsAppFrom);
                        localStorage.setItem('default_authkey_whatsapp_sender', authkeyWhatsAppSender);
                        alert('Customized sender configuration successfully saved as Default for all future blasts!');
                      }}
                      className="w-full mt-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 font-mono text-[9px] uppercase tracking-wider py-1.5 rounded transition cursor-pointer"
                    >
                      Save Configurations as Defaults to Browser
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Gateway Selection */}
            <div className="space-y-3">
              <h4 className="font-medium text-xs text-neutral-500 uppercase tracking-wider block pt-2">API Carrier Service</h4>
              <div className="space-y-2.5">
                <label className={`flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition ${
                  gatewaySelected === 'twilio' ? 'border-amber-500/50 bg-amber-500/[0.03]' : 'border-neutral-855 bg-neutral-950 hover:bg-neutral-900/40'
                }`}>
                  <input
                    type="radio"
                    name="gateway"
                    value="twilio"
                    checked={gatewaySelected === 'twilio'}
                    onChange={() => setGatewaySelected('twilio')}
                    className="accent-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-neutral-100">Twilio Network</span>
                    <span className="block text-[10px] text-neutral-400 mt-0.5">Dispatch messages via Twilio standard routes</span>
                  </div>
                </label>

                <label className={`flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition ${
                  gatewaySelected === 'authkey' ? 'border-amber-500/50 bg-amber-500/[0.03]' : 'border-neutral-855 bg-neutral-950 hover:bg-neutral-900/40'
                }`}>
                  <input
                    type="radio"
                    name="gateway"
                    value="authkey"
                    checked={gatewaySelected === 'authkey'}
                    onChange={() => setGatewaySelected('authkey')}
                    className="accent-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-neutral-100">Authkey SMS Service</span>
                    <span className="block text-[10px] text-neutral-400 mt-0.5">High velocity regional transactional SMS API Gateway</span>
                  </div>
                </label>

                <label className={`flex items-center gap-3.5 p-3.5 rounded-lg border cursor-pointer transition ${
                  gatewaySelected === 'both' ? 'border-amber-500/50 bg-amber-500/[0.03]' : 'border-neutral-855 bg-neutral-950 hover:bg-neutral-900/40'
                }`}>
                  <input
                    type="radio"
                    name="gateway"
                    value="both"
                    checked={gatewaySelected === 'both'}
                    onChange={() => setGatewaySelected('both')}
                    className="accent-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-neutral-100">Blast Double (Both Services)</span>
                    <span className="block text-[10px] text-neutral-400 mt-0.5">Simultaneously push delivery on both systems</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
                 {/* Side B: Message Drafting and Dispatching */}
          <div className="md:col-span-2 flex flex-col justify-between space-y-4">
            {channel === 'whatsapp' && templateId.trim() !== '' ? (
              /* Portal layout for WhatsApp template configuration and dispatching */
              <div className="space-y-4">
                {checkResult === 'approved' && checkedTemplateObj ? (
                  /* GORGEOUS APPROVED MODE PREVIEW (No manual typing needed!) */
                  <div className="space-y-4 animate-fadeIn">
                    {/* Header Banner */}
                    <div className="bg-emerald-950/20 border border-emerald-500/35 p-4 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Locked & Ready to Broadcast</span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-normal">
                        WhatsApp template ID <span className="text-emerald-400 font-mono font-bold font-semibold">{templateId}</span> is APPROVED by Meta. Sending is fully automated from the template itself—no manual writing required.
                      </p>
                    </div>

                    {/* WhatsApp Bubble Preview Simulator */}
                    <div className="bg-[#0b141a] rounded-xl border border-neutral-900 p-4 shadow-inner">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-2.5 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>📱 Live WhatsApp Device Preview Mock</span>
                      </div>

                      <div className="max-w-[90%] sm:max-w-[75%] bg-[#202c33] text-neutral-100 rounded-lg rounded-tl-none p-3 shadow-md space-y-2 text-xs relative border border-neutral-800">
                        {/* Media Header Visual */}
                        {checkedTemplateObj.format === 'media' && (
                          <div className="rounded overflow-hidden border border-neutral-700 bg-neutral-900 mb-2 relative max-h-[140px] flex items-center justify-center">
                            {checkedTemplateObj.mediaUrl ? (
                              <img src={checkedTemplateObj.mediaUrl} alt="Attached Media" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="p-4 text-center text-neutral-500 space-y-1 py-6 w-full">
                                <Image className="h-6 w-6 mx-auto text-neutral-600" />
                                <span className="block text-[10px]">Document or Media attachment payload</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Header parameter preview */}
                        {checkedTemplateObj.header && (
                          <div className="font-bold text-xs text-neutral-200 border-b border-neutral-700/50 pb-1.5 mb-1.5 leading-snug">
                            {checkedTemplateObj.header}
                          </div>
                        )}

                        {/* Text Block content */}
                        <div className="whitespace-pre-wrap leading-relaxed font-mono text-[11px] text-neutral-100">
                          {checkedTemplateObj.body}
                        </div>

                        {/* OTP passcode preview */}
                        {checkedTemplateObj.format === 'otp' && (
                          <div className="bg-[#111b21] border border-neutral-805 p-2 rounded text-center my-1.5 space-y-1">
                            <span className="text-[9px] text-[#8696a0] block uppercase font-mono tracking-wider font-bold">Copy Passcode Code Link</span>
                            <span className="text-sm font-semibold tracking-widest text-[#25d366] font-mono">1 2 8 9 9 1</span>
                          </div>
                        )}

                        {/* Quick reply buttons mock */}
                        {checkedTemplateObj.format === 'quick_reply' && (
                          <div className="space-y-1.5 pt-1.5 border-t border-neutral-800 mt-2">
                            {checkedTemplateObj.buttonText1 && (
                              <div className="w-full bg-[#111b21] hover:bg-[#182229] border border-neutral-800 py-1.5 rounded-md text-center text-[#53bdeb] font-medium text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1">
                                <MousePointer className="h-3 w-3" /> {checkedTemplateObj.buttonText1}
                              </div>
                            )}
                            {checkedTemplateObj.buttonText2 && (
                              <div className="w-full bg-[#111b21] hover:bg-[#182229] border border-neutral-800 py-1.5 rounded-md text-center text-[#53bdeb] font-medium text-[10.5px] transition cursor-pointer flex items-center justify-center gap-1">
                                <MousePointer className="h-3 w-3" /> {checkedTemplateObj.buttonText2}
                              </div>
                            )}
                          </div>
                        )}

                        {/* CTA buttons mock */}
                        {checkedTemplateObj.format === 'cta' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-neutral-800 mt-2">
                            {checkedTemplateObj.ctaText && (
                              <a href={checkedTemplateObj.ctaUrl} target="_blank" rel="noopener noreferrer" className="bg-[#111b21] hover:bg-[#182229] border border-neutral-800 py-1.5 rounded-md text-center text-[#53bdeb] font-medium text-[10.5px] transition flex items-center justify-center gap-1">
                                <ExternalLink className="h-3 w-3 text-sky-400" /> {checkedTemplateObj.ctaText}
                              </a>
                            )}
                            {checkedTemplateObj.ctaPhone && (
                              <a href={`tel:${checkedTemplateObj.ctaPhone}`} className="bg-[#111b21] hover:bg-[#182229] border border-neutral-800 py-1.5 rounded-md text-center text-[#53bdeb] font-medium text-[10.5px] transition flex items-center justify-center gap-1">
                                <Phone className="h-3 w-3 text-sky-400" /> Call Support
                              </a>
                            )}
                          </div>
                        )}

                        <div className="text-[9px] text-[#8696a0] flex justify-end items-center gap-1 mt-1 select-none">
                          <span>10:24 AM</span>
                          <span className="text-[#53bdeb]">✓✓</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-900 p-3 rounded-lg text-[10.5px] text-neutral-400 flex items-start gap-2">
                      <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        Personal parameters (e.g. name placeholder {"{{1}}"}) will be dynamically mapped to matching recipient parameters during dispatching automatically.
                      </div>
                    </div>

                    <div className="border-t border-neutral-900 pt-3 flex items-center justify-between">
                      <button
                        type="submit"
                        disabled={isSending || recipientCount === 0}
                        className="flex-1 bg-amber-550 hover:bg-amber-400 disabled:bg-neutral-900 border border-amber-600/20 disabled:border-neutral-850 text-neutral-950 disabled:text-neutral-600 font-bold rounded-xl px-5 py-3.5 transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/5 active:scale-[0.98]"
                      >
                        {isSending ? 'Transmitting Burst...' : `🚀 Launch Approved Template Blast (${recipientCount} Recip.)`}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DRAFTING / UNAPPROVED TEMPLATE LAYOUT: Typing Meta Setup */
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Submit Layout Draft to Meta for Review</span>
                        </div>
                        <a 
                          href="https://console.authkey.io/dashboard/preview-whatsapp-template/37382"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-[10.5px] font-bold px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                          title="Open template in external Authkey Console panel"
                        >
                          <ExternalLink className="h-3 w-3 text-amber-400" /> View Live Authkey Link
                        </a>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-normal">
                        Type the template text and options below to request a Meta SID. Once approved, you can send it directly. 
                        Interested in live template <span className="font-bold text-amber-400 font-mono">37382</span>? Click <button type="button" onClick={() => handleCheckTemplateApproval('37382')} className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer p-0 ml-1">Verify ID: 37382</button> to pre-fill and lock this view with the live simulator preview.
                      </p>
                    </div>

                    {/* Rich Format Selectors supported by Twilio & Authkey */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-400">Template Format (Twilio / Authkey Standards)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          { id: 'text', label: '🔤 Text' },
                          { id: 'media', label: '🖼️ Media' },
                          { id: 'quick_reply', label: '🔘 Quick Reply' },
                          { id: 'cta', label: '🔗 CTA link' },
                          { id: 'otp', label: '🔑 Auth OTP' }
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setTemplateFormat(f.id as any)}
                            className={`py-2 px-1 text-center rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition ${
                              templateFormat === f.id 
                                ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                                : 'bg-neutral-950 border-neutral-850 text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-neutral-400">Meta Template Category / Type</label>
                        <select
                          value={templateType}
                          onChange={e => setTemplateType(e.target.value)}
                          className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer"
                        >
                          <option value="marketing">MARKETING (Offers, Discounts, Promos)</option>
                          <option value="utility">UTILITY (Order update, Shipment tracking)</option>
                          <option value="otp">AUTHENTICATION / OTP (Passcodes)</option>
                          <option value="interactive">INTERACTIVE (Replies, Media)</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-neutral-400 flex justify-between">
                          <span>Body Placeholders</span>
                          <span className="text-neutral-500">e.g., {"{{1}}"}, {"{{2}}"}</span>
                        </label>
                        <div className="bg-neutral-950 border border-neutral-850 text-neutral-300 font-mono rounded-lg p-2.5 text-xs text-center select-none">
                          {"{{1}}"} = Name | {"{{2}}"} = Custom Variables
                        </div>
                      </div>
                    </div>

                    {/* Conditional Input Fields based on Format chosen */}
                    {templateFormat === 'media' && (
                      <div className="p-3 bg-neutral-955 border border-neutral-850 rounded-lg space-y-2 animate-fadeIn">
                        <label className="block text-xs font-semibold text-neutral-400">Media Header Attachment Link (Optional Image URL)</label>
                        <input
                          type="text"
                          value={mediaUrl}
                          onChange={e => setMediaUrl(e.target.value)}
                          placeholder="e.g. https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d"
                          className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                    )}

                    {templateFormat === 'quick_reply' && (
                      <div className="p-3 bg-neutral-955 border border-neutral-855 rounded-lg gap-2.5 grid grid-cols-2 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-neutral-450">Quick Reply Button 1 Label</label>
                          <input
                            type="text"
                            value={buttonText1}
                            onChange={e => setButtonText1(e.target.value)}
                            className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-neutral-450">Quick Reply Button 2 Label</label>
                          <input
                            type="text"
                            value={buttonText2}
                            onChange={e => setButtonText2(e.target.value)}
                            className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {templateFormat === 'cta' && (
                      <div className="p-3 bg-neutral-955 border border-neutral-855 rounded-lg gap-2 grid grid-cols-3 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-neutral-450">Website Title</label>
                          <input
                            type="text"
                            value={ctaText}
                            onChange={e => setCtaText(e.target.value)}
                            className="w-full text-xs border border-neutral-850 bg-neutral-950 text-neutral-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="block text-[10px] font-semibold text-neutral-450">Link URL Address</label>
                          <input
                            type="text"
                            value={ctaUrl}
                            onChange={e => setCtaUrl(e.target.value)}
                            className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Template Content Body Text */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-neutral-450">Template Content Body Text</label>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          Characters: <span className="font-semibold text-neutral-300">{charLength}</span>
                        </div>
                      </div>
                      <textarea
                        required
                        rows={4}
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        placeholder="E.g. Hello {{1}}, thank you for verifying order details {{2}}."
                        className="w-full text-xs border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-xl p-4 focus:ring-1 focus:ring-amber-500/50 outline-none min-h-[100px] placeholder:text-neutral-600 line-relaxed font-mono"
                      />
                    </div>

                    <div className="bg-neutral-950 border border-neutral-900 p-3 rounded-lg text-[10px] text-[#909090] flex items-start gap-2 leading-relaxed">
                      <HelpCircle className="h-4.5 w-4.5 text-amber-550 shrink-0 mt-0.5" />
                      <div>
                        This body content will be transmitted to Meta for authentication security audit. You can mock approve the ID immediately after submission.
                      </div>
                    </div>

                    <div className="border-t border-neutral-900 pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={handleRegisterWhatsAppTemplate}
                        disabled={!messageText.trim() || !templateId.trim()}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-900 border border-emerald-700/20 disabled:border-neutral-850 text-white disabled:text-neutral-600 font-medium rounded-xl py-3 transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        <CheckSquare className="h-4 w-4 text-emerald-300" />
                        Submit To Meta For Approval
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Standard dynamic campaign message drafting */
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-neutral-400">Draft Message Content</label>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      Characters: <span className="font-semibold text-neutral-300">{charLength}</span> | Parts: <span className="font-semibold text-amber-500">{smsSegmentsCount}</span>
                    </div>
                  </div>
                  <textarea
                    required
                    rows={8}
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    placeholder="Type the campaign message you want to broadcast automatically. Recipient lists receive identical copy instantly."
                    className="w-full text-sm border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-xl p-4 focus:ring-1 focus:ring-amber-500/50 outline-none flex-1 min-h-[170px] placeholder:text-neutral-600 line-relaxed"
                  />
                  <div className="mt-3 bg-neutral-950 border border-neutral-900 p-3.5 rounded-lg text-xs text-neutral-400 flex items-start gap-2.5">
                    <HelpCircle className="h-4.5 w-4.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-amber-500">Broadcasting Automation Tip:</span> Triggering starts an automated sequential worker background blast. No spreadsheets, code, or terminal commands necessary.
                    </div>
                  </div>
                </div>

                {/* IST Calendar & clock scheduler block */}
                <div className="bg-[#070707] border border-neutral-850 rounded-xl p-4 space-y-3.5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={e => setIsScheduled(e.target.checked)}
                      className="rounded border-neutral-800 bg-neutral-900 text-amber-500 focus:ring-0 focus:ring-offset-0 mt-0.5 h-4 w-4"
                    />
                    <div>
                      <span className="block text-xs font-bold text-neutral-250">Schedule Blast for Future Time (IST)</span>
                      <span className="block text-[10px] text-neutral-500 mt-0.5">Automates subsequent sequential triggering relative to Indian Standard Time (IST).</span>
                    </div>
                  </label>

                  {isScheduled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 pt-1.5 animate-fadeIn">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-amber-500" /> Choose Date (IST)
                        </label>
                        <input
                          type="date"
                          required
                          value={scheduleDate}
                          onChange={e => setScheduleDate(e.target.value)}
                          className="w-full text-xs font-mono border border-neutral-800 bg-neutral-900 text-neutral-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> Choose Hour (IST)
                        </label>
                        <input
                          type="time"
                          required
                          value={scheduleTime}
                          onChange={e => setScheduleTime(e.target.value)}
                          className="w-full text-xs font-mono border border-neutral-800 bg-neutral-900 text-neutral-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Trigger Button Row */}
                <div className="border-t border-neutral-900 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-neutral-400 font-mono">
                    Targeting: <span className="font-bold text-amber-500 font-sans">{recipientCount} contacts</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || recipientCount === 0 || !messageText.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-900 border border-amber-600/20 disabled:border-neutral-850 text-neutral-950 disabled:text-neutral-600 font-bold rounded-xl px-8 py-3.5 transition flex items-center justify-center gap-2.5 text-sm disabled:scale-100 active:scale-98 cursor-pointer shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        Dispatching Sequence...
                      </>
                    ) : isScheduled ? (
                      <>
                        <Clock className="h-4.5 w-4.5 text-neutral-950" />
                        Schedule Campaign Blast ({recipientCount} Recip.)
                      </>
                    ) : (
                      <>
                        <Send className="h-4.5 w-4.5" />
                        Automate Campaign Blast ({recipientCount} Recip.)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Schedules & Template Approvals Feed Column Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5 mt-4 border-t border-neutral-900">
        {/* Schedules Feed */}
        <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
            <div className="flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
              <h4 className="font-serif text-sm font-medium text-white">Active Campaigns Scheduler (IST)</h4>
            </div>
            <button
              onClick={fetchSchedules}
              type="button"
              className="p-1 text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition"
            >
              <RefreshCw className="h-3 w-3" /> Reload
            </button>
          </div>

          {schedulesList.length === 0 ? (
            <div className="text-center py-6 text-xs text-neutral-500 font-mono italic">
              No scheduled campaigns configured. Toggle the IST Scheduler above to set a future delivery.
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {schedulesList.map((sched) => (
                <div key={sched.id} className="bg-neutral-950 border border-neutral-850 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[12px] font-semibold text-neutral-200 block">{sched.groupName}</span>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block flex items-center gap-1">
                        <Clock className="h-3 w-3 text-neutral-500 shrink-0" /> Starts: {sched.scheduleTimeIST} IST
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${
                      sched.status === 'pending'
                        ? 'bg-amber-955/20 border-amber-850 text-amber-400 animate-pulse font-bold'
                        : sched.status === 'executed'
                        ? 'bg-emerald-955/20 border-emerald-850 text-emerald-400'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                    }`}>
                      {sched.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 line-clamp-2 italic font-mono bg-neutral-900/40 p-2 rounded border border-neutral-900/50">
                    "{sched.message}"
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-900/60">
                    <span>
                      Gateway: <span className="font-semibold text-neutral-300 uppercase">{sched.gateway}</span> ({sched.channel})
                    </span>
                    {sched.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancelSchedule(sched.id)}
                        className="text-rose-400 hover:text-rose-350 transition flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Cancel Schedule
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Meta templates Feed */}
        <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-900 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
              <h4 className="font-serif text-sm font-medium text-white">Meta WhatsApp Templates</h4>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchLiveTemplates(false)}
                disabled={isSyncingTemplates}
                type="button"
                className="bg-[#1c1917]/80 hover:bg-[#2e2a24] border border-neutral-800 disabled:opacity-50 text-[10px] text-amber-500 font-bold px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                title="Query Twilio API and refresh local records"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
                {isSyncingTemplates ? 'Syncing...' : 'Fetch Live API'}
              </button>

              <button
                onClick={() => {
                  const nextTemplates = approvedTemplates.map(t => ({
                    ...t,
                    status: 'approved'
                  }));
                  setApprovedTemplates(nextTemplates);
                  localStorage.setItem('approved_whatsapp_templates', JSON.stringify(nextTemplates));
                  alert('All pending WhatsApp template drafts submitted have been validated and marked as APPROVED by Meta!');
                }}
                type="button"
                className="text-[10px] text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5" /> Approve All
              </button>
            </div>
          </div>

          {/* Sync logs output if any */}
          {syncLogs.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-900 p-2.5 rounded-lg text-[9.5px] font-mono text-neutral-500 space-y-0.5 max-h-[80px] overflow-y-auto">
              <div className="text-neutral-400 font-bold uppercase tracking-wider text-[8.5px] mb-1">API Sync Logs:</div>
              {syncLogs.map((log, lidx) => (
                <div key={lidx} className="truncate">▪ {log}</div>
              ))}
            </div>
          )}

          {/* Tabs for Template Providers */}
          <div className="flex border border-neutral-850 rounded-lg p-0.5 bg-neutral-950/80 mb-3">
            <button
              type="button"
              onClick={() => setTemplateListTab('authkey')}
              className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                templateListTab === 'authkey' ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Authkey Templates
            </button>
            <button
              type="button"
              onClick={() => setTemplateListTab('twilio')}
              className={`flex-1 text-center py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                templateListTab === 'twilio' ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/40 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Twilio Templates
            </button>
          </div>

          {(() => {
            const displayedTemplatesRaw = approvedTemplates.filter(t => 
               templateListTab === 'authkey' ? t.gateway === 'authkey' || (!t.gateway && t.name.includes('AUTHKEY')) : t.gateway !== 'authkey' && !t.name.includes('AUTHKEY')
            );
            const seenIds = new Set();
            const displayedTemplates = displayedTemplatesRaw.filter(t => {
               if (seenIds.has(t.id)) return false;
               seenIds.add(t.id);
               return true;
            });
            return displayedTemplates.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500 font-mono italic">
                No WhatsApp templates found for {templateListTab === 'authkey' ? 'Authkey' : 'Twilio'}. Provide a Content ID to register details.
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {displayedTemplates.map((tpl, index) => (
                  <div key={`${tpl.id}-${index}`} className="bg-neutral-950 border border-neutral-850 hover:border-neutral-700/60 rounded-lg p-3.5 space-y-2 transition animate-fadeIn">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[12px] font-semibold text-neutral-200 block truncate max-w-[200px]">ID: {tpl.name}</span>
                        <span className="text-[9px] text-neutral-500 font-mono mt-0.5 block flex items-center gap-1.5 flex-wrap">
                          {tpl.gateway ? (
                            <span className="bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 px-1.5 py-0.2 rounded text-[7.5px] uppercase font-bold tracking-wide flex items-center gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                              Live {tpl.gateway} API
                            </span>
                          ) : (
                            <span className="bg-[#1c1917]/80 border border-neutral-800 text-neutral-450 px-1 py-0.2 rounded text-[7.5px] uppercase font-bold">
                              Local draft
                            </span>
                          )}
                          {(tpl.gateway === 'authkey' || tpl.id === '37382') && (
                            <a 
                              href={`https://console.authkey.io/dashboard/preview-whatsapp-template/${/^\\d+$/.test(tpl.id) ? tpl.id : '37382'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 px-1.5 py-0.2 rounded text-[7.5px] font-bold tracking-wide flex items-center gap-0.5 transition cursor-pointer normal-case"
                              title="Preview layout on Live Authkey Console"
                            >
                              <ExternalLink className="h-2.5 w-2.5 text-amber-400" /> console preview
                            </a>
                          )}
                          {tpl.format && (
                            <span className="bg-neutral-900 border border-neutral-800/60 text-amber-500 px-1 py-0.2 rounded text-[7.5px] uppercase font-bold tracking-wide">
                              {tpl.format} Format
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                        tpl.status === 'approved'
                          ? 'bg-emerald-955/20 border-emerald-850 text-emerald-400 font-bold'
                          : 'bg-amber-955/20 border-amber-850 text-amber-400 animate-pulse'
                      }`}>
                        {tpl.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2 italic font-mono bg-neutral-900/40 p-2 rounded border border-neutral-900/50">
                      "{tpl.body}"
                    </p>

                    <div className="flex justify-between items-center text-[10px] font-sans text-neutral-500 pt-1.5 border-t border-neutral-900/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">Code: {tpl.id}</span>
                        {tpl.type && (
                          <span className="bg-neutral-900 border border-neutral-800 text-teal-400 font-bold px-1 py-0.5 rounded text-[8px] uppercase shrink-0">
                            {tpl.type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectTemplate(tpl)}
                          className="text-emerald-400 hover:text-emerald-300 font-bold transition flex items-center gap-0.5 cursor-pointer text-[10px]"
                          title="Load this template to draft box immediately"
                        >
                          ⚡ Apply Template
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const next = approvedTemplates.filter(t => t.id !== tpl.id);
                            setApprovedTemplates(next);
                            localStorage.setItem('approved_whatsapp_templates', JSON.stringify(next));
                          }}
                          className="text-neutral-550 hover:text-rose-400 transition cursor-pointer"
                        >
                          Remove Log
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
