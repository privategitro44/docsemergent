import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, Save, X } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NavigationManager = ({ onLogout }) => {
  const [navigation, setNavigation] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    label: "",
    type: "article",
    target: "",
    parent_id: null,
    order: 0,
    icon: ""
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    Promise.all([fetchNavigation(), fetchArticles()]);
  }, []);

  const fetchNavigation = async () => {
    try {
      const response = await axios.get(`${API}/navigation`);
      setNavigation(response.data);
    } catch (error) {
      console.error("Error fetching navigation:", error);
    }
  };

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles`);
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const createNavigationItem = async () => {
    if (!newItem.label.trim()) {
      alert("Label is required");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.post(`${API}/admin/navigation`, newItem, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNavigation([...navigation, response.data]);
      setNewItem({
        label: "",
        type: "article",
        target: "",
        parent_id: null,
        order: 0,
        icon: ""
      });
      setShowAddForm(false);
      alert("Navigation item created successfully!");
    } catch (error) {
      console.error("Error creating navigation item:", error);
      alert("Failed to create navigation item. Please try again.");
    }
  };

  const updateNavigationItem = async (item) => {
    if (!item.label.trim()) {
      alert("Label is required");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const updateData = {
        label: item.label,
        type: item.type,
        target: item.target,
        parent_id: item.parent_id,
        order: item.order,
        icon: item.icon
      };

      const response = await axios.put(`${API}/admin/navigation/${item.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNavigation(navigation.map(nav => 
        nav.id === item.id ? response.data : nav
      ));
      setEditingItem(null);
      alert("Navigation item updated successfully!");
    } catch (error) {
      console.error("Error updating navigation item:", error);
      alert("Failed to update navigation item. Please try again.");
    }
  };

  const deleteNavigationItem = async (itemId, label) => {
    if (!window.confirm(`Are you sure you want to delete "${label}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`${API}/admin/navigation/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNavigation(navigation.filter(item => item.id !== itemId));
      alert("Navigation item deleted successfully!");
    } catch (error) {
      console.error("Error deleting navigation item:", error);
      alert("Failed to delete navigation item. Please try again.");
    }
  };

  const moveItem = async (itemId, direction) => {
    const currentItem = navigation.find(item => item.id === itemId);
    if (!currentItem) return;

    const siblings = navigation
      .filter(item => item.parent_id === currentItem.parent_id)
      .sort((a, b) => a.order - b.order);

    const currentIndex = siblings.findIndex(item => item.id === itemId);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= siblings.length) return;

    const swapItem = siblings[newIndex];
    
    try {
      const token = localStorage.getItem("adminToken");
      
      // Swap order values
      await Promise.all([
        axios.put(`${API}/admin/navigation/${currentItem.id}`, {
          ...currentItem,
          order: swapItem.order
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.put(`${API}/admin/navigation/${swapItem.id}`, {
          ...swapItem,
          order: currentItem.order
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Update local state
      setNavigation(navigation.map(item => {
        if (item.id === currentItem.id) {
          return { ...item, order: swapItem.order };
        }
        if (item.id === swapItem.id) {
          return { ...item, order: currentItem.order };
        }
        return item;
      }));
    } catch (error) {
      console.error("Error moving navigation item:", error);
      alert("Failed to move navigation item. Please try again.");
    }
  };

  const organizeNavigation = () => {
    const navMap = new Map();
    const rootItems = [];

    // First pass: create map of all items
    navigation.forEach(item => {
      navMap.set(item.id, { ...item, children: [] });
    });

    // Second pass: organize hierarchy
    navigation.forEach(item => {
      if (item.parent_id && navMap.has(item.parent_id)) {
        navMap.get(item.parent_id).children.push(navMap.get(item.id));
      } else {
        rootItems.push(navMap.get(item.id));
      }
    });

    // Sort by order
    const sortByOrder = (items) => {
      return items.sort((a, b) => a.order - b.order).map(item => ({
        ...item,
        children: sortByOrder(item.children)
      }));
    };

    return sortByOrder(rootItems);
  };

  const renderNavigationItem = (item, level = 0) => {
    const isEditing = editingItem?.id === item.id;
    const canMoveUp = level === 0 && navigation
      .filter(nav => nav.parent_id === item.parent_id)
      .sort((a, b) => a.order - b.order)[0]?.id !== item.id;
    
    const canMoveDown = level === 0 && navigation
      .filter(nav => nav.parent_id === item.parent_id)
      .sort((a, b) => a.order - b.order)
      .slice(-1)[0]?.id !== item.id;

    return (
      <div key={item.id} className="nav-item-wrapper" data-testid={`nav-item-${item.id}`}>
        <div className={`nav-item-row ${level > 0 ? 'child-item' : ''}`}>
          {isEditing ? (
            <div className="nav-edit-form">
              <input
                type="text"
                value={editingItem.label}
                onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                className="form-input"
                placeholder="Label"
                data-testid="edit-label"
              />
              
              <select
                value={editingItem.type}
                onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                className="form-select"
                data-testid="edit-type"
              >
                <option value="category">Category</option>
                <option value="article">Article</option>
                <option value="link">External Link</option>
              </select>
              
              {editingItem.type === "article" && (
                <select
                  value={editingItem.target}
                  onChange={(e) => setEditingItem({ ...editingItem, target: e.target.value })}
                  className="form-select"
                  data-testid="edit-target-article"
                >
                  <option value="">Select Article</option>
                  {articles.map(article => (
                    <option key={article.id} value={article.slug}>
                      {article.title}
                    </option>
                  ))}
                </select>
              )}
              
              {editingItem.type === "link" && (
                <input
                  type="url"
                  value={editingItem.target}
                  onChange={(e) => setEditingItem({ ...editingItem, target: e.target.value })}
                  className="form-input"
                  placeholder="https://..."
                  data-testid="edit-target-url"
                />
              )}
              
              <div className="edit-actions">
                <button
                  onClick={() => updateNavigationItem(editingItem)}
                  className="btn btn-success btn-sm"
                  data-testid="save-edit"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={() => setEditingItem(null)}
                  className="btn btn-secondary btn-sm"
                  data-testid="cancel-edit"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="nav-item-display">
              <div className="nav-item-info">
                <h4 className="nav-item-label">
                  {item.label}
                  <span className="nav-item-type">{item.type}</span>
                </h4>
                {item.target && (
                  <p className="nav-item-target">
                    Target: {item.type === "article" ? `/${item.target}` : item.target}
                  </p>
                )}
              </div>
              
              <div className="nav-item-actions">
                {canMoveUp && (
                  <button
                    onClick={() => moveItem(item.id, "up")}
                    className="action-btn"
                    title="Move Up"
                    data-testid={`move-up-${item.id}`}
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
                
                {canMoveDown && (
                  <button
                    onClick={() => moveItem(item.id, "down")}
                    className="action-btn"
                    title="Move Down"
                    data-testid={`move-down-${item.id}`}
                  >
                    <ArrowDown size={14} />
                  </button>
                )}
                
                <button
                  onClick={() => setEditingItem(item)}
                  className="action-btn edit"
                  title="Edit"
                  data-testid={`edit-${item.id}`}
                >
                  <Edit size={14} />
                </button>
                
                <button
                  onClick={() => deleteNavigationItem(item.id, item.label)}
                  className="action-btn delete"
                  title="Delete"
                  data-testid={`delete-${item.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {item.children && item.children.length > 0 && (
          <div className="nav-children">
            {item.children.map(child => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <AdminLayout onLogout={onLogout}>
        <div className="loading" data-testid="navigation-loading">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  const organizedNavigation = organizeNavigation();

  return (
    <AdminLayout onLogout={onLogout}>
      <div className="navigation-manager" data-testid="navigation-manager">
        <div className="manager-header">
          <div>
            <h1 className="manager-title">Navigation</h1>
            <p className="manager-subtitle">
              Manage your site navigation structure
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary"
            data-testid="add-navigation-btn"
          >
            <Plus size={16} />
            Add Navigation Item
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="nav-add-form" data-testid="add-form">
            <h3>Add Navigation Item</h3>
            
            <div className="form-grid">
              <input
                type="text"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                className="form-input"
                placeholder="Label"
                data-testid="new-label"
              />
              
              <select
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                className="form-select"
                data-testid="new-type"
              >
                <option value="category">Category</option>
                <option value="article">Article</option>
                <option value="link">External Link</option>
              </select>
            </div>
            
            {newItem.type === "article" && (
              <select
                value={newItem.target}
                onChange={(e) => setNewItem({ ...newItem, target: e.target.value })}
                className="form-input"
                data-testid="new-target-article"
              >
                <option value="">Select Article</option>
                {articles.map(article => (
                  <option key={article.id} value={article.slug}>
                    {article.title}
                  </option>
                ))}
              </select>
            )}
            
            {newItem.type === "link" && (
              <input
                type="url"
                value={newItem.target}
                onChange={(e) => setNewItem({ ...newItem, target: e.target.value })}
                className="form-input"
                placeholder="https://..."
                data-testid="new-target-url"
              />
            )}
            
            <div className="form-actions">
              <button
                onClick={createNavigationItem}
                className="btn btn-primary"
                data-testid="create-nav-item"
              >
                <Plus size={16} />
                Create Item
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewItem({
                    label: "",
                    type: "article",
                    target: "",
                    parent_id: null,
                    order: 0,
                    icon: ""
                  });
                }}
                className="btn btn-secondary"
                data-testid="cancel-add"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Navigation List */}
        <div className="nav-list" data-testid="navigation-list">
          {organizedNavigation.length > 0 ? (
            organizedNavigation.map(item => renderNavigationItem(item))
          ) : (
            <div className="empty-state" data-testid="empty-navigation">
              <div className="empty-icon">
                <Plus size={48} />
              </div>
              <h3>No navigation items</h3>
              <p>Create your first navigation item to get started.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn btn-primary"
              >
                <Plus size={16} />
                Add Navigation Item
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default NavigationManager;