import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Key, HelpCircle, Server, RefreshCw, Wallet } from 'lucide-react';
import { SystemConfigStatus } from '../types.js';

interface CredentialsStatusProps {
  status: SystemConfigStatus | null;
  onRefresh: () => void;
}

export default function CredentialsStatus({ status, onRefresh }: CredentialsStatusProps) {
  const [twilioBalance, setTwilioBalance] = useState<{ balance: string; currency: string; inrRate?: number } | null>(null);
  const [twilioBalanceLoading, setTwilioBalanceLoading] = useState(false);
  const [authkeyBalance, setAuthkeyBalance] = useState<any>(null);
  const [authkeyBalanceLoading, setAuthkeyBalanceLoading] = useState(false);

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

  const fetchTwilioBalance = async () => {
    try {
      setTwilioBalanceLoading(true);
      const res = await fetch('/api/balance/twilio');
      if (res.ok) {
        const data = await res.json();
        
        try {
          const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            data.inrRate = rateData.rates.INR;
          }
        } catch (e) {
          data.inrRate = 83.5; // Fallback approximate value
        }
        
        setTwilioBalance(data);
      } else {
        const error = await res.json();
        alert(`Failed to fetch Twilio balance: ${error.error}`);
      }
    } catch (err) {
      alert("Error checking Twilio balance");
    } finally {
      setTwilioBalanceLoading(false);
    }
  };

  const fetchAuthkeyBalance = async () => {
    try {
      setAuthkeyBalanceLoading(true);
      const res = await fetch('/api/balance/authkey');
      if (res.ok) {
        const data = await res.json();
        setAuthkeyBalance(data);
      } else {
        const error = await res.json();
        alert(`Failed to fetch Authkey balance: ${error.error}`);
      }
    } catch (err) {
      alert("Error checking Authkey balance");
    } finally {
      setAuthkeyBalanceLoading(false);
    }
  };

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
          {twilioConfigured && (
            <div className="mt-4 pt-4 border-t border-emerald-500/10">
              <div className="flex items-center justify-between">
                <button
                  onClick={fetchTwilioBalance}
                  disabled={twilioBalanceLoading}
                  className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {twilioBalanceLoading ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Wallet className="h-3 w-3"/>}
                  Check Live Balance
                </button>
                {twilioBalance && (
                  <span className="text-sm font-mono font-medium text-emerald-400">
                    {twilioBalance.currency === 'USD' && twilioBalance.inrRate ? (
                      <>
                        ₹ {(parseFloat(twilioBalance.balance) * twilioBalance.inrRate).toFixed(2)} <span className="text-[10px] text-neutral-500">(${parseFloat(twilioBalance.balance).toFixed(2)} USD)</span>
                      </>
                    ) : (
                      <>
                        {twilioBalance.balance} {twilioBalance.currency}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
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
          {authkeyConfigured && (
            <div className="mt-4 pt-4 border-t border-emerald-500/10">
              <div className="flex items-center justify-between">
                <button
                  onClick={fetchAuthkeyBalance}
                  disabled={authkeyBalanceLoading}
                  className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {authkeyBalanceLoading ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Wallet className="h-3 w-3"/>}
                  Check Live Balance
                </button>
                {authkeyBalance && (
                  <span className="text-xs font-mono font-medium text-emerald-400 max-w-[200px] overflow-hidden text-right whitespace-nowrap text-ellipsis" title={JSON.stringify(authkeyBalance)}>
                    {authkeyBalance.balance !== undefined ? `₹ ${authkeyBalance.balance}` : (authkeyBalance.message || authkeyBalance.status || 'Details loaded')}
                  </span>
                )}
              </div>
            </div>
          )}
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
