import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Search, X } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SearchOverlay = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus input when opened
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
      // Prevent background scroll (optional)
      document.documentElement.classList.add("search-overlay-open");
    } else {
      document.documentElement.classList.remove("search-overlay-open");
    }
    return () => document.documentElement.classList.remove("search-overlay-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/search`, { params: { q: query } });
        setResults(res.data || []);
      } catch (err) {
        console.error("Search overlay error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [isOpen, query]);

  const handleSelect = (item) => {
    if (onNavigate) onNavigate(item.slug);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay-backdrop" role="dialog" aria-modal="true">
      <div className="search-overlay-container" ref={containerRef}>
        <div className="search-overlay-input-wrap">
          <Search className="search-overlay-icon" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="search-overlay-input"
          />
          <button className="search-overlay-close" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="search-overlay-results" data-testid="search-overlay-results">
          {loading && <div className="search-overlay-loading">Searching...</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="search-overlay-empty">No results found</div>
          )}
          {!loading && results.map((r) => (
            <button key={r.id} className="search-overlay-result" onClick={() => handleSelect(r)}>
              <div className="result-title">{r.title}</div>
              <div className="result-meta">{r.category}</div>
              <div className="result-snippet">{r.snippet}</div>
            </button>
          ))}
        </div>

        <div className="search-overlay-hint">Press Esc to close • Ctrl/⌘ + K to open</div>
      </div>
    </div>
  );
};

export default SearchOverlay;
