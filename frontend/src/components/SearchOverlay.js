import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { MagnifyingGlassIcon, XMarkIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { BACKEND_URL, API } from "../config";

// Escape regex special characters in query
const escapeRegExp = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Strip HTML tags for clean snippets
const stripHtml = (str = "") => str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// Highlight helper that returns React nodes (no dangerouslySetInnerHTML)
const highlight = (text = "", query = "") => {
  if (!query) return text;
  const safe = escapeRegExp(query.trim());
  if (!safe) return text;
  const regex = new RegExp(`(${safe})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark key={idx} className="search-highlight">{part}</mark>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
};

const SearchOverlay = ({ isOpen, onClose, onNavigate, navTree = [] }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const resultsRef = useRef(null);
  const debounceRef = useRef(null);


  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
      document.documentElement.classList.add("search-overlay-open");
    } else {
      document.documentElement.classList.remove("search-overlay-open");
      setQuery("");
      setResults([]);
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

  // Build breadcrumb (slug -> path) from provided nav tree
  const crumbMap = useMemo(() => {
    const map = {};
    const dfs = (nodes = [], trail = []) => {
      nodes.forEach((n) => {
        const currentTrail = [...trail, n.label];
        if (n.type !== "category" && n.target) {
          // include the page label at the end to match reference
          map[n.target] = currentTrail.join(" > ");
        }
        if (Array.isArray(n.children) && n.children.length) dfs(n.children, currentTrail);
      });
    };
    dfs(navTree || [], []);
    return map;
  }, [navTree]);

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
        const data = Array.isArray(res.data) ? res.data : [];
        // enrich with breadcrumb if available
        const enriched = data.map((r) => ({ ...r, breadcrumb: crumbMap[r.slug] || r.breadcrumb || r.category || "" }));
        setResults(enriched);
      } catch (err) {
        console.error("Search overlay error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [isOpen, query, crumbMap]);

  const handleSelect = (item) => {
    if (onNavigate) onNavigate(item.slug);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay-backdrop" role="dialog" aria-modal="true">
      <div className="search-overlay-container" ref={containerRef}>
        <div className="search-overlay-card">
          <div className="search-overlay-input-wrap">
            <MagnifyingGlassIcon className="search-overlay-icon" width={18} height={18} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="search-overlay-input"
            />
            <div className="search-overlay-esc">ESC</div>
            <button className="search-overlay-close" onClick={onClose} aria-label="Close search">
              <XMarkIcon width={18} height={18} />
            </button>
          </div>

          <div className="search-overlay-results inside" data-testid="search-overlay-results" ref={resultsRef}>
            {loading && <div className="search-overlay-loading">Searching...</div>}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <div className="search-overlay-empty">No results found</div>
            )}
            {!loading && results.map((r) => (
              <button key={r.id} className="search-overlay-result hierarchy" onClick={() => handleSelect(r)}>
                <div className="result-row">
                  {r.breadcrumb && (
                    <div className="result-crumbs" aria-hidden="true">{r.breadcrumb}</div>
                  )}
                  <div className="result-title one-line">{highlight(r.title || "", query)}</div>
                  {r.category && <div className="result-meta one-line">{r.category}</div>}
                  {r.snippet && <div className="result-snippet one-line">{highlight(stripHtml(r.snippet || ""), query)}</div>}
                </div>
                <ChevronRightIcon className="result-chevron-svg" width={24} height={24} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
