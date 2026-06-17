import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Edit2, Plus, Search, FileJson, 
  Sparkles, Check, CheckCircle2, UserPlus, FileText, AlertCircle, Unlink, Save, Upload
} from 'lucide-react';
import { MasterContact, ContactGroup, Client } from '../types.js';
import * as XLSX from 'xlsx';

interface MasterDataTabProps {
  clients: Client[];
  groups: ContactGroup[];
  fetchGroups: () => void;
}

export default function MasterDataTab({ clients, groups, fetchGroups }: MasterDataTabProps) {
  const [activeClientId, setActiveClientId] = useState<string>(clients[0]?.id || 'client-1');
  const [masterContacts, setMasterContacts] = useState<MasterContact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [parsedExcelData, setParsedExcelData] = useState<any[]>([]);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  
  // Import Direct Group Assignment
  const [targetImportGroupId, setTargetImportGroupId] = useState<string>('');
  
  // Quick Group Assignment
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFeedback("Parsing file...");
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        try {
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            let extractedText = '';
            
            data.forEach((row: any) => {
               const keys = Object.keys(row);
               
               let mobileCol = keys.find(k => k.trim() === 'Mobile' || k.trim() === 'Mobile No.');
               if (!mobileCol) {
                   mobileCol = keys.find(k => k.toLowerCase().includes('mobile') || k.toLowerCase().includes('phone'));
               }
               
               let nameCol = keys.find(k => k.trim() === 'Representative');
               if (!nameCol) nameCol = keys.find(k => k.trim() === 'Name' || k.trim() === 'English Name');
               if (!nameCol) nameCol = keys.find(k => k.toLowerCase().includes('representative') && !k.includes('प्रतिनिधि'));
               if (!nameCol) nameCol = keys.find(k => k.toLowerCase().includes('name') && !k.includes('नाम'));
               if (!nameCol) nameCol = keys.find(k => k.toLowerCase().includes('representative') || k.toLowerCase().includes('name'));
               
               let phoneStr = mobileCol ? String(row[mobileCol]) : '';
               let cleanNum = phoneStr.replace(/\D/g, '');
               
               let nameStr = nameCol ? row[nameCol] : undefined;
               
               // Fallback: search values if standard detection failed
               if (!(cleanNum.length >= 10 && cleanNum.length <= 15)) {
                   const vals = Object.values(row);
                   for (const v of vals) {
                       const cNum = String(v).replace(/\D/g, '');
                       if (cNum.length >= 10 && cNum.length <= 15) {
                           cleanNum = cNum;
                           break;
                       }
                   }
               }
               
               if (!nameStr) {
                  // Fallback: try to find an English-looking string
                  const vals = Object.values(row).filter(v => typeof v === 'string');
                  
                  // Filter out unwanted values and clean up newlines (like 'Mr. Rajaldas Advani\nDate of Birth')
                  const validVals = vals.map(v => (v as string).split('\n')[0].trim()).filter(s => {
                      const lower = s.toLowerCase();
                      return s.length > 3 && 
                             !s.includes('#NAME?') && 
                             !lower.includes('association') && 
                             !lower.includes('assoc') && 
                             !lower.includes('market') &&
                             !lower.includes('satna') &&
                             !lower.includes('vcci') &&
                             !lower.includes('mandal') &&
                             !lower.includes('trader') &&
                             !lower.includes('director') &&
                             !lower.includes('institution') &&
                             !lower.includes('industrial') &&
                             !lower.includes('institutions') &&
                             !lower.includes('chowk') &&
                             !lower.includes('colony') &&
                             !lower.includes('nagar') &&
                             !lower.includes('district') &&
                             !lower.includes('road') &&
                             !lower.includes('area') &&
                             !lower.includes('seller') &&
                             !lower.includes('distributor');
                  });
                  
                  // Primary check: Only letters, spaces, dots
                  let bestName = validVals.find(s => s.match(/^[a-zA-Z\s\.]+$/));
                  
                  // Secondary check: Catch entries like "Shri name" that might have slipped, but strictly avoid Hindi
                  if (!bestName) {
                      bestName = validVals.find(s => !s.match(/[\u0900-\u097F]/) && (s.toLowerCase().includes('mr.') || s.toLowerCase().includes('shri')));
                  }
                  
                  if (!bestName) {
                      // Just avoid Hindi
                      bestName = validVals.find(s => !s.match(/[\u0900-\u097F]/));
                  }
                  
                  if (bestName) nameStr = bestName;
               }
               
               if (cleanNum.length >= 10 && cleanNum.length <= 15) {
                    if (nameStr && typeof nameStr === 'string') {
                        nameStr = nameStr.split('\n')[0].replace(/,/g, '').trim();
                    }
                    nameStr = nameStr || 'Customer';
                    extractedText += `${nameStr}, ${cleanNum}\n`;
               }
            });
            
            if (extractedText.trim()) {
                setBulkText(extractedText);
                setParsedExcelData(data);
                setImportFeedback(`Parsed ${data.length} rows from ${file.name}. Review below and click Import.`);
            } else {
               setImportFeedback(`No data found in ${file.name}.`);
            }
        } catch (err) {
            setImportFeedback(`Failed to parse file: ${(err as Error).message}`);
        }
    };
    reader.onerror = () => {
        setImportFeedback("Error reading file.");
    };
    reader.readAsBinaryString(file);
    // Reset file input
    e.target.value = '';
  };

  const cleanNamePrefixes = (name: string) => {
    // English variations
    let clean = name.replace(/^(Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s*/i, '');
    clean = clean.trim();
    
    // Extact only first name and second name
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 2) {
      clean = words.slice(0, 2).join(' ');
    } else {
      clean = words.join(' ');
    }
    
    // Just capitalize first letter of each word
    clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    return clean;
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim() && parsedExcelData.length === 0) return;
    setIsImporting(true);
    setImportFeedback(null);

    const newlyParsed: any[] = [];

    const lines = bulkText.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cells = line.split(',');
        if (cells.length >= 2) {
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
                let nameStr = cells.length > 2 ? cells[2] : cells[0];
                
                if (nameStr.replace(/\D/g, '').length === nameStr.length || nameStr.length < 2) {
                    nameStr = cells[0]; 
                }

                // If name looks like customer name and we have only 2 columns, choose the non-phone column
                if (cells.length === 2 && phoneColIndex === 0) {
                    nameStr = cells[1];
                }

                nameStr = cleanNamePrefixes(nameStr || 'Customer');
                let countryCode = '91';
                let phone = phoneStr;
                if (phone.length === 12 && phone.startsWith('91')) {
                   phone = phone.substring(2);
                }

                let rawData: any = undefined;
                if (parsedExcelData.length > 0) {
                    rawData = parsedExcelData.find((r: any) => {
                        const vals = Object.values(r).map(v => String(v).replace(/\D/g, ''));
                        return vals.some(v => v.includes(phone));
                    });
                }

                newlyParsed.push({
                    name: nameStr || 'Customer',
                    phone: phone,
                    countryCode,
                    groupAssignments: targetImportGroupId ? { [activeClientId]: targetImportGroupId } : undefined,
                    rawData
                });
            }
        }
    }

    if (newlyParsed.length === 0 && parsedExcelData.length > 0) {
        setImportFeedback("No text was present in the textarea, or it could not be parsed. Click 'Import' again to force import raw excel data if it wasn't extracted.");
        // We could implement direct fallback here, but it's safer to have user see the text.
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
    const duplicatesToBind: string[] = [];

    newlyParsed.forEach(p => {
        if (!uniqueMap.has(p.phone)) {
            uniqueMap.set(p.phone, p);
            toSave.push(p);
            newAdds++;
        } else if (targetImportGroupId) {
            const existing = uniqueMap.get(p.phone);
            if (!existing.groupAssignments || existing.groupAssignments[activeClientId] !== targetImportGroupId) {
                duplicatesToBind.push(existing.id);
            }
        }
    });

    try {
        let feedback = '';
        if (toSave.length > 0) {
            const res = await fetch('/api/master-contacts/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ contacts: toSave })
            });
            if (!res.ok) throw new Error('Failed to save to server.');
            feedback += `Imported ${newAdds} new contacts. `;
        }
        
        if (duplicatesToBind.length > 0) {
            const bindRes = await fetch('/api/master-contacts/bulk-group', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ contactIds: duplicatesToBind, clientId: activeClientId, groupId: targetImportGroupId })
            });
            if (!bindRes.ok) throw new Error('Failed to bind existing contacts.');
            feedback += `Updated ${duplicatesToBind.length} existing contacts. `;
        }
        
        if (toSave.length === 0 && duplicatesToBind.length === 0) {
            feedback = `Skipped ${newlyParsed.length} contacts as they were exact duplicates already in this group.`;
        }

        setImportFeedback(feedback);
        setBulkText('');
        setParsedExcelData([]);
        fetchMasterContacts();
    } catch (e: any) {
        setImportFeedback(e.message);
    }

    setIsImporting(false);
  };

  const assignSelectedToGroup = async () => {
     if (selectedIds.size === 0) return;
     try {
       await fetch('/api/master-contacts/bulk-group', {
           method: 'PUT',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ contactIds: Array.from(selectedIds), clientId: activeClientId, groupId: targetGroupId || null })
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
          body: JSON.stringify({ contactIds: Array.from(selectedIds), clientId: activeClientId, groupId: null })
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
  const toggleSelection = (e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>, id: string) => {
    const shiftKey = (e.nativeEvent as MouseEvent).shiftKey;
    const newSet = new Set(selectedIds);
    
    if (shiftKey && lastSelectedId) {
      // Find range
      const visibleIds = filteredContacts.map(c => c.id);
      const lastIndex = visibleIds.indexOf(lastSelectedId);
      const currentIndex = visibleIds.indexOf(id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        // Ensure action matches the shift-click anchor
        const isAdding = selectedIds.has(lastSelectedId);
        
        for (let i = start; i <= end; i++) {
          if (isAdding) {
            newSet.add(visibleIds[i]);
          } else {
            newSet.delete(visibleIds[i]);
          }
        }
      } else {
        // Fallback if one isn't found
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
      }
    } else {
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
    }
    
    setLastSelectedId(id);
    setSelectedIds(newSet);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedIds);
    let allCurrentlySelected = true;
    for (const c of filteredContacts) {
      if (!newSet.has(c.id)) {
        allCurrentlySelected = false;
        break;
      }
    }

    if (allCurrentlySelected) {
      // Deselect all filtered
      filteredContacts.forEach(c => newSet.delete(c.id));
    } else {
      // Select all filtered
      filteredContacts.forEach(c => newSet.add(c.id));
    }
    setSelectedIds(newSet);
  };

  const selectAllUnassigned = () => {
    const newSet = new Set(selectedIds);
    masterContacts.forEach(c => {
      // If it doesn't have a group for activeClient, select it
      if (!c.groupAssignments || !c.groupAssignments[activeClientId]) newSet.add(c.id);
    });
    setSelectedIds(newSet);
  };

  const addNextUnassigned = (count: number) => {
    const newSet = new Set(selectedIds);
    const unassigned = filteredContacts.filter(c => !c.groupAssignments || !c.groupAssignments[activeClientId]);
    let added = 0;
    for (const c of unassigned) {
      if (!newSet.has(c.id)) {
        newSet.add(c.id);
        added++;
      }
      if (added >= count) break;
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  const filteredContacts = masterContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">

      {/* Client Selector Bar */}
      <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-400 uppercase font-mono tracking-wider font-semibold">Active Client Workspace</label>
          <select 
            value={activeClientId}
            onChange={e => setActiveClientId(e.target.value)}
            className="bg-neutral-950 border border-neutral-850 text-amber-500 rounded-lg px-3 py-1.5 text-sm font-bold outline-none cursor-pointer focus:border-amber-500/50"
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Upload Section */}
      <div className="bg-[#0c0c0c] border border-neutral-900 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-amber-500 rounded-lg shrink-0">
                    <FileText className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-medium text-white">Master Data Import</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Paste CSV text (SR NO, FARM, REPRASENTATIVE, MOBILE) or upload a file to auto-extract contacts.</p>
                </div>
            </div>
            
            <div className="relative">
                <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Upload CSV or Excel file"
                />
                <button
                    type="button"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-4 py-2 rounded-lg flex items-center gap-2 border border-neutral-700 transition"
                >
                    <Upload className="h-4 w-4" />
                    Upload File
                </button>
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-3">
            <div className="flex-1">
                <textarea
                    rows={4}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={`1, KIRANA VYAPAARI SANG, Shree JAGDEESH PD AGRAWAL, Agrawal, NAWDURGA, 9827003486`}
                    className="w-full text-xs font-mono border border-neutral-850 bg-neutral-950 text-neutral-200 rounded-lg p-3 outline-none focus:border-amber-500/50"
                />
            </div>
            
            <div className="w-full sm:w-64 bg-neutral-955 border border-neutral-900 rounded-lg p-3 space-y-2">
                <label className="text-[10px] text-neutral-450 uppercase tracking-widest font-semibold font-mono block">Target Group Auto-Assign</label>
                <select 
                    className="w-full text-xs bg-[#0c0c0c] border border-neutral-850 rounded-lg pl-3 pr-3 py-2 text-white outline-none focus:ring-1 focus:ring-amber-500/50"
                    value={targetImportGroupId}
                    onChange={(e) => setTargetImportGroupId(e.target.value)}
                >
                    <option value="">-- No Direct Group (Default) --</option>
                    {groups.filter(g => g.clientId === activeClientId).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <p className="text-[10px] text-neutral-500 leading-snug">If selected, imported contacts will be automatically bound to this segment.</p>
            </div>
        </div>

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
                className="text-xs border border-neutral-850 rounded-lg pl-8 pr-3 py-2 bg-neutral-950 text-neutral-200 w-52 w-full"
            />
          </div>
        </div>

        {/* Quick Selection Actions */}
        <div className="flex flex-wrap items-center gap-2">
           <button 
             onClick={selectAllFiltered}
             className="text-[10px] uppercase font-mono font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded transition border border-neutral-800 cursor-pointer"
           >
             {selectedIds.size > 0 && selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect Checked' : `Select All Visible (${filteredContacts.length})`}
           </button>
           <button 
             onClick={selectAllUnassigned}
             className="text-[10px] uppercase font-mono font-bold bg-neutral-900 hover:bg-neutral-800 text-amber-500/90 px-3 py-1.5 rounded transition border border-neutral-800 cursor-pointer"
           >
             Select Unassigned Only
           </button>
           <div className="flex border border-neutral-800 rounded bg-neutral-900">
             <button 
               onClick={() => addNextUnassigned(100)}
               className="text-[10px] uppercase font-mono font-bold text-amber-400/80 hover:text-amber-400 hover:bg-neutral-800 px-3 py-1.5 transition cursor-pointer"
             >
               +100
             </button>
             <button 
               onClick={() => addNextUnassigned(200)}
               className="text-[10px] uppercase font-mono font-bold text-amber-400/80 hover:text-amber-400 hover:bg-neutral-800 px-3 py-1.5 transition border-l border-neutral-800 cursor-pointer"
             >
               +200
             </button>
             <button 
               onClick={() => addNextUnassigned(300)}
               className="text-[10px] uppercase font-mono font-bold text-amber-400/80 hover:text-amber-400 hover:bg-neutral-800 px-3 py-1.5 transition border-l border-neutral-800 cursor-pointer"
             >
               +300
             </button>
           </div>
           {selectedIds.size > 0 && (
             <button 
               onClick={clearSelection}
               className="text-[10px] uppercase font-mono font-bold bg-neutral-900 hover:bg-neutral-800 text-rose-400 px-3 py-1.5 rounded transition border border-neutral-800 ml-auto cursor-pointer"
             >
               Clear Selection ({selectedIds.size})
             </button>
           )}
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
                    {groups.filter(g => g.clientId === activeClientId).map(g => (
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
                <thead className="bg-[#050505] border-b border-neutral-900 sticky top-0 text-[10px] text-neutral-400 font-mono uppercase tracking-wider z-10">
                    <tr>
                    <th className="py-2.5 px-4 w-10">
                        <input type="checkbox" checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0} onChange={selectAllFiltered} className="accent-amber-500" />
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
                            const currentGroupId = contact.groupAssignments ? contact.groupAssignments[activeClientId] : undefined;
                            const groupName = currentGroupId ? groups.find(g => g.id === currentGroupId)?.name || 'Unknown' : 'Unassigned';
                            return (
                                <tr key={contact.id} className="hover:bg-neutral-900/30 text-neutral-300">
                                    <td className="py-2.5 px-4">
                                        <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={(e) => toggleSelection(e, contact.id)} className="accent-amber-500" />
                                    </td>
                                    <td className="py-2.5 px-4 font-medium">{contact.name}</td>
                                    <td className="py-2.5 px-4 font-mono">{contact.phone}</td>
                                    <td className="py-2.5 px-4">
                                        {currentGroupId ? (
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
