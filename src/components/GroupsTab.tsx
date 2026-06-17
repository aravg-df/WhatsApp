import React, { useState } from 'react';
import { 
  Users, Trash2, Edit2, Plus, Search, FileJson, 
  Sparkles, Check, CheckCircle2, UserPlus, FileText, AlertCircle 
} from 'lucide-react';
import { Contact, ContactGroup, MasterContact, Client } from '../types.js';

interface GroupsTabProps {
  clients: Client[];
  groups: ContactGroup[];
  onSaveGroup: (group: ContactGroup) => Promise<ContactGroup | void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onClientsChanged: () => Promise<void>;
}

export default function GroupsTab({ clients, groups, onSaveGroup, onDeleteGroup, onClientsChanged }: GroupsTabProps) {
  // Client selection
  const [activeClientId, setActiveClientId] = useState<string>(clients[0]?.id || 'client-1');

  // Client Management state
  const [showClientManager, setShowClientManager] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Editing state
  const [activeGroup, setActiveGroup] = useState<ContactGroup | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  
  // Single contact adding state
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleCode, setSingleCode] = useState('91'); // Default coding: India

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  
  const [pendingMasterBinds, setPendingMasterBinds] = useState<string[]>([]);
  const [customAddCount, setCustomAddCount] = useState<string>('');
  const [isPullingMaster, setIsPullingMaster] = useState(false);

  const resetGroupEditor = () => {
    setActiveGroup(null);
    setIsCreatingNew(false);
    setGroupName('');
    setGroupDesc('');
    setSingleName('');
    setSinglePhone('');
    setSingleCode('91');
    setBulkText('');
    setImportFeedback(null);
    setPendingMasterBinds([]);
    setCustomAddCount('');
  };

  const handleEditGroupClick = (group: ContactGroup) => {
    setActiveGroup(group);
    setIsCreatingNew(false);
    setGroupName(group.name);
    setGroupDesc(group.description);
    setImportFeedback(null);
  };

  const handleCreateGroupClick = () => {
    setIsCreatingNew(true);
    setActiveGroup(null);
    setGroupName('');
    setGroupDesc('');
    setImportFeedback(null);
  };

  const cleanDigits = (val: string) => val.replace(/\D/g, '');

  const handleAddSingleContact = () => {
    if (!singlePhone.trim()) return;
    const phoneStr = cleanDigits(singlePhone);
    const codeStr = cleanDigits(singleCode) || '91';
    
    // Check global duplicate FOR THIS CLIENT
    const clientGroups = groups.filter(g => g.clientId === activeClientId);
    const existsGlobally = clientGroups.some(g => g.contacts.some(c => c.phone === phoneStr));
    const existsLocally = activeGroup?.contacts.some(c => c.phone === phoneStr);
    
    if (existsGlobally || existsLocally) {
      alert(`Contact with phone ${phoneStr} already exists in a group. Cannot add duplicates.`);
      return;
    }

    const newContact: Contact = {
      id: 'c-' + Math.random().toString(36).substring(2, 9),
      name: singleName.trim() || 'Customer',
      phone: phoneStr,
      countryCode: codeStr
    };

    if (activeGroup) {
      const updatedGroup = {
        ...activeGroup,
        contacts: [...activeGroup.contacts, newContact]
      };
      setActiveGroup(updatedGroup);
    } else {
      // Mock-state for creating new group before saving
      setActiveGroup({
        id: '',
        clientId: activeClientId,
        name: groupName || 'New Group Workspace',
        description: groupDesc,
        contacts: [newContact]
      });
    }

    setSingleName('');
    setSinglePhone('');
  };

  const handleDeleteContact = (contactId: string) => {
    if (!activeGroup) return;
    const updated = {
      ...activeGroup,
      contacts: activeGroup.contacts.filter(c => c.id !== contactId)
    };
    setActiveGroup(updated);
  };

  // Advanced parser for contacts
  const handleBulkImport = () => {
    if (!bulkText.trim()) return;
    setIsImporting(true);
    setImportFeedback(null);

    setTimeout(() => {
      try {
        const parsedContacts: Contact[] = [];
        const content = bulkText.trim();

        // 1. Check if valid JSON array
        if (content.startsWith('[') && content.endsWith(']')) {
          try {
            const rawArray = JSON.parse(content);
            if (Array.isArray(rawArray)) {
              for (const item of rawArray) {
                const rawPhone = item.phone || item.mobile || item.phoneNumber || item.contact || '';
                const rawName = item.name || item.fullName || item.customerName || 'Customer';
                // Try and find country code
                let rawCode = item.countryCode || item.country || item.code || '91';

                const phoneStr = String(rawPhone).replace(/\D/g, '');
                if (phoneStr) {
                  parsedContacts.push({
                    id: 'c-' + Math.random().toString(36).substring(2, 9),
                    name: String(rawName).trim(),
                    phone: phoneStr,
                    countryCode: String(rawCode).replace(/\D/g, '') || '91'
                  });
                }
              }
            }
          } catch (e) {
            // failed JSON, pass to row parser
          }
        }

        // 2. CSV / line by line parser if JSON path failed or returned 0
        if (parsedContacts.length === 0) {
          const lines = content.split('\n');
          for (const line of lines) {
            const row = line.trim();
            if (!row) continue;

            const cells = row.split(/,|\t/);
            if (cells.length >= 2) {
              // Format: "Name, Phone, [Code]"
              const namePart = cells[0].trim();
              const phonePart = cells[1].trim().replace(/\D/g, '');
              const codePart = cells[2] ? cells[2].trim().replace(/\D/g, '') : '91';
              if (phonePart) {
                parsedContacts.push({
                  id: 'c-' + Math.random().toString(36).substring(2, 9),
                  name: namePart || 'Customer',
                  phone: phonePart,
                  countryCode: codePart || '91'
                });
              }
            } else {
              // Just phone number, e.g. "9876543210" or "+15551234567"
              const rawDigit = row.replace(/\D/g, '');
              if (rawDigit.length >= 7) {
                let code = '91';
                let phone = rawDigit;
                
                // If it looks like international (starts with + on line)
                if (row.startsWith('+')) {
                  if (rawDigit.startsWith('91') && rawDigit.length > 10) {
                    code = '91';
                    phone = rawDigit.substring(2);
                  } else if (rawDigit.startsWith('1') && rawDigit.length > 10) {
                    code = '1';
                    phone = rawDigit.substring(1);
                  } else if (rawDigit.startsWith('44') && rawDigit.length > 10) {
                    code = '44';
                    phone = rawDigit.substring(2);
                  }
                }
                
                parsedContacts.push({
                  id: 'c-' + Math.random().toString(36).substring(2, 9),
                  name: `Contact ...${phone.substring(phone.length - 4)}`,
                  phone,
                  countryCode: code
                });
              }
            }
          }
        }

        // Filter out duplicates globally and locally FOR THIS CLIENT
        const clientGroups = groups.filter(g => g.clientId === activeClientId);
        const existingPhones = new Set(clientGroups.flatMap(g => g.contacts.map(c => c.phone)));
        if (activeGroup) {
          activeGroup.contacts.forEach(c => existingPhones.add(c.phone));
        }

        const uniqueContacts: Contact[] = [];
        let duplicatesSkipped = 0;

        for (const c of parsedContacts) {
          if (!existingPhones.has(c.phone)) {
            uniqueContacts.push(c);
            existingPhones.add(c.phone); // Prevent duplicates within the import itself
          } else {
            duplicatesSkipped++;
          }
        }

        if (uniqueContacts.length > 0) {
          if (activeGroup) {
            const updated = {
              ...activeGroup,
              contacts: [...activeGroup.contacts, ...uniqueContacts]
            };
            setActiveGroup(updated);
          } else {
            setActiveGroup({
              id: '',
              clientId: activeClientId,
              name: groupName || 'Imported Workspace',
              description: groupDesc,
              contacts: uniqueContacts
            });
          }
          setImportFeedback(`Successfully imported ${uniqueContacts.length} contacts! ${duplicatesSkipped > 0 ? `(Skipped ${duplicatesSkipped} duplicates)` : ''}`);
          setBulkText('');
        } else if (duplicatesSkipped > 0) {
          setImportFeedback(`Skipped all ${duplicatesSkipped} contacts because they already exist in your groups.`);
        } else {
          setImportFeedback('Could not detect any valid phone numbers or JSON fields. Review the pasting format.');
        }
      } catch (err: any) {
        setImportFeedback(`Parsing failed: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    }, 400);
  };

  const handleAddUnassignedMaster = async (count: number) => {
    setIsPullingMaster(true);
    try {
        const res = await fetch('/api/master-contacts');
        const masters: MasterContact[] = await res.json();
        const unassigned = masters.filter(c => !c.groupAssignments || !c.groupAssignments[activeClientId]);
        // exclude already in our group or other globally
        const clientGroups = groups.filter(g => g.clientId === activeClientId);
        const existingPhones = new Set(clientGroups.flatMap(g => g.contacts.map(c => c.phone)));
        if (activeGroup) {
          activeGroup.contacts.forEach(c => existingPhones.add(c.phone));
        }

        const toAdd: Contact[] = [];
        const toBind: string[] = [];
        for (const c of unassigned) {
            // we skip ones if they already exist globally
            if (!existingPhones.has(c.phone)) {
                toAdd.push({
                    id: c.id || ('c-' + Math.random().toString(36).substring(2, 9)), 
                    name: c.name || 'Customer',
                    phone: c.phone,
                    countryCode: c.countryCode || '91'
                });
                toBind.push(c.id);
                existingPhones.add(c.phone);
                if (toAdd.length >= count) break;
            }
        }

        if (toAdd.length > 0) {
           if (activeGroup) {
               setActiveGroup({
                 ...activeGroup,
                 contacts: [...activeGroup.contacts, ...toAdd]
               });
           } else {
               setActiveGroup({
                 id: '',
                 clientId: activeClientId,
                 name: groupName || 'New Group Workspace',
                 description: groupDesc,
                 contacts: toAdd
               });
           }
           setPendingMasterBinds(prev => [...prev, ...toBind]);
           alert(`Pulled ${toAdd.length} unassigned contacts. They will be bound to this group when you save.`);
        } else {
            alert("No more unique unassigned master contacts available to add.");
        }
    } catch(err: any) {
        alert("Failed to pull from master: " + err.message);
    } finally {
        setIsPullingMaster(false);
    }
  };

  const handleSaveGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const groupPayload: ContactGroup = {
      id: activeGroup ? activeGroup.id : '',
      clientId: activeGroup ? activeGroup.clientId : activeClientId,
      name: groupName.trim(),
      description: groupDesc.trim(),
      contacts: activeGroup ? activeGroup.contacts : []
    };

    const savedGroup = await onSaveGroup(groupPayload);
    
    // Check if we need to bind any grabbed master contacts
    if (savedGroup && pendingMasterBinds.length > 0) {
      try {
        await fetch('/api/master-contacts/bulk-group', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactIds: pendingMasterBinds,
            groupId: (savedGroup as ContactGroup).id,
            clientId: activeClientId
          })
        });
      } catch (err) {
        console.error("Failed to bind master contacts to saved group", err);
      }
    }

    resetGroupEditor();
  };

  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim() })
      });
      if (res.ok) {
        await onClientsChanged();
        const clientData = await res.json();
        setActiveClientId(clientData.id);
        setNewClientName('');
        setShowClientManager(false);
      }
    } catch (err: any) {
      alert("Failed creating client: " + err.message);
    }
  };

  // Filter contacts being viewed
  const filteredContacts = activeGroup
    ? activeGroup.contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Group Editor (Creation / Modification Overlay) */}
      {(activeGroup !== null || isCreatingNew) ? (
        <form onSubmit={handleSaveGroupSubmit} className="bg-[#0c0c0c] border border-neutral-900 rounded-xl shadow-xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-neutral-900 pb-4">
            <div>
              <h3 className="font-serif text-lg font-medium text-white">
                {activeGroup?.id ? 'Edit Contact Group' : 'Create New Group'}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Define your recipient group details and compile contacts</p>
            </div>
            <button
              type="button"
              onClick={resetGroupEditor}
              className="text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-350 hover:text-white px-3.5 py-1.5 border border-neutral-800 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-[2] space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-450 mb-1.5">Group Name*</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Premium Customers, Staff Group"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full text-sm border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition placeholder:text-neutral-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-450 mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Who are these users?"
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  className="w-full text-sm border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition placeholder:text-neutral-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Single Recipient Input */}
                <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl space-y-3.5">

                <div className="flex items-center gap-2 text-neutral-300">
                  <UserPlus className="h-4.5 w-4.5 text-amber-500" />
                  <span className="font-semibold text-xs uppercase tracking-wider font-mono">Quick-Add One Contact</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    placeholder="Name"
                    value={singleName}
                    onChange={e => setSingleName(e.target.value)}
                    className="w-full text-xs border border-neutral-850 bg-[#0c0c0c] text-neutral-200 rounded px-3 py-2.5 focus:ring-1 focus:ring-amber-500/55 outline-none placeholder:text-neutral-650"
                  />
                  <div className="flex w-full">
                    <input
                      type="text"
                      placeholder="91"
                      title="Country Code"
                      value={singleCode}
                      onChange={e => setSingleCode(e.target.value)}
                      className="w-12 text-center text-xs border border-neutral-850 bg-neutral-900 rounded-l px-1 py-2.5 border-r-0 font-medium text-neutral-400 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Phone (10 digits)"
                      value={singlePhone}
                      onChange={e => setSinglePhone(e.target.value)}
                      className="flex-1 text-xs border border-neutral-855 bg-[#0c0c0c] text-neutral-200 rounded-r px-3 py-2.5 focus:ring-1 focus:ring-amber-500/55 outline-none placeholder:text-neutral-650 font-mono w-full min-w-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSingleContact}
                    className="w-full bg-neutral-900 hover:bg-neutral-850 text-neutral-200 text-xs font-semibold border border-neutral-800 rounded py-2.5 transition active:scale-95 cursor-pointer"
                  >
                    Add Contact
                  </button>
                </div>
              </div>

              {/* Quick Extract from Master Data */}
              <div className="p-4 bg-indigo-950/10 border border-indigo-900/40 rounded-xl space-y-3.5">
                <div className="flex items-center gap-2 text-indigo-300">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-xs uppercase tracking-wider font-mono">Pull Unassigned From Master</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    type="button"
                    disabled={isPullingMaster}
                    onClick={() => handleAddUnassignedMaster(100)}
                    className="text-[10px] uppercase font-mono font-bold bg-[#0c0c0c] hover:bg-neutral-900 text-indigo-400 border border-indigo-900/50 px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                  >
                    +100
                  </button>
                  <button 
                    type="button"
                    disabled={isPullingMaster}
                    onClick={() => handleAddUnassignedMaster(200)}
                    className="text-[10px] uppercase font-mono font-bold bg-[#0c0c0c] hover:bg-neutral-900 text-indigo-400 border border-indigo-900/50 px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                  >
                    +200
                  </button>
                  <button 
                    type="button"
                    disabled={isPullingMaster}
                    onClick={() => handleAddUnassignedMaster(300)}
                    className="text-[10px] uppercase font-mono font-bold bg-[#0c0c0c] hover:bg-neutral-900 text-indigo-400 border border-indigo-900/50 px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                  >
                    +300
                  </button>

                  <div className="flex ml-auto w-full sm:w-auto mt-2 sm:mt-0 gap-2">
                    <input 
                      type="number"
                      min="1"
                      placeholder="Custom Qty"
                      value={customAddCount}
                      onChange={e => setCustomAddCount(e.target.value)}
                      className="w-24 text-[10px] bg-[#0c0c0c] border border-indigo-900/50 rounded px-2 text-indigo-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                    <button 
                      type="button"
                      disabled={isPullingMaster || !customAddCount}
                      onClick={() => handleAddUnassignedMaster(parseInt(customAddCount) || 0)}
                      className="text-[10px] uppercase font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-800 px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                    >
                      Pull
                    </button>
                  </div>
                </div>
              </div>
              {/* End of side-by-side grid */}
              </div>
            </div>
          </div>

          {/* Contacts List Table in current Edit session */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h4 className="font-serif text-white text-base">
                  Group Contacts List ({activeGroup?.contacts ? activeGroup.contacts.length : 0} items)
                </h4>
              </div>
              {/* Simple Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-550" />
                <input
                  type="text"
                  placeholder="Search current list..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="text-xs border border-neutral-850 rounded-lg pl-8.5 pr-3 py-2 outline-none w-52 bg-neutral-950 text-neutral-200 focus:bg-[#0c0c0c] transition"
                />
              </div>
            </div>

            <div className="border border-neutral-900 rounded-lg overflow-x-auto max-h-72 bg-neutral-955">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#050505] border-b border-neutral-900 sticky top-0 text-[10px] text-neutral-400 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Contact Name</th>
                    <th className="py-2.5 px-4 font-mono">Phone Number</th>
                    <th className="py-2.5 px-4 font-mono">Country Code</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60 text-xs text-neutral-300 bg-[#0c0c0c]">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-neutral-500 font-mono">
                        No contacts captured in this group workspace yet. Add some contact numbers above.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map(contact => (
                      <tr key={contact.id} className="hover:bg-neutral-900/30 transition">
                        <td className="py-2.5 px-4 font-medium text-neutral-250">{contact.name}</td>
                        <td className="py-2.5 px-4 font-mono text-neutral-350">{contact.phone}</td>
                        <td className="py-2.5 px-4">
                          <span className="bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded text-[10px] font-mono border border-neutral-800">
                            +{contact.countryCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-rose-400 hover:text-rose-350 hover:bg-rose-950/20 transition p-1 rounded"
                            title="Remove contact"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions footer */}
          <div className="flex justify-end gap-3 border-t border-neutral-900 pt-5">
            <button
              type="button"
              onClick={resetGroupEditor}
              className="px-5 py-2.5 border border-neutral-800 text-neutral-350 hover:text-white rounded-lg text-xs font-semibold hover:bg-neutral-900/40 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-bold px-6 py-2.5 transition shadow-lg shadow-amber-500/5 cursor-pointer"
            >
              Save Complete Group ({activeGroup?.contacts ? activeGroup.contacts.length : 0} items)
            </button>
          </div>
        </form>
      ) : (
        /* Groups Directory Home View */
        <div className="space-y-4">
            {/* Client Selector Bar */}
            <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider font-semibold">Active Client Workspace</label>
                {!showClientManager ? (
                  <select 
                    value={activeClientId}
                    onChange={e => setActiveClientId(e.target.value)}
                    className="bg-neutral-950 border border-neutral-850 text-amber-500 rounded-lg px-3 py-1.5 text-sm font-bold outline-none cursor-pointer focus:border-amber-500/50"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <form onSubmit={handleCreateClientSubmit} className="flex items-center gap-2">
                    <input 
                      type="text"
                      autoFocus
                      placeholder="New Client Name..."
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      className="bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-1.5 text-sm text-white outline-none w-48"
                    />
                    <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 px-3 py-1.5 rounded-lg text-xs font-bold">Save</button>
                    <button type="button" onClick={() => setShowClientManager(false)} className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Cancel</button>
                  </form>
                )}
              </div>
              {!showClientManager && (
                <button 
                  onClick={() => setShowClientManager(true)}
                  className="text-xs text-amber-500 hover:text-amber-400 font-semibold border border-amber-500/30 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition"
                >
                  + Add New Client
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5">
              <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-amber-500 rounded-lg shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-white">Customer Segments Directory</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Organize lists of mobile contacts to dispatch broadcasts seamlessly.</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleCreateGroupClick}
              className="bg-white hover:bg-neutral-200 text-neutral-950 px-5.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" /> Create Contact Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.filter(g => g.clientId === activeClientId).length === 0 ? (
              <div className="col-span-full border border-dashed border-neutral-850 rounded-2xl py-14 text-center bg-[#0c0c0c]">
                <Users className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
                <h4 className="font-serif text-neutral-300 text-base">No Groups For Active Client</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-5">
                  Define user segment lists or copy-paste list of numbers to launch broadcasting runs for this client.
                </p>
                <button
                  onClick={handleCreateGroupClick}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold px-5 py-2 rounded-lg transition shadow-md"
                >
                  Create Your First Group
                </button>
              </div>
            ) : (
              groups.filter(g => g.clientId === activeClientId).map(group => (
                <div key={group.id} className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-neutral-800 transition group">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-neutral-200 text-sm group-hover:text-amber-400 transition-colors">{group.name}</h4>
                      <span className="bg-neutral-900 text-amber-400 border border-neutral-800 shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold font-mono">
                        {group.contacts.length} Contacts
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 min-h-[2rem] leading-relaxed">
                      {group.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="border-t border-neutral-900 pt-4 mt-5 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => handleEditGroupClick(group)}
                      className="text-neutral-400 hover:text-amber-400 font-semibold flex items-center gap-1.5 transition-colors px-2 py-1.5 hover:bg-neutral-900/40 rounded"
                    >
                      <Edit2 className="h-3 w-3" /> Edit / Add Numbers
                    </button>
                    {confirmDeleteGroup === group.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400 font-medium">Are you sure?</span>
                        <button
                          onClick={() => onDeleteGroup(group.id)}
                          className="bg-rose-500 text-white px-2 py-1 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteGroup(null)}
                          className="bg-neutral-800 text-white px-2 py-1 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteGroup(group.id)}
                        className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 transition-colors px-2 py-1.5 hover:bg-rose-950/25 rounded animate-ease"
                        title="Delete Segment"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
