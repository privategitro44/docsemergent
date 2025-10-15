import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { FileText, Users, Navigation, Search } from "lucide-react";
import { BACKEND_URL, API } from "../../config";

const AdminDashboard = ({ onLogout }) => {
  const [stats, setStats] = useState({
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0,
    navigationItems: 0
  });
  const [recentArticles, setRecentArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all articles (including unpublished for admin)
      const [articlesResponse, navigationResponse] = await Promise.all([
        axios.get(`${API}/articles?published_only=false`, { headers }),
        axios.get(`${API}/navigation`)
      ]);

      const articles = articlesResponse.data;
      const navigation = navigationResponse.data;

      setStats({
        totalArticles: articles.length,
        publishedArticles: articles.filter(a => a.published).length,
        draftArticles: articles.filter(a => !a.published).length,
        navigationItems: navigation.length
      });

      // Get 5 most recent articles
      const sortedArticles = articles
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);
      setRecentArticles(sortedArticles);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <AdminLayout onLogout={onLogout}>
        <div className="loading" data-testid="dashboard-loading">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={onLogout}>
      <div className="admin-dashboard" data-testid="admin-dashboard">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome to your Emergent documentation content management system.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid" data-testid="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number" data-testid="total-articles">
                {stats.totalArticles}
              </h3>
              <p className="stat-label">Total Articles</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon published">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number" data-testid="published-articles">
                {stats.publishedArticles}
              </h3>
              <p className="stat-label">Published</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon draft">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number" data-testid="draft-articles">
                {stats.draftArticles}
              </h3>
              <p className="stat-label">Drafts</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Navigation size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number" data-testid="navigation-items">
                {stats.navigationItems}
              </h3>
              <p className="stat-label">Navigation Items</p>
            </div>
          </div>
        </div>

        {/* Recent Articles */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Recent Articles</h2>
            <a href="/admin/articles" className="section-link">
              View All Articles →
            </a>
          </div>

          <div className="articles-list" data-testid="recent-articles">
            {recentArticles.length > 0 ? (
              recentArticles.map((article) => (
                <div key={article.id} className="article-item">
                  <div className="article-info">
                    <h3 className="article-title">
                      <a href={`/admin/articles/edit/${article.id}`}>
                        {article.title}
                      </a>
                    </h3>
                    <div className="article-meta">
                      <span className="article-category">{article.category}</span>
                      <span className="article-date">
                        {formatDate(article.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="article-status">
                    <span className={`status-badge ${article.published ? 'published' : 'draft'}`}>
                      {article.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FileText size={48} className="empty-icon" />
                <h3>No articles yet</h3>
                <p>Create your first article to get started.</p>
                <a href="/admin/articles/new" className="btn btn-primary">
                  Create Article
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>

          <div className="quick-actions" data-testid="quick-actions">
            <a href="/admin/articles/new" className="action-card">
              <FileText size={24} />
              <span>Create New Article</span>
            </a>
            <a href="/admin/navigation" className="action-card">
              <Navigation size={24} />
              <span>Manage Navigation</span>
            </a>
            <a href="/" className="action-card" target="_blank">
              <Search size={24} />
              <span>Preview Site</span>
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
