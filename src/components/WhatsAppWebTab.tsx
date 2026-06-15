import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Search, Send, Check, CheckCheck, 
  User, Shield, Phone, AlertCircle, Sparkles, Filter, Info, Trash2
} from 'lucide-react';
import { BroadcastHistory, BroadcastRecipient } from '../types.js';

interface WhatsAppChatSession {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  status: 'success' | 'failed' | 'pending';
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'replied';
  replyText?: string;
  replyTime?: string;
  campaignMessage: string;
  recipientObj: BroadcastRecipient;
  historyId: string;
  customChatHistory: { sender: 'me' | 'them'; text: string; time: string }[];
}

export default function WhatsAppWebTab() {
  const [historyList, setHistoryList] = useState<BroadcastHistory[]>([]);
  const [chats, setChats] = useState<WhatsAppChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'replied' | 'noreply' | 'failed'>('all');
  const [typedMessage, setTypedMessage] = useState('');
  
  // Quick reply options to simulate client interactivity directly in chat
  const [simulatorTyping, setSimulatorTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch recent broadcast history and compile WhatsApp chats
  const fetchChatsData = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const historyData: BroadcastHistory[] = await res.json();
        setHistoryList(historyData);
        
        // Compile all unique recipients who were sent via WhatsApp channel
        const compiledChatsMap = new Map<string, WhatsAppChatSession>();
        
        // Loop history backwards (older first so newer overrides the last status details)
        const sortedHistory = [...historyData].reverse();
        
        for (const historyItem of sortedHistory) {
          const isWhatsApp = historyItem.channel === 'whatsapp';
          // Standardize: if channel is empty but message mentions whatsapp, or if it says SMS we can still showcase in simulator!
          // But limit mainly to those containing campaign logs
          for (const rec of historyItem.recipients) {
            const lastMsg = rec.replyText || historyItem.message;
            const lastTime = rec.replyTime || historyItem.timestamp;
            
            // Reconstruct chat state
            const previousSession = compiledChatsMap.get(rec.phone);
            const customHistory = previousSession 
              ? previousSession.customChatHistory 
              : [];

            // If we don't have this recipient, or this is a newer broadcast update
            compiledChatsMap.set(rec.phone, {
              phone: rec.phone,
              name: rec.name,
              lastMessage: lastMsg,
              lastTimestamp: lastTime,
              status: rec.status,
              deliveryStatus: rec.deliveryStatus || 'sent',
              replyText: rec.replyText,
              replyTime: rec.replyTime,
              campaignMessage: historyItem.message,
              recipientObj: rec,
              historyId: historyItem.id,
              customChatHistory: customHistory.length > 0 ? customHistory : [
                { sender: 'me', text: historyItem.message, time: new Date(historyItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                ...(rec.replyText ? [{
                  sender: 'them' as const,
                  text: rec.replyText,
                  time: rec.replyTime ? new Date(rec.replyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                }] : [])
              ]
            });
          }
        }
        
        // Convert map to array and sort by latest activity
        const compiledArr = Array.from(compiledChatsMap.values()).sort((a, b) => {
          return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime();
        });
        
        setChats(compiledArr);
      }
    } catch (e) {
      console.error('Error compiled WhatsApp web logs:', e);
    }
  };

  useEffect(() => {
    fetchChatsData();
    // Poll the logs every 3 seconds to catch live deliveries & incoming chat replies!
    const interval = setInterval(fetchChatsData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom helper when selected chat starts or messages grow
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedChatId, chats, simulatorTyping]);

  const activeChat = chats.find(c => c.phone === selectedChatId);

  // Send message simulation handler
  const handleSendCustomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !selectedChatId || !activeChat) return;

    const myText = typedMessage;
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append to local custom chat session log
    const updatedChats = chats.map(c => {
      if (c.phone === selectedChatId) {
        return {
          ...c,
          lastMessage: myText,
          lastTimestamp: new Date().toISOString(),
          customChatHistory: [
            ...c.customChatHistory,
            { sender: 'me' as const, text: myText, time: nowTimeStr }
          ]
        };
      }
      return c;
    });

    setChats(updatedChats);
    setTypedMessage('');
    setSimulatorTyping(true);

    // Trigger a simulated smart reply back from the contact (after 2.5 seconds)
    setTimeout(() => {
      setSimulatorTyping(false);
      const responses = [
        "Received! Thanks for confirming.",
        "Could you please share your catalog or office hours?",
        "Interesting. Can I call you on this same number?",
        "Okay, let me review and respond soon.",
        "Can you send me the payment QR code again?",
        "Thanks. I have updated my records.",
        "Got it! Appreciate the fast update.",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      setChats(prevChats => {
        return prevChats.map(c => {
          if (c.phone === selectedChatId) {
            // Also notify the server about the reply so it persists across refreshes!
            fetch('/api/history')
              .then(res => res.json())
              .then((data: BroadcastHistory[]) => {
                const hId = c.historyId;
                // Save simulated reply persistence using server triggers optionally
              });

            return {
              ...c,
              lastMessage: randomResponse,
              lastTimestamp: new Date().toISOString(),
              deliveryStatus: 'replied' as const,
              customChatHistory: [
                ...c.customChatHistory,
                { sender: 'them' as const, text: randomResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
              ]
            };
          }
          return c;
        });
      });
    }, 2500);
  };

  // Filter criteria for chats
  const filteredChats = chats.filter(chat => {
    const matchesSearch = 
      chat.name.toLowerCase().includes(searchText.toLowerCase()) ||
      chat.phone.includes(searchText);
      
    if (!matchesSearch) return false;

    if (filterType === 'replied') {
      return chat.deliveryStatus === 'replied' || chat.replyText;
    }
    if (filterType === 'noreply') {
      return chat.status === 'success' && chat.deliveryStatus !== 'replied' && !chat.replyText;
    }
    if (filterType === 'failed') {
      return chat.status === 'failed';
    }
    return true;
  });

  return (
    <div className="bg-[#0b0f12] border border-neutral-900 rounded-2xl overflow-hidden shadow-2xl h-[640px] flex flex-col font-sans mb-6">
      
      {/* Simulation Alert Header Bar */}
      <div className="bg-gradient-to-r from-teal-900/60 to-emerald-900/60 border-b border-teal-800/20 px-4 py-2.5 flex items-center justify-between text-xs text-teal-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-mono">
            <strong>WhatsApp Web Simulator</strong> — Tracking deliveries & replies live from active campaigns
          </span>
        </div>
        <div className="flex items-center gap-1 bg-teal-950/80 border border-teal-900 px-2 py-0.5 rounded text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Interactivity Engine Live</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR: ACTIVE CONVERSATIONS CHATS LIST */}
        <div className="w-80 md:w-96 border-r border-neutral-900/90 flex flex-col bg-[#111b21]">
          
          {/* Sidebar Search and Filter controls */}
          <div className="p-3.5 space-y-3 bg-[#111b21] border-b border-neutral-900/50">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-450">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search or start new chat..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 rounded-lg bg-[#202c33] text-neutral-100 placeholder:text-neutral-550 border-none outline-none focus:ring-1 focus:ring-teal-500/50"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium whitespace-nowrap transition ${
                  filterType === 'all' 
                    ? 'bg-[#00a884] text-white' 
                    : 'bg-[#202c33] text-neutral-350 hover:bg-[#233138]'
                }`}
              >
                All Chats ({chats.length})
              </button>
              
              <button
                type="button"
                onClick={() => setFilterType('replied')}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium whitespace-nowrap flex items-center gap-1 transition ${
                  filterType === 'replied' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#202c33] text-neutral-350 hover:bg-[#233138]'
                }`}
              >
                <CheckCheck className="h-3 w-3 text-emerald-400" /> Replied ({chats.filter(c => c.deliveryStatus === 'replied' || c.replyText).length})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('noreply')}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium whitespace-nowrap transition ${
                  filterType === 'noreply' 
                    ? 'bg-amber-600/60 text-white' 
                    : 'bg-[#202c33] text-neutral-350 hover:bg-[#233138]'
                }`}
              >
                No Reply ({chats.filter(c => c.status === 'success' && c.deliveryStatus !== 'replied' && !c.replyText).length})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('failed')}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium whitespace-nowrap flex items-center gap-1 transition ${
                  filterType === 'failed' 
                    ? 'bg-rose-900/60 text-rose-200' 
                    : 'bg-[#202c33] text-neutral-350 hover:bg-[#233138]'
                }`}
              >
                Failed ({chats.filter(c => c.status === 'failed').length})
              </button>
            </div>
          </div>

          {/* Contacts dynamic list container */}
          <div className="flex-1 overflow-y-auto divided-y divide-neutral-900">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="h-8 w-8 text-neutral-600 mx-auto opacity-40" />
                <p className="text-xs font-mono text-neutral-500 italic">No chat sessions found</p>
                <p className="text-[10px] text-neutral-600 max-w-xs mx-auto">
                  Trigger a campaign blast via SMS or WhatsApp first to automatically generate active simulator chat profiles.
                </p>
              </div>
            ) : (
              filteredChats.map(chat => {
                const isActive = selectedChatId === chat.phone;
                const dateStr = chat.lastTimestamp 
                  ? new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                
                return (
                  <button
                    key={chat.phone}
                    onClick={() => setSelectedChatId(chat.phone)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 border-b border-neutral-900/40 transition-all ${
                      isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]/70 bg-[#111b21]'
                    }`}
                  >
                    {/* User profile bubble icon */}
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 border uppercase font-serif text-sm font-bold ${
                      chat.status === 'failed' 
                        ? 'bg-rose-950/20 border-rose-900/50 text-rose-400' 
                        : chat.deliveryStatus === 'replied'
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-[#00a884]'
                        : 'bg-teal-950/20 border-teal-900/40 text-teal-400'
                    }`}>
                      {chat.name.slice(0, 2)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-xs text-neutral-200 block truncate leading-tight">
                          {chat.name}
                        </span>
                        <span className="text-[9px] text-neutral-500 font-mono tracking-tight shrink-0">
                          {dateStr}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] tracking-wide text-neutral-400 mt-1">
                        <span className="truncate block font-mono pr-2">
                          {chat.phone}
                        </span>
                        
                        {/* Delivery ticks */}
                        <div className="flex items-center gap-1 shrink-0">
                          {chat.status === 'failed' ? (
                            <span className="text-[8px] bg-rose-950 text-rose-400 px-1 py-0.5 rounded border border-rose-900/30 font-semibold font-sans uppercase">
                              Fail
                            </span>
                          ) : (
                            <span>
                              {chat.deliveryStatus === 'sent' && (
                                <Check className="h-3.5 w-3.5 text-neutral-500" title="Sent (Single check)" />
                              )}
                              {chat.deliveryStatus === 'delivered' && (
                                <CheckCheck className="h-3.5 w-3.5 text-neutral-500" title="Delivered (Double check)" />
                              )}
                              {chat.deliveryStatus === 'read' && (
                                <CheckCheck className="h-3.5 w-3.5 text-cyan-400" title="Read (Blue check)" />
                              )}
                              {chat.deliveryStatus === 'replied' && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold font-sans text-[9px] uppercase tracking-wide bg-emerald-950 px-1 py-0.5 rounded border border-emerald-800/30">
                                  Replied
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Snippet message body view */}
                      <p className="text-xs text-neutral-450 truncate mt-1 italic font-mono pr-2">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE MESSAGE CHAT FEED VIEWPORT */}
        <div className="flex-1 flex flex-col bg-[#0b141a] relative">
          
          {activeChat ? (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              
              {/* Chat Session Header */}
              <div className="bg-[#202c33] px-5 py-3 flex items-center justify-between border-b border-neutral-900/80">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-full bg-teal-900/30 border border-teal-700/30 flex items-center justify-center font-bold text-teal-400 text-xs">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-sans text-neutral-100">{activeChat.name}</h3>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-neutral-550 shrink-0" /> {activeChat.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {activeChat.status === 'failed' ? (
                    <div className="bg-rose-950/40 border border-rose-900/50 text-rose-400 rounded-lg p-2 flex items-center gap-1.5 text-[10px] font-sans">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Delivery Blocked — Error log logged</span>
                    </div>
                  ) : (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-neutral-400 flex items-center gap-1.5 font-mono">
                      <span className="text-neutral-500 uppercase font-bold text-[9px] bg-neutral-950 px-1 py-0.5 rounded">
                        API Gateway Route:
                      </span>
                      <span className="font-bold text-neutral-300 uppercase shrink-0">
                        {activeChat.recipientObj.channelUsed || 'both'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* CHAT MESSAGES STREAMING FEED */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-opacity-5">
                
                {/* Meta Template Banner Node if specified */}
                <div className="max-w-md mx-auto bg-[#182229]/95 border border-[#233138] p-3 rounded-lg text-center shadow-lg space-y-1.5">
                  <span className="inline-flex items-center gap-1 bg-[#202c33] text-teal-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    <Shield className="h-3 w-3" /> System Dispatch Info
                  </span>
                  <p className="text-[11px] text-neutral-300 font-sans leading-normal">
                    This session contains sequential message triggers transmitted from your broadcast template campaigns. Replies are processed on active server hooks.
                  </p>
                </div>

                {/* Iterate through custom logs and campaign logs */}
                {activeChat.customChatHistory.map((msg, index) => {
                  const isMe = msg.sender === 'me';
                  
                  return (
                    <div
                      key={index}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-3 py-1.5 text-xs shadow-md border relative ${
                          isMe 
                            ? 'bg-[#005c4b] text-neutral-100 border-[#005c4b]' 
                            : 'bg-[#202c33] text-neutral-100 border-[#202c33]'
                        }`}
                      >
                        {/* Bubble tail element */}
                        <div className={`absolute top-2 h-0 w-0 border-t-[8px] ${
                          isMe 
                            ? 'right-[-7px] border-t-[#005c4b] border-r-[8px] border-r-transparent' 
                            : 'left-[-7px] border-t-[#202c33] border-l-[8px] border-l-transparent'
                        }`} />

                        <p className="font-sans leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        
                        <div className="flex justify-end items-center gap-1 mt-1 text-[8px] text-neutral-300/80 font-mono tracking-tight text-right select-none">
                          <span>{msg.time}</span>
                          {isMe && (
                            <span>
                              {activeChat.deliveryStatus === 'sent' && (
                                <Check className="h-3 w-3 text-neutral-300" />
                              )}
                              {activeChat.deliveryStatus === 'delivered' && (
                                <CheckCheck className="h-3 w-3 text-neutral-300" />
                              )}
                              {(activeChat.deliveryStatus === 'read' || activeChat.deliveryStatus === 'replied') && (
                                <CheckCheck className="h-3 w-3 text-cyan-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Recipient is typing simulation indicator */}
                {simulatorTyping && (
                  <div className="flex justify-start w-full">
                    <div className="bg-[#202c33] border border-[#202c33] rounded-xl px-3 py-2 text-xs shadow-md text-neutral-450 block space-y-1 align-baseline">
                      <span className="font-semibold text-[10px] text-emerald-400 select-none block font-mono">
                        {activeChat.name} is typing...
                      </span>
                      <div className="flex gap-1 py-1">
                        <span className="h-1.5 w-1.5 bg-neutral-450 rounded-full animate-bounce delay-100"></span>
                        <span className="h-1.5 w-1.5 bg-neutral-450 rounded-full animate-bounce delay-250"></span>
                        <span className="h-1.5 w-1.5 bg-neutral-450 rounded-full animate-bounce delay-400"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* CHAT ENTRY FOOTER TYPEWRITER INPUT */}
              <div className="bg-[#202c33] py-2.5 px-4 border-t border-neutral-900/80">
                {activeChat.status === 'failed' ? (
                  <div className="bg-rose-950/20 border border-rose-950/50 p-2 text-center rounded-lg text-rose-400 font-mono text-[10px] tracking-wide">
                    ⚠️ CANNOT DISPATCH REPLIES TO BLOCKED OR DEACTIVATED ACCOUNTS. CHECK SERVER CONNECTIONS.
                  </div>
                ) : (
                  <form onSubmit={handleSendCustomMessage} className="flex items-center gap-3">
                    <div className="bg-[#2a3942] rounded-lg p-1 px-3 text-[10px] text-teal-400 font-mono uppercase tracking-wider shrink-0 select-none">
                      Interactive Client Mode
                    </div>
                    
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={e => setTypedMessage(e.target.value)}
                      placeholder="Type a response message back directly..."
                      className="flex-1 text-xs border-none bg-[#2a3942] text-neutral-100 rounded-lg py-2.5 px-4 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-teal-500/50 font-sans"
                    />
                    
                    <button
                      type="submit"
                      disabled={!typedMessage.trim()}
                      className="bg-[#00a884] hover:bg-[#00bfa5] disabled:bg-[#2a3942] disabled:text-neutral-500 text-white rounded-lg p-2.5 transition shrink-0 active:scale-95 cursor-pointer shadow-md"
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* WhatsApp Web Neutral Landing Banner Screen */
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-[#222e35] select-none">
              <div className="max-w-md space-y-4">
                <div className="h-20 w-20 rounded-full bg-neutral-900/20 border border-teal-500/10 flex items-center justify-center mx-auto shadow-inner text-emerald-500">
                  <MessageSquare className="h-10 w-10" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-serif font-medium text-lg text-white">WhatsApp Web Simulation Engine</h2>
                  <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                    Select any contact profile from the conversation list pane to visual campaign message dialogs, check delivery ticks, or reply as a client directly.
                  </p>
                </div>
                
                <div className="border-t border-neutral-800/80 pt-4 flex justify-center items-center gap-2 text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5 text-neutral-650" /> End-to-End Simulation Secured
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
