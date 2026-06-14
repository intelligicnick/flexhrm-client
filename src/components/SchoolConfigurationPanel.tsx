import React, { useMemo, useState } from "react";
import {
  Check,
  Edit2,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { SchoolBlock, SchoolDistrict } from "../types";

interface SchoolConfigurationPanelProps {
  districts: SchoolDistrict[];
  blocks: SchoolBlock[];
  isLoading?: boolean;
  readOnly?: boolean;
  onAddDistrict: (name: string) => Promise<boolean>;
  onUpdateDistrict: (id: string, name: string) => Promise<boolean>;
  onDeleteDistricts: (ids: string[]) => Promise<boolean>;
  onAddBlock: (name: string, districtId: string) => Promise<boolean>;
  onUpdateBlock: (id: string, patch: { name?: string; districtId?: string }) => Promise<boolean>;
  onDeleteBlocks: (ids: string[]) => Promise<boolean>;
}

export default function SchoolConfigurationPanel({
  districts,
  blocks,
  isLoading = false,
  readOnly = false,
  onAddDistrict,
  onUpdateDistrict,
  onDeleteDistricts,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlocks,
}: SchoolConfigurationPanelProps) {
  const [districtSearch, setDistrictSearch] = useState("");
  const [blockSearch, setBlockSearch] = useState("");
  const [newDistrictName, setNewDistrictName] = useState("");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockDistrictId, setNewBlockDistrictId] = useState("");
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [editingDistrictId, setEditingDistrictId] = useState<string | null>(null);
  const [editingDistrictName, setEditingDistrictName] = useState("");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");
  const [editingBlockDistrictId, setEditingBlockDistrictId] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredDistricts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter((d) => d.name.toLowerCase().includes(q));
  }, [districts, districtSearch]);

  const filteredBlocks = useMemo(() => {
    const q = blockSearch.trim().toLowerCase();
    let result = blocks;
    if (q) {
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.districtName.toLowerCase().includes(q),
      );
    }
    return result.sort((a, b) =>
      `${a.districtName} ${a.name}`.localeCompare(`${b.districtName} ${b.name}`),
    );
  }, [blocks, blockSearch]);

  const blocksByDistrict = useMemo(() => {
    const map = new Map<string, number>();
    blocks.forEach((b) => map.set(b.districtId, (map.get(b.districtId) || 0) + 1));
    return map;
  }, [blocks]);

  const handleAddDistrict = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || !newDistrictName.trim()) return;
    setSaving(true);
    const ok = await onAddDistrict(newDistrictName.trim());
    setSaving(false);
    if (ok) setNewDistrictName("");
  };

  const handleAddBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || !newBlockName.trim() || !newBlockDistrictId) return;
    setSaving(true);
    const ok = await onAddBlock(newBlockName.trim(), newBlockDistrictId);
    setSaving(false);
    if (ok) setNewBlockName("");
  };

  const saveDistrictEdit = async () => {
    if (!editingDistrictId || !editingDistrictName.trim()) return;
    setSaving(true);
    const ok = await onUpdateDistrict(editingDistrictId, editingDistrictName.trim());
    setSaving(false);
    if (ok) {
      setEditingDistrictId(null);
      setEditingDistrictName("");
    }
  };

  const saveBlockEdit = async () => {
    if (!editingBlockId || !editingBlockName.trim() || !editingBlockDistrictId) return;
    setSaving(true);
    const ok = await onUpdateBlock(editingBlockId, {
      name: editingBlockName.trim(),
      districtId: editingBlockDistrictId,
    });
    setSaving(false);
    if (ok) {
      setEditingBlockId(null);
      setEditingBlockName("");
      setEditingBlockDistrictId("");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-orange-600/70">Districts</p>
          <p className="text-2xl font-black text-orange-700 mt-0.5">{districts.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-600/70">Blocks</p>
          <p className="text-2xl font-black text-blue-700 mt-0.5">{blocks.length}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
              <MapPin size={18} className="text-[#ff791a]" />
              Districts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Add districts first, then add blocks under each district</p>
          </div>

          {!readOnly && (
            <form onSubmit={handleAddDistrict} className="px-5 py-4 border-b border-slate-100 flex gap-2">
              <input
                type="text"
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                placeholder="New district name..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={saving || !newDistrictName.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Plus size={14} /> Add
              </button>
            </form>
          )}

          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                placeholder="Search districts..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filteredDistricts.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">No districts configured yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {filteredDistricts.map((district) => {
                const isEditing = editingDistrictId === district.id;
                const isSelected = selectedDistrictIds.includes(district.id);
                return (
                  <div
                    key={district.id}
                    className={`px-5 py-3 flex items-center gap-3 ${isSelected ? "bg-orange-50/60" : "hover:bg-slate-50/80"}`}
                  >
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedDistrictIds((prev) =>
                            prev.includes(district.id)
                              ? prev.filter((id) => id !== district.id)
                              : [...prev, district.id],
                          )
                        }
                        className="rounded border-slate-300 text-orange-600 cursor-pointer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          value={editingDistrictName}
                          onChange={(e) => setEditingDistrictName(e.target.value)}
                          className="w-full px-2 py-1 border border-orange-300 rounded text-xs"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-800 truncate">{district.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {blocksByDistrict.get(district.id) || 0} block(s)
                          </p>
                        </>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveDistrictEdit}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDistrictId(null)}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDistrictId(district.id);
                                setEditingDistrictName(district.name);
                              }}
                              className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded cursor-pointer"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                const ok = await onDeleteDistricts([district.id]);
                                setSaving(false);
                                if (ok) {
                                  setSelectedDistrictIds((prev) => prev.filter((id) => id !== district.id));
                                  if (editingDistrictId === district.id) {
                                    setEditingDistrictId(null);
                                    setEditingDistrictName("");
                                  }
                                }
                              }}
                              disabled={saving}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer disabled:opacity-50"
                              title={`Delete "${district.name}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly && selectedDistrictIds.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  const ok = await onDeleteDistricts(selectedDistrictIds);
                  setSaving(false);
                  if (ok) setSelectedDistrictIds([]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Trash2 size={14} /> Delete ({selectedDistrictIds.length})
              </button>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-blue-600" />
              Blocks
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Blocks belong to a district and are used for expense splitting</p>
          </div>

          {!readOnly && (
            <form onSubmit={handleAddBlock} className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={newBlockDistrictId}
                onChange={(e) => setNewBlockDistrictId(e.target.value)}
                required
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer focus:outline-none focus:border-blue-500"
              >
                <option value="">Select district</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="Block name..."
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={saving || !newBlockName.trim() || !newBlockDistrictId}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Plus size={14} /> Add Block
              </button>
            </form>
          )}

          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
                placeholder="Search blocks or districts..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filteredBlocks.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">No blocks configured yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {filteredBlocks.map((block) => {
                const isEditing = editingBlockId === block.id;
                const isSelected = selectedBlockIds.includes(block.id);
                return (
                  <div
                    key={block.id}
                    className={`px-5 py-3 flex items-center gap-3 ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"}`}
                  >
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedBlockIds((prev) =>
                            prev.includes(block.id)
                              ? prev.filter((id) => id !== block.id)
                              : [...prev, block.id],
                          )
                        }
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={editingBlockDistrictId}
                            onChange={(e) => setEditingBlockDistrictId(e.target.value)}
                            className="px-2 py-1 border border-blue-300 rounded text-xs cursor-pointer"
                          >
                            {districts.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <input
                            value={editingBlockName}
                            onChange={(e) => setEditingBlockName(e.target.value)}
                            className="px-2 py-1 border border-blue-300 rounded text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-800 truncate">{block.name}</p>
                          <p className="text-[10px] text-slate-400">{block.districtName}</p>
                        </>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveBlockEdit}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBlockId(null)}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBlockId(block.id);
                                setEditingBlockName(block.name);
                                setEditingBlockDistrictId(block.districtId);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                const ok = await onDeleteBlocks([block.id]);
                                setSaving(false);
                                if (ok) {
                                  setSelectedBlockIds((prev) => prev.filter((id) => id !== block.id));
                                  if (editingBlockId === block.id) {
                                    setEditingBlockId(null);
                                    setEditingBlockName("");
                                    setEditingBlockDistrictId("");
                                  }
                                }
                              }}
                              disabled={saving}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer disabled:opacity-50"
                              title={`Delete "${block.name}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly && selectedBlockIds.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  const ok = await onDeleteBlocks(selectedBlockIds);
                  setSaving(false);
                  if (ok) setSelectedBlockIds([]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Trash2 size={14} /> Delete ({selectedBlockIds.length})
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
