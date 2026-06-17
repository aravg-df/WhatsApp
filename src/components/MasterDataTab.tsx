import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Edit2, Plus, Search, FileJson, 
  Sparkles, Check, CheckCircle2, UserPlus, FileText, AlertCircle, Unlink, Save
} from 'lucide-react';
import { MasterContact, ContactGroup } from '../types.js';

interface MasterDataTabProps {
  groups: ContactGroup[];
  fetchGroups: () => void;
}

export default function MasterDataTab({ groups, fetchGroups }: MasterDataTabProps) {
  const [masterContacts, setMasterContacts] = useState<MasterContact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Group Assignment
  const [targetGroupId, setTargetGroupId] = useState<string>('');

  useEffect(() => {
    fetchMasterContacts();
  }, []);

  const fetchMasterContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-contacts');
      const data = await res.json();
      setMasterContacts(data);
    } catch (e) {
      console.error('Failed to fetch master contacts', e);
    } finally {
      setLoading(false);
    }
  };

  const cleanNamePrefixes = (name: string) => {
    // English variations
    let clean = name.replace(/^(Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s*/i, '');
    // Hindi variations
    clean = clean.replace(/^(Shree\s|Shri\s|Smt\.\s|श्री\s*|श्रीमती\s*|डा\.\s*)/i, '');
    clean = clean.trim();
    
    // Extact only first name and second name
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 2) {
      clean = words.slice(0, 2).join(' ');
    } else {
      clean = words.join(' ');
    }
    return clean;
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setIsImporting(true);
    setImportFeedback(null);

    const newlyParsed: any[] = [];
    const lines = bulkText.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        // CSV logic based on user template
        // columns from prompt: SR NO, FARM NAME, REPRASENTATIVE, Find, ADDRESS, MOBILE NO
        // Let's just do a basic match: find the likely mobile number segment, and likely name segment
        const cells = line.split(',');
        if (cells.length >= 2) {
          // find which column resembles a 10 digit number
          let phoneColIndex = -1;
          for (let c = 0; c < cells.length; c++) {
              let cleanNum = cells[c].replace(/\D/g, '');
              if (cleanNum.length >= 10 && cleanNum.length <= 15) {
                  phoneColIndex = c;
                  break;
              }
          }

          if (phoneColIndex !== -1) {
            let phoneStr = cells[phoneColIndex].replace(/\D/g, '');
            // default to index 2 for name if length > 3 (REPRASENTATIVE col)
            let nameStr = cells.length > 2 ? cells[2] : cells[0];
            
            // if nameStr is purely digits or very short, fallback
            if (nameStr.replace(/\D/g, '').length === nameStr.length || nameStr.length < 2) {
                nameStr = cells[0]; 
            }

            // Cleanup
            nameStr = cleanNamePrefixes(nameStr);
            let countryCode = '91';
            let phone = phoneStr;
            if (phone.length === 12 && phone.startsWith('91')) {
               phone = phone.substring(2);
            }

            newlyParsed.push({
                name: nameStr || 'Customer',
                phone: phone,
                countryCode
            });
          }
        }
    }

    if (newlyParsed.length === 0) {
        setImportFeedback("No valid contacts found. Please paste CSV with mobile numbers.");
        setIsImporting(false);
        return;
    }

    // Server will dedup by phone if we enforced index, but we did not in Master data (just unique ID).
    // Let's dedup on client
    const uniqueMap = new Map<string, any>();
    // Add existing
    masterContacts.forEach(mc => uniqueMap.set(mc.phone, mc));
    let newAdds = 0;
    const toSave: any[] = [];

    newlyParsed.forEach(p => {
        if (!uniqueMap.has(p.phone)) {
            uniqueMap.set(p.phone, p);
            toSave.push(p);
            newAdds++;
        }
    });

    if (toSave.length > 0) {
        try {
           const res = await fetch('/api/master-contacts/bulk', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ contacts: toSave })
           });
           if (res.ok) {
               setImportFeedback(`Successfully imported ${newAdds} unique contacts. (${newlyParsed.length - newAdds} duplicates skipped).`);
               setBulkText('');
               fetchMasterContacts();
           } else {
               setImportFeedback('Failed to save to server.');
           }
        } catch (e: any) {
            setImportFeedback(e.message);
        }
    } else {
        setImportFeedback(`Skipped ${newlyParsed.length} contacts as they were duplicates.`);
    }

    setIsImporting(false);
  };

  const assignSelectedToGroup = async () => {
     if (selectedIds.size === 0) return;
     try {
       await fetch('/api/master-contacts/bulk-group', {
           method: 'PUT',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ contactIds: Array.from(selectedIds), groupId: targetGroupId || null })
       });
       if (targetGroupId) {
           // We also need to update the group's internal contact list ideally to keep in sync.
           // However the Group's internal list might need manual sync. 
       }
       setSelectedIds(new Set());
       fetchMasterContacts();
       fetchGroups();
     } catch(e) {
         alert("Failed to assign");
     }
  };

  const removeSelectedGroup = async () => {
    if (selectedIds.size === 0) return;
    try {
      await fetch('/api/master-contacts/bulk-group', {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ contactIds: Array.from(selectedIds), groupId: null })
      });
      setSelectedIds(new Set());
      fetchMasterContacts();
      fetchGroups();
    } catch(e) {
        alert("Failed to remove group");
    }
 };

 const deleteSelectedContacts = async () => {
    if (selectedIds.size === 0) return;
    try {
      await fetch('/api/master-contacts/bulk-delete', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ contactIds: Array.from(selectedIds) })
      });
      setSelectedIds(new Set());
      fetchMasterContacts();
      fetchGroups();
    } catch(e) {
        alert("Failed to delete contacts");
    }
 };

  // Select logic
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const filteredContacts = masterContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      
      {/* Upload Section */}
      <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neutral-900 border border-neutral-800 text-amber-500 rounded-lg shrink-0">
                <FileText className="h-5 w-5" />
            </div>
            <div>
                <h3 className="font-serif text-lg font-medium text-white">Master Data Import</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Paste CSV text (SR NO, FARM, REPRASENTATIVE, MOBILE) to auto-extract and clean names.</p>
            </div>
        </div>
        
        <textarea
            rows={4}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={`1, KIRANA VYAPAARI SANG, Shree JAGDEESH PD AGRAWAL, Agrawal, NAWDURGA, 9827003486`}
            className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-3 outline-none"
        />

        <div className="mt-3 flex items-center justify-between">
            <button
                type="button"
                onClick={handleBulkImport}
                disabled={isImporting || !bulkText.trim()}
                className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs px-4 py-2 rounded-lg"
            >
                {isImporting ? 'Parsing...' : 'Import to Master Data'}
            </button>
            {importFeedback && (
                <span className="text-xs text-emerald-400 font-mono">{importFeedback}</span>
            )}
        </div>
      </div>

      {/* Roster Section */}
      <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl shadow-sm p-5 space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div>
              <h4 className="font-serif text-white text-base">Master Data List ({masterContacts.length})</h4>
              <p className="text-xs text-neutral-400">Total Deduplicated Unique Contacts</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-550" />
            <input
                type="text"
                placeholder="Search master data..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs border border-neutral-850 rounded-lg pl-8 pr-3 py-2 bg-neutral-950 text-neutral-200 w-52"
            />
          </div>
        </div>

        {/* Selected actions */}
        {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-indigo-950/20 border border-indigo-900/50 rounded-lg">
                <span className="text-xs text-indigo-200 font-semibold">{selectedIds.size} Selected</span>
                <select 
                    className="text-xs bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none"
                    value={targetGroupId}
                    onChange={(e) => setTargetGroupId(e.target.value)}
                >
                    <option value="">-- Choose Group --</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <button 
                  onClick={assignSelectedToGroup}
                  disabled={!targetGroupId}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-3 py-1 rounded transition disabled:opacity-50 font-semibold uppercase tracking-wide"
                >
                  Assign to Group
                </button>
                <div className="w-px h-4 bg-neutral-700 mx-1"></div>
                <button 
                  onClick={removeSelectedGroup}
                  className="bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 text-[10px] px-3 py-1 rounded transition flex items-center gap-1 font-semibold uppercase tracking-wide"
                >
                  <Unlink className="h-3 w-3" /> Remove from Group
                </button>
                <button 
                  onClick={deleteSelectedContacts}
                  className="bg-rose-950/50 text-rose-400 hover:text-rose-300 hover:bg-rose-900 text-[10px] px-3 py-1 rounded transition flex items-center gap-1 font-semibold uppercase tracking-wide ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Delete Contacts
                </button>
            </div>
        )}

        <div className="border border-neutral-900 rounded-lg overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#050505] border-b border-neutral-900 sticky top-0 text-[10px] text-neutral-400 font-mono uppercase tracking-wider">
                    <tr>
                    <th className="py-2.5 px-4 w-10">
                        <input type="checkbox" checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0} onChange={selectAll} className="accent-amber-500" />
                    </th>
                    <th className="py-2.5 px-4">Contact Name</th>
                    <th className="py-2.5 px-4">Mobile No</th>
                    <th className="py-2.5 px-4">Assigned Group</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 flex-1 overflow-y-auto">
                    {loading ? (
                       <tr><td colSpan={4} className="py-10 text-center text-neutral-500">Loading...</td></tr> 
                    ) : filteredContacts.length === 0 ? (
                        <tr><td colSpan={4} className="py-10 text-center text-neutral-500">No master contacts available.</td></tr>
                    ) : (
                        filteredContacts.map(contact => {
                            const groupName = contact.groupId ? groups.find(g => g.id === contact.groupId)?.name || 'Unknown' : 'Unassigned';
                            return (
                                <tr key={contact.id} className="hover:bg-neutral-900/30 text-neutral-300">
                                    <td className="py-2.5 px-4">
                                        <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelection(contact.id)} className="accent-amber-500" />
                                    </td>
                                    <td className="py-2.5 px-4 font-medium">{contact.name}</td>
                                    <td className="py-2.5 px-4 font-mono">{contact.phone}</td>
                                    <td className="py-2.5 px-4">
                                        {contact.groupId ? (
                                            <span className="bg-indigo-900/30 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded text-[10px]">{groupName}</span>
                                        ) : (
                                            <span className="text-neutral-500 text-[10px] italic">Unassigned</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
}
