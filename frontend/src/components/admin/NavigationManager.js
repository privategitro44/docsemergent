import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API } from "../../config";

const NavigationManager = ({ onLogout }) => {
  const [navigation, setNavigation] = useState([]);
  const [articles, setArticles] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    fetchNavigation();
    fetchArticles();
  }, []);

  const fetchNavigation = async () => {
    try {
      const response = await axios.get(`${API}/navigation`);
      setNavigation(response.data);
      // Auto-expand all categories
      const expanded = {};
      response.data.filter(item => item.type === 'category').forEach(cat => {
        expanded[cat.id] = true;
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error("Error fetching navigation:", error);
    }
  };

  const fetchArticles = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`${API}/admin/articles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching articles:", error);
    }
  };

  const authHeader = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
    },
  });

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await axios.delete(`${API}/admin/navigation/${id}`, authHeader());
      await fetchNavigation();
    } catch (error) {
      console.error("Error deleting navigation item:", error);
      if (error.response?.status === 401) onLogout();
    }
  };

  const handleChangeCategory = async (articleId, newCategoryId) => {
    try {
      // Update the article's parent_id
      await axios.put(`${API}/admin/navigation/${articleId}`, {
        parent_id: newCategoryId
      }, authHeader());
      await fetchNavigation();
    } catch (error) {
      console.error("Error changing category:", error);
      alert("Failed to change category");
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination, type } = result;
    
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'category') {
      // Reorder categories
      const categories = navigation.filter(item => item.type === 'category');
      const [moved] = categories.splice(source.index, 1);
      categories.splice(destination.index, 0, moved);
      
      const updatedCategories = categories.map((cat, index) => ({
        ...cat,
        order: index
      }));

      // Update all navigation with new category orders
      const updatedNav = navigation.map(item => {
        const updated = updatedCategories.find(c => c.id === item.id);
        return updated || item;
      });
      
      setNavigation(updatedNav);

      try {
        await axios.put(`${API}/admin/navigation/reorder`, {
          items: updatedCategories
        }, authHeader());
      } catch (error) {
        console.error("Error reordering categories:", error);
        await fetchNavigation();
      }
    } else if (type === 'article') {
      // Reorder articles within a category
      const categoryId = source.droppableId;
      const articlesInCategory = navigation.filter(
        item => item.type === 'article' && item.parent_id === categoryId
      );
      
      const [moved] = articlesInCategory.splice(source.index, 1);
      articlesInCategory.splice(destination.index, 0, moved);
      
      const updatedArticles = articlesInCategory.map((art, index) => ({
        ...art,
        order: index
      }));

      // Update navigation
      const updatedNav = navigation.map(item => {
        const updated = updatedArticles.find(a => a.id === item.id);
        return updated || item;
      });
      
      setNavigation(updatedNav);

      try {
        await axios.put(`${API}/admin/navigation/reorder`, {
          items: updatedArticles
        }, authHeader());
      } catch (error) {
        console.error("Error reordering articles:", error);
        await fetchNavigation();
      }
    }
  };

  // Organize navigation into categories
  const categories = navigation
    .filter(item => item.type === 'category')
    .sort((a, b) => a.order - b.order);

  const getArticlesForCategory = (categoryId) => {
    return navigation
      .filter(item => item.type === 'article' && item.parent_id === categoryId)
      .sort((a, b) => a.order - b.order);
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Navigation Management</h1>
        <p className="admin-subtitle">Organize categories and articles in the sidebar</p>
      </div>

      <div className="admin-content">
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Categories List */}
          <Droppable droppableId="categories" type="category">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="nav-hierarchy"
              >
                {categories.map((category, catIndex) => {
                  const articlesInCategory = getArticlesForCategory(category.id);
                  const isExpanded = expandedCategories[category.id];

                  return (
                    <Draggable
                      key={category.id}
                      draggableId={category.id}
                      index={catIndex}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`nav-category-block ${snapshot.isDragging ? 'dragging' : ''}`}
                        >
                          {/* Category Header */}
                          <div className="nav-category-header">
                            <div className="nav-category-left">
                              <div {...provided.dragHandleProps} className="drag-handle">
                                <GripVertical size={18} />
                              </div>
                              <button
                                className="expand-btn"
                                onClick={() => toggleCategory(category.id)}
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              <div className="nav-category-info">
                                <span className="nav-category-label">{category.label}</span>
                                <span className="nav-item-count">{articlesInCategory.length} articles</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(category.id)}
                              className="btn-icon btn-danger"
                              title="Delete category"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Articles in Category */}
                          {isExpanded && (
                            <Droppable droppableId={category.id} type="article">
                              {(provided) => (
                                <div
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className="nav-articles-list"
                                >
                                  {articlesInCategory.length === 0 ? (
                                    <div className="nav-empty-category">
                                      No articles in this category
                                    </div>
                                  ) : (
                                    articlesInCategory.map((article, artIndex) => (
                                      <Draggable
                                        key={article.id}
                                        draggableId={article.id}
                                        index={artIndex}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`nav-article-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                          >
                                            <div className="nav-article-left">
                                              <div {...provided.dragHandleProps} className="drag-handle-small">
                                                <GripVertical size={16} />
                                              </div>
                                              <span className="nav-article-label">{article.label}</span>
                                            </div>
                                            <div className="nav-article-actions">
                                              <select
                                                className="category-select"
                                                value={article.parent_id || ''}
                                                onChange={(e) => handleChangeCategory(article.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {categories.map(cat => (
                                                  <option key={cat.id} value={cat.id}>
                                                    {cat.label}
                                                  </option>
                                                ))}
                                              </select>
                                              <button
                                                onClick={() => handleDelete(article.id)}
                                                className="btn-icon btn-danger"
                                                title="Delete article"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {categories.length === 0 && (
          <div className="nav-empty-state">
            <p>No categories yet. Articles will automatically create categories when published.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationManager;
