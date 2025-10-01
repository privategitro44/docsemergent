import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { LogIn, Eye, EyeOff } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/admin/login`, credentials);
      
      // Store the token
      localStorage.setItem("adminToken", response.data.access_token);
      
      // Navigate to admin panel
      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      if (error.response?.status === 401) {
        setError("Invalid username or password");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login" data-testid="admin-login">
      <div className="login-card">
        <div className="login-header">
          <LogIn className="login-icon" size={32} />
          <h1 className="login-title" data-testid="login-title">
            Admin Login
          </h1>
          <p className="login-subtitle">
            Sign in to manage Emergent Documentation
          </p>
        </div>

        {error && (
          <div className="error-alert" data-testid="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} data-testid="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter your username"
              disabled={loading}
              data-testid="username-input"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                className="form-input password-input"
                placeholder="Enter your password"
                disabled={loading}
                data-testid="password-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                data-testid="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-help-text">
            Default credentials: admin / admin123
          </p>
          <a href="/" className="back-to-docs" data-testid="back-to-docs">
            ← Back to Documentation
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
