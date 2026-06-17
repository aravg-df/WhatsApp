import React, { useState } from 'react';
import { 
  History, Trash2, CheckCircle2, XCircle, ChevronDown, ChevronUp, 
  Search, RefreshCw, Layers, ShieldCheck, AlertCircle, Sparkles, Filter,
  MessageSquare, Check, CheckCheck
} from 'lucide-react';
import { BroadcastHistory, BroadcastRecipient } from '../types.js';

interface HistoryTabProps {
  historyList: BroadcastHistory[];
  onClearHistory: () => Promise<void>;
  onTriggerRetry: (historyId: string) => Promise<void>;
  onRefresh: () => void;
}

export default function HistoryTab({ historyList, onClearHistory, onTriggerRetry, onRefresh }: HistoryTabProps) {
  // Expansion state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Status filtering inside detail tables
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [recipQuery, setRecipQuery] = useState('');

  // Sibling states
  const [isRetryingMap, setIsRetryingMap] = useState<Record<string, boolean>>({});

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setStatusFilter('all');
      setRecipQuery('');
    }
  };

  const handleClear = async () => {
    await onClearHistory();
    setShowClearConfirm(false);
  };

  const handleRetryFailed = async (e: React.MouseEvent, hId: string) => {
    e.stopPropagation(); // prevent collapsing card
    setIsRetryingMap(prev => ({ ...prev, [hId]: true }));
    try {
      await onTriggerRetry(hId);
    } finally {
      setIsRetryingMap(prev => ({ ...prev, [hId]: false }));
    }
  };

  // Convert date to reader friendly format
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-neutral-900 border border-neutral-800 text-amber-500 rounded-lg shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-medium text-white">Campaign Blast History Log</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Track logs, monitor delivery status across networks, and retry drops.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={onRefresh}
            className="flex-1 sm:flex-initial text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg px-4 py-2 font-semibold transition cursor-pointer"
          >
            Refresh Log
          </button>
          {historyList.length > 0 && (
            showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-400 font-medium">Clear all?</span>
                <button
                  onClick={handleClear}
                  className="bg-rose-500 hover:bg-rose-400 text-white px-3 py-2 rounded-lg text-xs font-bold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex-1 sm:flex-initial text-xs bg-rose-955/20 hover:bg-rose-950/45 text-rose-300 border border-rose-909/40 rounded-lg px-4 py-2 font-semibold transition cursor-pointer"
              >
                Clear Records
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-4">
        {historyList.length === 0 ? (
          <div className="border border-dashed border-neutral-850 bg-[#0c0c0c] rounded-2xl py-14 text-center">
            <History className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
            <h4 className="font-serif text-neutral-300 text-base">No historical runs recorded</h4>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Your broad campaigns, delivery metrics, and failure logs will compile here dynamically when you dispatch messages.
            </p>
          </div>
        ) : (
          historyList.map(run => {
            const isExpanded = expandedId === run.id;
            const successPct = Math.round((run.successCount / run.totalContacts) * 100) || 0;
            const hasFailures = run.failedCount > 0;
            const isRetrying = !!isRetryingMap[run.id];

            // Filter recipients list inside expanded card
            const detailList = run.recipients.filter(rec => {
              const matchesSearch = rec.name.toLowerCase().includes(recipQuery.toLowerCase()) || 
                                    rec.phone.includes(recipQuery);
              if (statusFilter === 'all') return matchesSearch;
              return rec.status === statusFilter && matchesSearch;
            });

            return (
              <div 
                key={run.id} 
                className={`bg-[#0c0c0c] border rounded-xl overflow-hidden transition shadow-sm ${
                  isExpanded ? 'border-amber-500/50 shadow-md' : 'border-neutral-900 hover:border-neutral-800'
                }`}
              >
                {/* Main Card Header (Clickable for details) */}
                <div 
                  onClick={() => toggleExpand(run.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-bold bg-neutral-900 text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded-sm">
                        {run.gateway} Broadcaster
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">
                        {formatTime(run.timestamp)}
                      </span>
                      {run.status === 'in_progress' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/5 px-2.5 py-0.5 rounded-md border border-amber-500/20 animate-pulse">
                          <RefreshCw className="h-3 w-3 animate-spin text-amber-500" /> In Progress
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                          run.failedCount === 0 
                            ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20' 
                            : 'text-amber-400 bg-amber-500/5 border-amber-500/20'
                        }`}>
                          {run.failedCount === 0 ? '✔ Pristine Delivery' : '⚠ Partial Failure'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-serif text-base text-neutral-100 line-clamp-1">
                      Target Group: <span className="text-amber-450 italic font-normal">{run.groupName}</span> <span className="font-sans text-xs text-neutral-550 mx-2">|</span> Message: <span className="font-sans font-normal text-xs text-neutral-450">"{run.message}"</span>
                    </h4>
                  </div>

                  {/* Delivery metrics summary */}
                  <div className="flex items-center gap-4 py-1">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="min-w-[60px] bg-neutral-950 border border-neutral-905 p-1.5 rounded-lg">
                        <span className="text-[9px] text-neutral-500 uppercase tracking-wider block font-mono">Total</span>
                        <span className="font-bold text-neutral-300">{run.totalContacts}</span>
                      </div>
                      <div className="min-w-[60px] bg-emerald-955/20 border border-emerald-900/30 p-1.5 rounded-lg">
                        <span className="text-[9px] text-emerald-400 uppercase tracking-wider block font-mono">Sent</span>
                        <span className="font-bold text-emerald-400">{run.successCount}</span>
                      </div>
                      <div className="min-w-[60px] bg-neutral-950 border border-neutral-905 p-1.5 rounded-lg">
                        <span className="text-[9px] text-rose-500 uppercase tracking-wider block font-mono">Failed</span>
                        <span className="font-bold text-rose-400">{run.failedCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {hasFailures && run.status !== 'in_progress' && (
                        <button
                          onClick={(e) => handleRetryFailed(e, run.id)}
                          disabled={isRetrying}
                          className="bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-900 border border-amber-600/30 disabled:border-neutral-850 text-neutral-950 disabled:text-neutral-600 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm"
                          title="Retry failed contacts in background"
                        >
                          <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                          Retry Drops ({run.failedCount})
                        </button>
                      )}
                      
                      <div className="text-neutral-550">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="border-t border-neutral-900 bg-neutral-950/40 p-5 space-y-4">
                    {/* Message Preview field */}
                    <div className="bg-[#050505] border border-neutral-900 rounded-xl p-4 shadow-inner">
                      <h5 className="font-serif text-white text-xs font-medium uppercase tracking-wider mb-2">Message Content Broadcasted</h5>
                      <p className="text-sm text-neutral-300 leading-relaxed font-sans">{run.message}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-neutral-300">
                          <Layers className="h-4 w-4 text-amber-500" />
                          <h5 className="font-mono text-xs uppercase tracking-wider text-neutral-300">Delivery Status Trace</h5>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Search box */}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-550" />
                            <input
                              type="text"
                              value={recipQuery}
                              onChange={e => setRecipQuery(e.target.value)}
                              placeholder="Search recipient..."
                              className="text-xs border border-neutral-850 rounded-lg pl-8.5 pr-3 py-1.5 outline-none w-44 bg-[#0c0c0c] text-neutral-255"
                            />
                          </div>

                          {/* Filters */}
                          <div className="flex border border-neutral-850 rounded-lg p-0.5 bg-neutral-950 text-xs">
                            <button
                              onClick={() => setStatusFilter('all')}
                              className={`px-3 py-1 rounded cursor-pointer transition ${
                                statusFilter === 'all' ? 'bg-neutral-800 shadow-sm text-neutral-100 font-semibold border border-neutral-700/40' : 'text-neutral-500'
                              }`}
                            >
                              All
                            </button>
                            <button
                              onClick={() => setStatusFilter('success')}
                              className={`px-3 py-1 rounded cursor-pointer transition ${
                                statusFilter === 'success' ? 'bg-neutral-800 shadow-sm text-emerald-400 font-semibold border border-neutral-700/40' : 'text-neutral-500'
                              }`}
                            >
                              Success
                            </button>
                            <button
                              onClick={() => setStatusFilter('failed')}
                              className={`px-3 py-1 rounded cursor-pointer transition ${
                                statusFilter === 'failed' ? 'bg-neutral-800 shadow-sm text-rose-450 font-semibold border border-neutral-700/40' : 'text-neutral-500'
                              }`}
                            >
                              Failed
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Recipient Details Table */}
                      <div className="border border-neutral-900 bg-[#0c0c0c] rounded-xl overflow-x-auto max-h-60 shadow-inner">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#050505] sticky top-0 border-b border-neutral-900 text-[10px] text-neutral-450 font-mono uppercase tracking-wider">
                            <tr>
                              <th className="py-2.5 px-4 w-1/3">Recipient Description</th>
                              <th className="py-2.5 px-4 w-1/4 font-mono">Destination Number</th>
                              <th className="py-2.5 px-4 w-1/6 font-mono">Channel & Cost</th>
                              <th className="py-2.5 px-4 text-right">Status Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900/60 text-neutral-300 font-sans">
                            {detailList.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-neutral-500 font-mono">
                                  No recipients match your search filter settings in this campaign.
                                </td>
                              </tr>
                            ) : (
                              detailList.map((rec, rIdx) => (
                                <tr key={rIdx} className="hover:bg-neutral-900/35 transition border-b border-neutral-900/20">
                                  <td className="py-2.5 px-4">
                                    <div className="font-semibold text-neutral-250">{rec.name}</div>
                                    {rec.replyText && (
                                      <div className="mt-1 inline-flex items-start gap-1.5 bg-[#121c21] border border-emerald-900/50 p-2 py-1.5 relative rounded-lg text-[10px] text-emerald-400 leading-normal max-w-sm italic">
                                        <MessageSquare className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>&ldquo;{rec.replyText}&rdquo;</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono select-all text-neutral-350">
                                    {rec.phone}
                                  </td>
                                  <td className="py-2.5 px-4 uppercase text-[10px] font-bold font-mono text-neutral-450">
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="bg-neutral-905 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-850">
                                        {rec.channelUsed || run.gateway}
                                      </span>
                                      {rec.cost !== undefined && (
                                        <span className="text-amber-500/80 font-mono text-[9px] lowercase" title="Deducted balance cost">
                                          cost: {rec.cost}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    {rec.status === 'success' ? (
                                      <div className="inline-flex flex-col items-end gap-1">
                                        {/* Dynamic delivery indicator badges */}
                                        {rec.deliveryStatus === 'replied' ? (
                                          <span className="text-[10px] font-sans font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3 text-emerald-450" /> Replied
                                          </span>
                                        ) : rec.deliveryStatus === 'read' ? (
                                          <span className="text-[10px] font-sans font-medium text-cyan-400 bg-cyan-950/20 border border-cyan-900/35 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                            <CheckCheck className="h-3.5 w-3.5 text-cyan-400" /> Read
                                          </span>
                                        ) : rec.deliveryStatus === 'delivered' ? (
                                          <span className="text-[10px] font-sans font-medium text-teal-400 bg-teal-950/20 border border-teal-900/35 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                            <CheckCheck className="h-3.5 w-3.5 text-neutral-450" /> Delivered
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-sans font-medium text-neutral-400 bg-neutral-900/40 border border-neutral-850 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                            <Check className="h-3.5 w-3.5 text-neutral-500" /> Sent
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-rose-405 font-medium inline-flex items-center gap-1.5" title={rec.error}>
                                        <XCircle className="h-3.5 w-3.5 shrink-0" /> Error: {rec.error || 'Submission failed'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
