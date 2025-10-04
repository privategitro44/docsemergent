import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings, FileText, Navigation, LogOut, Home, Share2 } from "lucide-react";

const AdminLayout = ({ children, onLogout }) => {
  const location = useLocation();

  const navigationItems = [
    {
      path: "/admin/dashboard",
      label: "Dashboard",
      icon: <Settings size={18} />
    },
    {
      path: "/admin/articles",
      label: "Articles",
      icon: <FileText size={18} />
    },
    {
      path: "/admin/navigation",
      label: "Navigation",
      icon: <Navigation size={18} />
    },
    {
      path: "/admin/social-links",
      label: "Social Links",
      icon: <Share2 size={18} />
    }
  ];

  return (
    <div className="admin-layout" data-testid="admin-layout">
      {/* Admin Header */}
      <header className="admin-header" data-testid="admin-header">
        <div className="admin-header-left">
          <h1 className="admin-title">Emergent CMS</h1>
        </div>
        
        <div className="admin-header-right">
          <Link to="/" className="btn btn-secondary" data-testid="view-site">
            <Home size={16} />
            View Site
          </Link>
          <button 
            onClick={onLogout} 
            className="btn btn-danger"
            data-testid="logout-button"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <div className="admin-content">
        {/* Admin Sidebar */}
        <aside className="admin-sidebar" data-testid="admin-sidebar">
          <nav className="admin-nav">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${
                  location.pathname === item.path ? "active" : ""
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Admin Main Content */}
        <main className="admin-main" data-testid="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
