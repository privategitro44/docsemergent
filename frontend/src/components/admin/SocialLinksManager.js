import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@hello-pangea/dnd";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@hello-pangea/dnd";
import { useSortable } from "@hello-pangea/dnd";
import { CSS } from "@hello-pangea/dnd";
import { Plus, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ICON_OPTIONS = [
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
  { value: "youtube", label: "YouTube" },
  { value: "discord", label: "Discord" },
  { value: "custom", label: "Custom" },
];

function GripHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h.01M8 10h.01M8 14h.01M8 18h.01M12 6h.01M12 10h.01M12 14h.01M12 18h.01" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`sl-toggle ${checked ? 'on' : ''}`}
      aria-pressed={checked}
    >
      <span className="sl-thumb" />
    </button>
  );
}

function SortableItem({ id, item, onChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [local, setLocal] = useState(item);

  useEffect(() => setLocal(item), [item]);

  // Debounced autosave for text fields
  useEffect(() => {
    const handle = setTimeout(() => {
      if (local.label !== item.label || local.url !== item.url || local.icon !== item.icon) {
        onChange({ ...item, label: local.label, url: local.url, icon: local.icon });
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [local.label, local.url, local.icon]);

  return (
    <div ref={setNodeRef} style={style} className={`sl-card ${isDragging ? 'dragging' : ''}`}> 
      <div className="sl-row">
        <div className="sl-grip" {...attributes} {...listeners} aria-label="Drag to reorder">
          <GripHandle />
        </div>
        <div className="sl-title">
          <input
            className="sl-label-input"
            value={local.label}
            onChange={(e) => setLocal({ ...local, label: e.target.value })}
            placeholder="Label"
          />
          <select
            className="sl-icon-select"
            value={local.icon}
            onChange={(e) => setLocal({ ...local, icon: e.target.value })}
          >
            {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <Switch checked={Boolean(local.enabled)} onChange={(v) => onChange({ ...item, enabled: v })} />
      </div>
      <div className="sl-row sl-url-row">
        <input
          className="sl-url-input"
          value={local.url}
          onChange={(e) => setLocal({ ...local, url: e.target.value })}
          placeholder={`${local.label || 'Social'} URL`}
        />
        <button className="sl-delete" title="Delete" onClick={() => onDelete(item)}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

const SocialLinksManager = ({ onLogout }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => { load(); }, []);

  const authHeader = useMemo(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  }), []);

  async function load() {
    try {
      const res = await axios.get(`${API}/admin/social-links`, authHeader);
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list.sort((a,b) => a.order - b.order));
    } catch (e) {
      console.error('Failed to load social links', e);
    } finally { setLoading(false); }
  }

  async function createNew() {
    const payload = { label: "New Link", icon: "custom", url: "", order: (items[items.length-1]?.order || 0) + 1 };
    try {
      const res = await axios.post(`${API}/admin/social-links`, payload, authHeader);
      setItems(prev => [...prev, res.data].sort((a,b) => a.order - b.order));
    } catch (e) { console.error('Create failed', e); }
  }

  async function saveRow(updated) {
    try {
      const payload = { label: updated.label, icon: updated.icon, url: updated.url, order: updated.order };
      await axios.put(`${API}/admin/social-links/${updated.id}`, payload, authHeader);
      setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
    } catch (e) { console.error('Save failed', e); }
  }

  async function onDelete(item) {
    if (!window.confirm(`Delete ${item.label}?`)) return;
    try {
      await axios.delete(`${API}/admin/social-links/${item.id}`, authHeader);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) { console.error('Delete failed', e); }
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({ ...it, order: idx + 1 }));
    setItems(newOrder);
    // Persist order changes sequentially (best-effort)
    for (const it of newOrder) {
      try {
        await axios.put(`${API}/admin/social-links/${it.id}`, { label: it.label, icon: it.icon, url: it.url, order: it.order }, authHeader);
      } catch (e) { console.error('Order save failed for', it.id, e); }
    }
  }

  return (
    <AdminLayout onLogout={onLogout}>
      <div className="social-links-manager" data-testid="social-links-manager">
        <div className="manager-header">
          <div>
            <h1 className="manager-title">Social Links</h1>
            <p className="manager-subtitle">Edit, reorder, toggle visibility. Changes reflect on the public site.</p>
          </div>
          <button className="btn btn-primary" onClick={createNew}><Plus size={16}/> Add Link</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"/></div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="sl-list">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    id={item.id}
                    item={item}
                    onChange={saveRow}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </AdminLayout>
  );
};

export default SocialLinksManager;
