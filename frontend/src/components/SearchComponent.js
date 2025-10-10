import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../config";

const SearchComponent = ({ query, onClose, onSelect }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const searchArticles = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(`${API}/search`, {
          params: { q: query }
        });
        setResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchArticles, 300);
    return () => clearTimeout(debounceTimeout);
  }, [query]);

  const handleResultClick = (result) => {
    navigate(`/article/${result.slug}`);
    onSelect();
  };

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  if (loading) {
    return (
      <div className="search-results" data-testid="search-results">
        <div className="search-result-item">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0 && query.trim().length >= 2) {
    return (
      <div className="search-results" data-testid="search-results">
        <div className="search-result-item">
          <div className="search-result-title">No results found</div>
          <div className="search-result-snippet">
            Try different keywords or check your spelling.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results" data-testid="search-results">
      {results.map((result) => (
        <div
          key={result.id}
          className="search-result-item"
          onClick={() => handleResultClick(result)}
          data-testid={`search-result-${result.slug}`}
        >
          <div className="search-result-category">{result.category}</div>
          <div className="search-result-title">{result.title}</div>
          <div className="search-result-snippet">{result.snippet}</div>
        </div>
      ))}
    </div>
  );
};

export default SearchComponent;
