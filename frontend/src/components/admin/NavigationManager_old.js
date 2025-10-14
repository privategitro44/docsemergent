import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, GripVertical, ExternalLink, FileText } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API } from "../../config";

const NavigationManager = ({ onLogout }) => {
  const [navigation, setNavigation] = useState([]);
  const [articles, setArticles] = useState([]);
  const [newItem, setNewItem] = useState({
    label: "",
    type: "category",
    url: "",
    articleId: "",
    order: 0,
    parent: null,
  });

  useEffect(() => {
    fetchNavigation();
    fetchArticles();
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
    }
  };

  const authHeader = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    },
  };

  const handleAdd = async () => {
    try {
      const response = await axios.post(`${API}/admin/navigation`, newItem, authHeader);
      setNavigation([...navigation, response.data]);
      setNewItem({
        label: "",
        type: "category",
        url: "",
        articleId: "",
        order: navigation.length,
        parent: null,
      });
    } catch (error) {
      console.error("Error adding navigation item:", error);
      if (error.response?.status === 401) {
        onLogout();
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/admin/navigation/${id}`, authHeader);
      setNavigation(navigation.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting navigation item:", error);
      if (error.response?.status === 401) {
        onLogout();
      }
    }
  };

  const handleReorder = async (result) => {
    if (!result.destination) return;

    const items = Array.from(navigation);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    setNavigation(updatedItems);

    try {
      await axios.put(`${API}/admin/navigation/reorder`, { items: updatedItems }, authHeader);
    } catch (error) {
      console.error("Error reordering navigation:", error);
      if (error.response?.status === 401) {
        onLogout();
      }
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Navigation Management</h1>
      </div>

      <div className="admin-content">
        <div className="form-group">
          <h3>Add New Navigation Item</h3>
          <div className="form-row">
            <input
              type="text"
              placeholder="Label"
              value={newItem.label}
              onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
              className="form-input"
            />
            <select
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
              className="form-input"
            >
              <option value="category">Category</option>
              <option value="link">Link</option>
              <option value="article">Article</option>
            </select>
          </div>

          {newItem.type === "link" && (
            <input
              type="text"
              placeholder="https://..."
              value={newItem.url}
              onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
              className="form-input"
            />
          )}

          {newItem.type === "article" && (
            <select
              value={newItem.articleId}
              onChange={(e) => setNewItem({ ...newItem, articleId: e.target.value })}
              className="form-input"
            >
              <option value="">Select Article</option>
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
          )}

          <button onClick={handleAdd} className="btn btn-primary">
            <Plus size={16} />
            Add Item
          </button>
        </div>

        <div className="navigation-list">
          <h3>Current Navigation</h3>
          <DragDropContext onDragEnd={handleReorder}>
            <Droppable droppableId="navigation">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {navigation.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="navigation-item"
                        >
                          <div {...provided.dragHandleProps} className="drag-handle">
                            <GripVertical size={20} />
                          </div>
                          <div className="item-content">
                            <div className="item-label">
                              {item.type === "link" && <ExternalLink size={16} />}
                              {item.type === "article" && <FileText size={16} />}
                              <span>{item.label}</span>
                            </div>
                            <span className="item-type">{item.type}</span>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn-icon btn-danger"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
};

export default NavigationManager;