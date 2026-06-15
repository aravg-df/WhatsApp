import React from 'react';
import { ShieldCheck, AlertTriangle, Key, HelpCircle, Server } from 'lucide-react';
import { SystemConfigStatus } from '../types.js';

interface CredentialsStatusProps {
  status: SystemConfigStatus | null;
  onRefresh: () => void;
}

export default function CredentialsStatus({ status, onRefresh }: CredentialsStatusProps) {
  if (!status) {
    return (
      <div className="animate-pulse bg-neutral-950 border border-neutral-900 rounded-xl p-5 flex gap-4 items-center">
        <Server className="h-5 w-5 text-neutral-600 animate-spin" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-neutral-905 rounded w-1/4"></div>
          <div className="h-3 bg-neutral-910 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const { twilioConfigured, twilioFrom, twilioWhatsAppFrom, authkeyConfigured, authkeySender, authkeyWhatsAppSender } = status;

  return (
    <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl shadow-md overflow-hidden">
      <div className="bg-neutral-950 border-b border-neutral-900 px-4.5 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-amber-500" />
          <h3 className="font-serif text-white text-sm font-medium">SMS & WhatsApp Gateways Connectivity</h3>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-amber-500 hover:text-amber-400 font-semibold transition cursor-pointer"
        >
          Check Connectivity
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Twilio Block */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition ${
          twilioConfigured ? 'border-emerald-500/20 bg-emerald-500/[0.015]' : 'border-amber-500/10 bg-amber-500/[0.015]'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-200 text-sm">Twilio Gateway</span>
              {twilioConfigured ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/5 px-2.5 py-0.5 rounded-md border border-amber-500/20 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" /> Unconfigured
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed mb-1">
              {twilioConfigured
                ? `Ready to blast SMS using: ${twilioFrom}`
                : 'Twilio handles international deliverability seamlessly. Key variables are missing.'}
            </p>
            {twilioConfigured && twilioWhatsAppFrom && (
              <p className="text-[11px] font-mono text-emerald-400/80 mb-3 block">
                • WhatsApp Sender: {twilioWhatsAppFrom}
              </p>
            )}
            {twilioConfigured && !twilioWhatsAppFrom && (
              <p className="text-[11px] font-mono text-amber-400/60 mb-3 block">
                • WhatsApp Sender: -- (defaults to {twilioFrom})
              </p>
            )}
          </div>
          {!twilioConfigured && (
            <div className="text-[10px] bg-neutral-950 border border-neutral-850 p-2 rounded-lg text-amber-400 leading-relaxed font-mono mt-2">
              Missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
            </div>
          )}
        </div>

        {/* Authkey Block */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition ${
          authkeyConfigured ? 'border-emerald-500/20 bg-emerald-500/[0.015]' : 'border-amber-500/10 bg-amber-500/[0.015]'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-200 text-sm">Authkey Gateway</span>
              {authkeyConfigured ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/5 px-2.5 py-0.5 rounded-md border border-amber-500/20 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" /> Unconfigured
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed mb-1">
              {authkeyConfigured
                ? `Ready to blast SMS using Sender ID: ${authkeySender}`
                : 'Authkey.io delivers cost-effective regional transactional SMS blast services.'}
            </p>
            {authkeyConfigured && authkeyWhatsAppSender && (
              <p className="text-[11px] font-mono text-emerald-400/80 mb-3 block">
                • WhatsApp Sender ID: {authkeyWhatsAppSender}
              </p>
            )}
            {authkeyConfigured && !authkeyWhatsAppSender && (
              <p className="text-[11px] font-mono text-amber-400/60 mb-3 block">
                • WhatsApp Sender ID: -- (defaults to {authkeySender})
              </p>
            )}
          </div>
          {!authkeyConfigured && (
            <div className="text-[10px] bg-neutral-950 border border-neutral-850 p-2 rounded-lg text-amber-400 leading-relaxed font-mono mt-2">
              Missing: AUTHKEY_API_KEY, AUTHKEY_SENDER_ID
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#080808] border-t border-neutral-900 px-4.5 py-3.5 text-xs text-neutral-400 flex items-start gap-2.5">
        <HelpCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-500">Configuration Protocol:</span> Add required tokens using the <span className="font-semibold bg-neutral-950 text-neutral-200 border border-neutral-850 px-1.5 py-0.5 rounded text-[11px] font-mono">Secrets panel</span> in Google AI Studio or set them in your local <span className="font-mono text-neutral-200">.env</span> file. This system dynamically coordinates gateways live.
        </div>
      </div>
    </div>
  );
}
