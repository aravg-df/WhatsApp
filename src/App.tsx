import React, { useState, useEffect } from 'react';
import { 
  Send, Users, History, Key, CheckSquare, ShieldCheck, 
  Settings, Loader, Sparkles, MessageCircleCode, Info, MessageSquare
} from 'lucide-react';
import { ContactGroup, BroadcastHistory, SystemConfigStatus, Client } from './types.js';
import BroadcastTab from './components/BroadcastTab.js';
import GroupsTab from './components/GroupsTab.js';
import HistoryTab from './components/HistoryTab.js';
import CredentialsStatus from './components/CredentialsStatus.js';

import MasterDataTab from './components/MasterDataTab.js';

export default function App() {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'broadcast' | 'groups' | 'master' | 'history' | 'status'>('broadcast');

  // Application-wide databases
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [historyList, setHistoryList] = useState<BroadcastHistory[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemConfigStatus | null>(null);

  // States loaders
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Synchronizers
  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching segments:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error('Error fetching broadcast logs:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error('Error checking gateway status:', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      await Promise.all([fetchClients(), fetchGroups(), fetchHistory(), fetchStatus()]);
    } catch (err: any) {
      setApiError('Unable to connect to the backend server API. Confirm that the server is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // Event Handlers passed down to subcomponents
  const handleSaveGroup = async (groupPayload: ContactGroup) => {
    try {
      const isEdit = !!groupPayload.id;
      const url = isEdit ? `/api/groups/${groupPayload.id}` : '/api/groups';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupPayload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed saving group');
      }

      const savedGroup = await res.json();
      await fetchGroups(); // sync groups directory
      return savedGroup;
    } catch (err: any) {
      alert(`Error saving segment: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed deleting group');
      }
      await fetchGroups(); // sync groups directory
    } catch (err: any) {
      alert(`Error deleting segment: ${err.message}`);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/history/clear', { method: 'POST' });
      if (!res.ok) throw new Error('Could not wipe credentials logs');
      setHistoryList([]);
    } catch (err: any) {
      alert(`Error clearing records: ${err.message}`);
    }
  };

  const handleTriggerRetry = async (historyId: string) => {
    try {
      const res = await fetch(`/api/history/${historyId}/retry`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected retry dispatch');
      }
      // Update history screen immediately after trigger
      await fetchHistory();
    } catch (err: any) {
      alert(`Error retrying failures: ${err.message}`);
    }
  };

  // Callback when a broadcast is initiated or changes status
  const handleBroadcastLifecycle = async (historyId: string) => {
    await fetchHistory();
  };

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-neutral-200 antialiased">
      {/* Upper Navigation Header */}
      <header className="bg-[#0a0a0a] border-b border-neutral-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4.5">
              <div className="bg-neutral-900 border border-neutral-800 text-amber-500 p-3 rounded-xl shrink-0 shadow-lg">
                <MessageCircleCode className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-serif tracking-tight text-white font-medium">
                  Bulk SMS <span className="italic font-normal text-amber-500/90">Broadcaster</span>
                </h1>
                <p className="text-xs text-neutral-400 font-mono tracking-wide mt-1">
                  Automatic sequential SMS blasting using Twilio and Authkey gateways
                </p>
              </div>
            </div>

            {/* Quick Status Pill */}
            {systemStatus && (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border ${
                  systemStatus.twilioConfigured 
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                    : 'bg-neutral-900 border-neutral-80 &text-neutral-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${systemStatus.twilioConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`}></span>
                  Twilio App
                </span>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border ${
                  systemStatus.authkeyConfigured 
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${systemStatus.authkeyConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`}></span>
                  Authkey App
                </span>
                
                <button 
                  onClick={initData}
                  title="Force Sync"
                  className="p-1 px-3 bg-neutral-900 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-800 hover:border-neutral-700 rounded-lg transition cursor-pointer"
                >
                  Sync Database
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader className="h-8 w-8 text-amber-500 animate-spin" />
            <p className="text-sm font-mono text-neutral-450 tracking-wide animate-pulse">Synchronizing application directory...</p>
          </div>
        ) : apiError ? (
          <div className="bg-neutral-905 border border-red-950/50 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4 shadow-xl">
            <Info className="h-10 w-10 text-rose-500 mx-auto" />
            <h3 className="font-serif text-lg font-medium text-white">Connection Interrupted</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">{apiError}</p>
            <button
              onClick={initData}
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 hover:text-white rounded-lg px-5 py-2 text-xs font-semibold transition active:scale-95"
            >
              Reconnect Connection
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Horizontal Segment Tabs */}
            <div className="flex overflow-x-auto border-b border-neutral-900/60 gap-1 pb-px scrollbar-none">
              <button
                onClick={() => setActiveTab('broadcast')}
                className={`py-3.5 px-5 font-medium text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'broadcast'
                    ? 'border-amber-500 text-neutral-100 font-semibold bg-neutral-900/30'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Send className="h-4 w-4" /> Message Broadcaster
              </button>

              <button
                onClick={() => setActiveTab('groups')}
                className={`py-3.5 px-5 font-medium text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'groups'
                    ? 'border-amber-500 text-neutral-100 font-semibold bg-neutral-900/30'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Users className="h-4 w-4" /> Contact Groups ({groups.length})
              </button>

              <button
                onClick={() => setActiveTab('master')}
                className={`py-3.5 px-5 font-medium text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'master'
                    ? 'border-amber-500 text-neutral-100 font-semibold bg-neutral-900/30'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> Master Data
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 px-5 font-medium text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-amber-500 text-neutral-100 font-semibold bg-neutral-900/30'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <History className="h-4 w-4" /> Dispatch History ({historyList.length})
              </button>

              <button
                onClick={() => setActiveTab('status')}
                className={`py-3.5 px-5 font-medium text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'status'
                    ? 'border-amber-500 text-neutral-100 font-semibold bg-neutral-900/30'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Key className="h-4 w-4" /> Configure Gateways
              </button>
            </div>

            {/* Render Selected View */}
            <div className="min-h-[400px]">
              {activeTab === 'broadcast' && (
                <BroadcastTab
                  clients={clients}
                  groups={groups}
                  systemStatus={systemStatus}
                  onBroadcastTriggered={handleBroadcastLifecycle}
                />
              )}

              {activeTab === 'groups' && (
                <GroupsTab
                  clients={clients}
                  groups={groups}
                  onSaveGroup={handleSaveGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onClientsChanged={fetchClients}
                />
              )}

              {activeTab === 'master' && (
                <MasterDataTab
                  clients={clients}
                  groups={groups}
                  fetchGroups={fetchGroups}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  historyList={historyList}
                  onClearHistory={handleClearHistory}
                  onTriggerRetry={handleTriggerRetry}
                  onRefresh={fetchHistory}
                />
              )}

              {activeTab === 'status' && (
                <div className="space-y-6">
                  <CredentialsStatus status={systemStatus} onRefresh={fetchStatus} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="bg-[#0a0a0a] border-t border-neutral-900 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs text-neutral-500 tracking-wider font-mono">
          BULK SMS BROADCASTER AUTOMATION ENGINE • SECURE OPERATIONS CONSOLE
        </div>
      </footer>
    </div>
  );
}
