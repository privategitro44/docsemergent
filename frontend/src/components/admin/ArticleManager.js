import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { Plus, Edit, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { BACKEND_URL, API } from "../../config";

const ArticleManager = ({ onLogout }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, published, draft
  const [sortBy, setSortBy] = useState("updated_at"); // title, category, updated_at
  const [sortOrder, setSortOrder] = useState("desc"); // asc, desc

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`${API}/articles?published_only=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteArticle = async (articleId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      await axios.delete(`${API}/admin/articles/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove from state
      setArticles(articles.filter(article => article.id !== articleId));
      alert("Article deleted successfully");
    } catch (error) {
      console.error("Error deleting article:", error);
      alert("Failed to delete article. Please try again.");
    }
  };

  const togglePublished = async (articleId, currentStatus) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(`${API}/admin/articles/${articleId}`, {
        published: !currentStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state
      setArticles(articles.map(article => 
        article.id === articleId 
          ? { ...article, published: !currentStatus }
          : article
      ));
    } catch (error) {
      console.error("Error updating article status:", error);
      alert("Failed to update article status. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter and sort articles
  const filteredAndSortedArticles = articles
    .filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           article.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || 
                           (filterStatus === "published" && article.published) ||
                           (filterStatus === "draft" && !article.published);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "updated_at":
        default:
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  if (loading) {
    return (
      <AdminLayout onLogout={onLogout}>
        <div className="loading" data-testid="articles-loading">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={onLogout}>
      <div className="article-manager" data-testid="article-manager">
        {/* Header */}
        <div className="manager-header">
          <div>
            <h1 className="manager-title">Articles</h1>
            <p className="manager-subtitle">
              Manage your documentation articles
            </p>
          </div>
          <Link 
            to="/admin/articles/new" 
            className="btn btn-primary"
            data-testid="create-article-btn"
          >
            <Plus size={16} />
            Create Article
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="manager-controls">
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              data-testid="search-articles"
            />
          </div>
          
          <div className="filter-controls">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
              data-testid="filter-status"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
              data-testid="sort-by"
            >
              <option value="updated_at">Sort by Updated</option>
              <option value="title">Sort by Title</option>
              <option value="category">Sort by Category</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="sort-order-btn"
              title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
              data-testid="sort-order"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>

        {/* Articles List */}
        <div className="manager-content">
          {filteredAndSortedArticles.length > 0 ? (
            <div className="articles-table" data-testid="articles-table">
              <div className="table-header">
                <div className="table-cell">Title</div>
                <div className="table-cell">Category</div>
                <div className="table-cell">Status</div>
                <div className="table-cell">Updated</div>
                <div className="table-cell">Actions</div>
              </div>
              
              {filteredAndSortedArticles.map((article) => (
                <div key={article.id} className="table-row" data-testid={`article-row-${article.id}`}>
                  <div className="table-cell">
                    <div className="article-title-cell">
                      <h3 className="article-title-text">{article.title}</h3>
                      <p className="article-slug">/{article.slug}</p>
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    <span className="category-badge">{article.category}</span>
                  </div>
                  
                  <div className="table-cell">
                    <button
                      onClick={() => togglePublished(article.id, article.published)}
                      className={`status-toggle ${article.published ? 'published' : 'draft'}`}
                      title={`Click to ${article.published ? 'unpublish' : 'publish'}`}
                      data-testid={`toggle-status-${article.id}`}
                    >
                      {article.published ? (
                        <>
                          <Eye size={14} />
                          Published
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} />
                          Draft
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="table-cell">
                    <span className="date-text">{formatDate(article.updated_at)}</span>
                  </div>
                  
                  <div className="table-cell">
                    <div className="action-buttons">
                      <Link
                        to={`/admin/articles/edit/${article.id}`}
                        className="action-btn edit"
                        title="Edit Article"
                        data-testid={`edit-article-${article.id}`}
                      >
                        <Edit size={14} />
                      </Link>
                      
                      <button
                        onClick={() => deleteArticle(article.id, article.title)}
                        className="action-btn delete"
                        title="Delete Article"
                        data-testid={`delete-article-${article.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" data-testid="empty-articles">
              <div className="empty-icon">
                <Search size={48} />
              </div>
              <h3>No articles found</h3>
              <p>
                {searchTerm || filterStatus !== "all"
                  ? "No articles match your current filters."
                  : "Create your first article to get started."}
              </p>
              {(!searchTerm && filterStatus === "all") && (
                <Link to="/admin/articles/new" className="btn btn-primary">
                  <Plus size={16} />
                  Create Article
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ArticleManager;
