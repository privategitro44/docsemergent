import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import SearchComponent from "./SearchComponent";
import TableOfContents from "./TableOfContents";
import ArticleContent from "./ArticleContent";
import { Search, Book } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Documentation = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [navigation, setNavigation] = useState([]);
  const [articles, setArticles] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchNavigation();
    fetchArticles();
  }, []);

  useEffect(() => {
    if (slug) {
      fetchArticle(slug);
    } else {
      // Show first article by default
      if (articles.length > 0) {
        const firstArticle = articles.find(a => a.published);
        if (firstArticle) {
          setCurrentArticle(firstArticle);
        }
      }
    }
  }, [slug, articles]);

  const fetchNavigation = async () => {
    try {
      const response = await axios.get(`${API}/navigation`);
      setNavigation(response.data);
    } catch (error) {
      console.error("Error fetching navigation:", error);
    }
  };

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles`);
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticle = async (articleSlug) => {
    try {
      const response = await axios.get(`${API}/articles/${articleSlug}`);
      setCurrentArticle(response.data);
    } catch (error) {
      console.error("Error fetching article:", error);
      setCurrentArticle(null);
    }
  };

  const handleNavClick = (navItem) => {
    if (navItem.type === "article" && navItem.target) {
      navigate(`/article/${navItem.target}`);
    } else if (navItem.type === "link" && navItem.target) {
      window.open(navItem.target, "_blank");
    }
  };

  const renderContent = (content) => {
    return content.map((item, index) => {
      switch (item.type) {
        case "text":
          return (
            <ArticleContent key={index} content={item.content} />
          );
        case "image":
          return (
            <div key={index} className="image-container">
              <img
                src={item.content.startsWith("/") ? `${BACKEND_URL}${item.content}` : item.content}
                alt={item.alt || ""}
                data-testid="article-image"
              />
              {item.caption && (
                <p className="image-caption">{item.caption}</p>
              )}
            </div>
          );
        case "video":
          // Check if it's a YouTube or Vimeo URL
          const isYouTube = item.content.includes('youtube.com') || item.content.includes('youtu.be');
          const isVimeo = item.content.includes('vimeo.com');
          
          if (isYouTube || isVimeo) {
            // Convert to embed URL if needed
            let embedUrl = item.content;
            
            if (isYouTube) {
              // Handle various YouTube URL formats
              if (item.content.includes('watch?v=')) {
                const videoId = item.content.split('watch?v=')[1].split('&')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
              } else if (item.content.includes('youtu.be/')) {
                const videoId = item.content.split('youtu.be/')[1].split('?')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
              } else if (!item.content.includes('/embed/')) {
                // If it's already an embed URL, use it as is
                embedUrl = item.content;
              }
            } else if (isVimeo) {
              // Handle Vimeo URLs
              if (!item.content.includes('/video/')) {
                const videoId = item.content.split('vimeo.com/')[1].split('?')[0];
                embedUrl = `https://player.vimeo.com/video/${videoId}`;
              }
            }
            
            return (
              <div key={index} className="video-container">
                <div className="video-responsive">
                  <iframe
                    src={embedUrl}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={item.caption || 'Video'}
                    data-testid="article-video-iframe"
                  />
                </div>
                {item.caption && (
                  <p className="video-caption">{item.caption}</p>
                )}
              </div>
            );
          }
          
          // For direct video files (mp4, etc.)
          return (
            <div key={index} className="video-container">
              <video controls data-testid="article-video">
                <source
                  src={item.content.startsWith("/") ? `${BACKEND_URL}${item.content}` : item.content}
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
              {item.caption && (
                <p className="video-caption">{item.caption}</p>
              )}
            </div>
          );
        case "embed":
          return (
            <div key={index} className="embed-container">
              <div dangerouslySetInnerHTML={{ __html: item.content }} />
              {item.caption && (
                <p className="embed-caption">{item.caption}</p>
              )}
            </div>
          );
        default:
          return null;
      }
    });
  };

  const organizeNavigation = () => {
    const navMap = new Map();
    const rootItems = [];

    // First pass: create map of all items
    navigation.forEach(item => {
      navMap.set(item.id, { ...item, children: [] });
    });

    // Second pass: organize hierarchy
    navigation.forEach(item => {
      if (item.parent_id && navMap.has(item.parent_id)) {
        navMap.get(item.parent_id).children.push(navMap.get(item.id));
      } else {
        rootItems.push(navMap.get(item.id));
      }
    });

    // Sort by order
    const sortByOrder = (items) => {
      return items.sort((a, b) => a.order - b.order).map(item => ({
        ...item,
        children: sortByOrder(item.children)
      }));
    };

    return sortByOrder(rootItems);
  };

  const renderNavigation = (navItems) => {
    return navItems.map((item) => {
      const isActive = slug === item.target;
      const isCategory = item.type === "category";

      return (
        <div key={item.id}>
          <a
            href="#"
            className={`nav-item ${
              isActive ? "active" : ""
            } ${isCategory ? "category" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              if (!isCategory) {
                handleNavClick(item);
              }
            }}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {item.label}
          </a>
          {item.children && item.children.length > 0 && (
            <div className="nav-children">
              {item.children.map((child) => (
                <a
                  key={child.id}
                  href="#"
                  className={`nav-item sub-item ${
                    slug === child.target ? "active" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(child);
                  }}
                  data-testid={`nav-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {child.label}
                </a>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="loading" data-testid="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const organizedNavigation = organizeNavigation();

  return (
    <div className="docs-layout" data-testid="docs-layout">
      {/* Header */}
      <header className="docs-header" data-testid="docs-header">
        <a href="/" className="logo" data-testid="docs-logo">
          <Book size={20} />
          Emergent Docs
        </a>
        
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search documentation..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            data-testid="search-input"
          />
          {showSearch && searchQuery.trim().length >= 2 && (
            <SearchComponent
              query={searchQuery}
              onClose={() => setShowSearch(false)}
              onSelect={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
            />
          )}
        </div>

        <div className="header-actions">
          {/* Hidden admin link - only accessible via direct URL */}
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className="docs-sidebar" data-testid="docs-sidebar">
        <div className="sidebar-section">
          {renderNavigation(organizedNavigation)}
        </div>
      </aside>

      {/* Main Content */}
      <main className="docs-main" data-testid="docs-main">
        <div className="docs-content" data-testid="docs-content">
          {currentArticle ? (
            <article className="article" data-testid="current-article">
              <h1 data-testid="article-title">{currentArticle.title}</h1>
              <div data-testid="article-content">
                {renderContent(currentArticle.content)}
              </div>
            </article>
          ) : (
            <div className="no-article" data-testid="no-article">
              <h1>Welcome to Emergent Documentation</h1>
              <p>Select an article from the sidebar to get started.</p>
            </div>
          )}
        </div>

        {/* Table of Contents */}
        {currentArticle && (
          <TableOfContents content={currentArticle.content} />
        )}
      </main>
    </div>
  );
};

export default Documentation;
