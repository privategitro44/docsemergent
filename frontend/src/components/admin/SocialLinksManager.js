import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, Pencil, Link as LinkIcon } from "lucide-react";

// Inline brand icons to avoid version issues with 3rd-party icon sets
const BrandIcon = ({ name }) => {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  if (name === 'x') {
    return (
      <svg {...common}><path d="M18.146 2H21l-6.5 7.43L22.5 22H15l-4.74-6.2L4.5 22H2.5l7-7.99L2 2h7l4.3 5.64L18.146 2Zm-2.29 18h2.01L8.24 4h-2L15.856 20Z"/></svg>
    );
  }
  if (name === 'linkedin') {
    return (
      <svg {...common}><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07c.67-1.26 2.3-2.6 4.73-2.6 5.06 0 6 3.33 6 7.66V24h-5v-7.05c0-1.68-.03-3.84-2.34-3.84-2.34 0-2.7 1.83-2.7 3.72V24h-5V8z"/></svg>
    );
  }
  if (name === 'github') {
    return (
      <svg {...common}><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.61-3.37-1.37-3.37-1.37-.46-1.2-1.13-1.52-1.13-1.52-.93-.66.07-.65.07-.65 1.03.07 1.58 1.08 1.58 1.08.91 1.6 2.39 1.14 2.97.87.09-.68.36-1.14.65-1.4-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 7.1c.85 0 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.56 1.4.21 2.44.11 2.7.64.72 1.02 1.63 1.02 2.75 0 3.94-2.34 4.8-4.57 5.06.37.32.7.95.7 1.92 0 1.39-.01 2.51-.01 2.85 0 .26.18.58.69.48A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/></svg>
    );
  }
  if (name === 'youtube') {
    return (
      <svg {...common}><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.2 0 12 0 12s0 3.8.5 5.8a3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-2 .5-5.8.5-5.8s0-3.8-.5-5.8ZM9.6 15.5v-7l6.2 3.5-6.2 3.5Z"/></svg>
    );
  }
  if (name === 'discord') {
    return (
      <svg {...common}><path d="M20.32 4.37A19.74 19.74 0 0 0 15.86 3l-.22.45c1.34.32 2.57.82 3.7 1.47-1.56-.72-3.28-1.24-5.07-1.5a18.7 18.7 0 0 0-4.54 0C7.93 3.67 6.2 4.2 4.65 4.92 5.78 4.27 7 3.77 8.34 3.45L8.12 3a19.74 19.74 0 0 0-4.46 1.37C1.4 7.07.5 10.02.5 13.05c0 0 2.03 3.5 7.39 3.68-.9.62-1.86 1.45-1.86 1.45 1.6.12 3.16-.5 4.27-1.25.34.03.68.04 1.02.04s.68-.01 1.02-.04c1.11.75 2.67 1.37 4.27 1.25 0 0-.98-.85-1.87-1.47 5.37-.18 7.39-3.68 7.39-3.68 0-3.03-.9-5.98-2.8-8.68ZM9.25 12.9c-.8 0-1.45-.74-1.45-1.64s.65-1.64 1.45-1.64 1.45.74 1.45 1.64-.65 1.64-1.45 1.64Zm5.5 0c-.8 0-1.45-.74-1.45-1.64s.65-1.64 1.45-1.64 1.45.74 1.45 1.64-.65 1.64-1.45 1.64Z"/></svg>
    );
  }
  return <LinkIcon size={16} />;
};

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 6h.01M11 6h.01M7 10h.01M11 10h.01M7 14h.01M11 14h.01M7 18h.01M11 18h.01" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
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

function RowCard({ item, onChange, onDelete, dragHandleProps, draggableProps, innerRef }) {
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item]);

  // Debounced autosave for label/url/icon
  useEffect(() => {
    const handle = setTimeout(() => {
      if (local.label !== item.label || local.url !== item.url || local.icon !== item.icon) {
        onChange({ ...item, label: local.label, url: local.url, icon: local.icon });
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [local.label, local.url, local.icon]);

  return (
    <div ref={innerRef} {...draggableProps} className="sl-card">
      <div className="sl-row">
        <div className="sl-grip" {...dragHandleProps} aria-label="Drag to reorder">
          <GripHandle />
        </div>
        <div className="sl-title">
          <div className="sl-title-left">
            <div className={`sl-brand-icon ${local.icon}`} aria-hidden>
              {local.icon === 'youtube' ? <SafeIcon Comp={Youtube} size={16}/> : local.icon === 'github' ? <SafeIcon Comp={Github} size={16}/> : local.icon === 'linkedin' ? <SafeIcon Comp={Linkedin} size={16}/> : local.icon === 'discord' ? <SafeIcon Comp={Discord} size={16}/> : <LinkIcon size={16}/>}
            </div>
            <input
              className="sl-label-input"
              value={local.label}
              onChange={(e) => setLocal({ ...local, label: e.target.value })}
              placeholder="Label"
            />
            <button className="sl-inline-edit" title="Edit label">
              <Pencil size={14} />
            </button>
          </div>
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
      <div className="sl-meta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h18" stroke="#9ca3af" strokeWidth="2"/></svg>
        <span>0 clicks</span>
      </div>
    </div>
  );
}

const SocialLinksManager = ({ onLogout }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const payload = { label: "New Link", icon: "custom", url: "", order: (items[items.length-1]?.order || 0) + 1, enabled: true };
    try {
      const res = await axios.post(`${API}/admin/social-links`, payload, authHeader);
      setItems(prev => [...prev, res.data].sort((a,b) => a.order - b.order));
    } catch (e) { console.error('Create failed', e); }
  }

  async function saveRow(updated) {
    try {
      const payload = { label: updated.label, icon: updated.icon, url: updated.url, order: updated.order, enabled: updated.enabled };
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

  async function onDragEnd(result) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;
    const newItems = Array.from(items);
    const [moved] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, moved);
    const withOrder = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    setItems(withOrder);
    for (const it of withOrder) {
      try {
        const payload = { label: it.label, icon: it.icon, url: it.url, order: it.order, enabled: it.enabled };
        await axios.put(`${API}/admin/social-links/${it.id}`, payload, authHeader);
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
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="social-list">
              {(provided) => (
                <div className="sl-list" ref={provided.innerRef} {...provided.droppableProps}>
                  {items.map((item, idx) => (
                    <Draggable key={item.id} draggableId={item.id} index={idx}>
                      {(dragProvided) => (
                        <RowCard
                          item={item}
                          onChange={saveRow}
                          onDelete={onDelete}
                          dragHandleProps={dragProvided.dragHandleProps}
                          draggableProps={dragProvided.draggableProps}
                          innerRef={dragProvided.innerRef}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </AdminLayout>
  );
};

export default SocialLinksManager;
