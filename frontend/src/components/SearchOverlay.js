import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { MagnifyingGlassIcon, XMarkIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PAGE_SIZE = 10; // user-approved page size

// Escape regex special characters in query
const escapeRegExp = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const [page, setPage] = useState(1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const resultsRef = useRef(null);
  const debounceRef = useRef(null);

  // Reset page when query changes
  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
      document.documentElement.classList.add("search-overlay-open");
    } else {
      document.documentElement.classList.remove("search-overlay-open");
      setQuery("");
      setResults([]);
      setPage(1);
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(results.length / PAGE_SIZE)), [results.length]);
  const pagedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [results, page]);

  const goPrev = () => {
    setPage((p) => {
      const np = Math.max(1, p - 1);
      if (resultsRef.current) resultsRef.current.scrollTop = 0;
      return np;
    });
  };
  const goNext = () => {
    setPage((p) => {
      const np = Math.min(totalPages, p + 1);
      if (resultsRef.current) resultsRef.current.scrollTop = 0;
      return np;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay-backdrop" role="dialog" aria-modal="true">
      <div className="search-overlay-container" ref={containerRef}>
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

        <div className="search-overlay-results" data-testid="search-overlay-results" ref={resultsRef}>
          {/* Pagination header */}
          {!loading && results.length > 0 && (
            <div className="search-pagination-header" role="navigation" aria-label="Search pagination">
              <button className="pagination-btn" onClick={goPrev} disabled={page <= 1} aria-label="Previous page">Prev</button>
              <span className="pagination-sep">•</span>
              <div className="pagination-status">Page {page} of {totalPages}</div>
              <span className="pagination-sep">•</span>
              <button className="pagination-btn" onClick={goNext} disabled={page >= totalPages} aria-label="Next page">Next</button>
            </div>
          )}

          {loading && <div className="search-overlay-loading">Searching...</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="search-overlay-empty">No results found</div>
          )}
          {!loading && pagedResults.map((r) => (
            <button key={r.id} className="search-overlay-result" onClick={() => handleSelect(r)}>
              <div className="result-row">
                <div className="result-title">{highlight(r.title || "", query)}</div>
                <div className="result-meta">{r.category}</div>
                <div className="result-snippet">{highlight(r.snippet || "", query)}</div>
              </div>
              <span className="result-chevron" aria-hidden="true">→</span>
            </button>
          ))}
        </div>

        <div className="search-overlay-hint">Press Esc to close • Ctrl/⌘ + K to open</div>
      </div>
    </div>
  );
};

export default SearchOverlay;
