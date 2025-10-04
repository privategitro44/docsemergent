import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import AdminDashboard from "./AdminDashboard";
import ArticleManager from "./ArticleManager";
import NavigationManager from "./NavigationManager";
import ArticleEditor from "./ArticleEditor";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const token = localStorage.getItem("adminToken");
    
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      await axios.get(`${API}/admin/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Authentication verification failed:", error);
      localStorage.removeItem("adminToken");
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="loading" data-testid="admin-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-panel" data-testid="admin-panel">
      <Routes>
        <Route path="/dashboard" element={<AdminDashboard onLogout={handleLogout} />} />
        <Route path="/articles" element={<ArticleManager onLogout={handleLogout} />} />
        <Route path="/articles/new" element={<ArticleEditor onLogout={handleLogout} />} />
        <Route path="/articles/edit/:id" element={<ArticleEditor onLogout={handleLogout} />} />
        <Route path="/settings/social" element={<div style={{padding:24}}>Social Links manager (coming soon)</div>} />

        <Route path="/navigation" element={<NavigationManager onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </div>
  );
};

export default AdminPanel;
