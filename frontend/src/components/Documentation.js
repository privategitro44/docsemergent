import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import SearchOverlay from "./SearchOverlay";
import TableOfContents from "./TableOfContents";
import ArticleContent from "./ArticleContent";
import EmergentLogo from "../assets/Emergent logo.png";

// Heroicons (outline) for UI + sidebar items
import {
  MagnifyingGlassIcon,
  HomeIcon,
  PlayCircleIcon,
  WrenchScrewdriverIcon,
  BoltIcon,
  BanknotesIcon,
  Squares2X2Icon,
  BugAntIcon,
  ChartBarIcon,
  BriefcaseIcon,
  GiftIcon,
  SparklesIcon,
  DocumentTextIcon,
  Bars3Icon,
  XMarkIcon,
  ListBulletIcon
} from "@heroicons/react/24/outline";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Documentation = () => {
  // Helper functions for heading duplication checks
  const normalizeText = (str) => (str || "").trim().replace(/\s+/g, " ").toLowerCase();

  const firstBlockHasMatchingH1 = (article) => {
    try {
      if (!article || !Array.isArray(article.content)) return false;
      const firstText = article.content.find((b) => b && b.type === "text" && typeof b.content === "string");
      if (!firstText) return false;
      const temp = document.createElement("div");
      temp.innerHTML = firstText.content;
      const h1 = temp.querySelector("h1");
      if (!h1) return false;
      return normalizeText(h1.textContent) === normalizeText(article.title);
    } catch (e) {
      // Non-blocking
      return false;
    }
  };

  const { slug } = useParams();
  const navigate = useNavigate();
  const [navigation, setNavigation] = useState([]);
  const [articles, setArticles] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setScrolled(y > 4);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const supportRef = useRef(null);
  useEffect(() => {
    // Ensure supporting header renders directly below main header with exact offset
    const updateTop = () => {
      if (supportRef.current) {
        const header = document.querySelector('.docs-header');
        const headerHeight = header ? header.offsetHeight : 64;
        supportRef.current.style.top = `${headerHeight}px`;
      }
    };
    updateTop();
    window.addEventListener('resize', updateTop);
    return () => window.removeEventListener('resize', updateTop);
  }, []);


  const [loading, setLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  useEffect(() => {
    fetchNavigation();
    fetchArticles();
  }, []);

  useEffect(() => {
    // Keyboard shortcut: Ctrl/Cmd + K to open overlay
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setShowOverlay(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (slug) {
      fetchArticle(slug);
    } else {
      // Show Welcome article by default if exists
      if (articles.length > 0) {
        const welcome = articles.find(a => a.published && (a.slug === 'welcome' || a.title.toLowerCase().includes('welcome')));
        if (welcome) {
          setCurrentArticle(welcome);
          // update URL for consistency so nav can match
          navigate(`/article/${welcome.slug}`, { replace: true });
        } else {
          const firstArticle = articles.find(a => a.published);
          if (firstArticle) setCurrentArticle(firstArticle);
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
    if (!content || !Array.isArray(content)) {
      return <p>No content available</p>;
    }

    return content.map((item, index) => {
      try {
        if (!item || !item.type) {
          console.error('Invalid content item:', item);
          return null;
        }

        switch (item.type) {
          case "text": {
            if (!item.content) return null;
            return (
              <ArticleContent
                key={index}
                content={item.content}
                title={currentArticle?.title}
                stripDuplicateTopHeading={true}
                transformH1ToH2={false}
              />
            );
          }
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
            if (!item.content) return null;
            return (
              <div key={index} className="embed-container">
                <div dangerouslySetInnerHTML={{ __html: item.content }} />
                {item.caption && (
                  <p className="embed-caption">{item.caption}</p>
                )}
              </div>
            );
          default:
            console.warn('Unknown content type:', item.type);
            return null;
        }
      } catch (error) {
        console.error('Error rendering content block:', error, item);
        return (
          <div key={index} style={{ padding: '10px', background: '#fee2e2', borderRadius: '4px', margin: '10px 0' }}>
            <p style={{ color: '#991b1b', fontSize: '14px' }}>Error rendering content block</p>
          </div>
        );
      }
    });
  };

  const sentenceCase = (str = "") => {
    const s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const getIconForLabel = (label = "") => {
    const l = label.toLowerCase();
    if (/(intro|welcome|home)/.test(l)) return HomeIcon;
    if (/(video|getting started|start)/.test(l)) return PlayCircleIcon;
    if (/(build|basics|setup|install)/.test(l)) return WrenchScrewdriverIcon;
    if (/(advanced|prompt|boost|optimize|tips)/.test(l)) return BoltIcon;
    if (/(credit|billing|cost|pricing|optimi)/.test(l)) return BanknotesIcon;
    if (/(workflow|pattern|flow|process)/.test(l)) return Squares2X2Icon;
    if (/(debug|bug)/.test(l)) return BugAntIcon;
    if (/(performance|speed|bench|opt)/.test(l)) return ChartBarIcon;
    if (/(professional|practice|career|work)/.test(l)) return BriefcaseIcon;
    if (/(free)/.test(l)) return GiftIcon;
    if (/(standard)/.test(l)) return BoltIcon;
    if (/(pro)/.test(l)) return SparklesIcon;
    return DocumentTextIcon;
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
    const activeSlug = slug || currentArticle?.slug;
    return navItems.map((item) => {
      const isActive = activeSlug === item.target;
      const isCategory = item.type === "category";

      const Icon = getIconForLabel(item.label);

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
            {!isCategory && <Icon className="nav-icon" aria-hidden="true" />}
            {isCategory ? sentenceCase(item.label) : item.label}
          </a>
          {item.children && item.children.length > 0 && (
            <div className="nav-children">
              {item.children.map((child) => {
                const ChildIcon = getIconForLabel(child.label);
                return (
                  <a
                    key={child.id}
                    href="#"
                    className={`nav-item sub-item ${
                      activeSlug === child.target ? "active" : ""
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(child);
                    }}
                    data-testid={`nav-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <ChildIcon className="nav-icon" aria-hidden="true" />
                    {child.label}
                  </a>
                );
              })}
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

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const kbdText = isMac ? '⌘ K' : 'Ctrl K';

  return (
    <div className="docs-layout" data-testid="docs-layout">
      {/* Header */}
      <header className="docs-header" data-testid="docs-header">
        <div className="mobile-left">
          <a href="/" className="logo" data-testid="docs-logo" aria-label="Emergent">
            <img src={EmergentLogo} alt="Emergent" style={{ height: 24 }} />
          </a>
        </div>
        
        <div className="search-container desktop-only">
          <MagnifyingGlassIcon className="search-icon" width={16} height={16} />
          <input
            type="text"
            placeholder="Search..."
            className="search-input"
            onFocus={() => setShowOverlay(true)}
            onClick={() => setShowOverlay(true)}
            readOnly
            data-testid="search-input"
          />
          <div className="search-kbd" aria-hidden="true">{kbdText}</div>
        </div>

        <div className="header-actions">
          {/* Search icon only visible on mobile/tablet; hidden on desktop via CSS */}
          <button className="icon-button mobile-only" aria-label="Open search" onClick={() => setShowOverlay(true)}>
            <MagnifyingGlassIcon width={18} height={18} />
          </button>
          <a
            href="https://app.emergent.sh/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-try"
          >
            Try Emergent
          </a>
        </div>
      </header>

      {/* Mobile/Tablet supporting header positioned directly under main header */}
      <div ref={supportRef} className={`supporting-header mobile-only ${scrolled ? 'glass' : ''}`}>
        <button className="supporting-hamburger" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
          <Bars3Icon width={20} height={20} />
        </button>
        <div className="supporting-breadcrumb">
          {currentArticle ? (
            <>
              <span className="crumb-cat">{(currentArticle.category || '').charAt(0).toUpperCase() + (currentArticle.category || '').slice(1).toLowerCase()}</span>
              <span className="crumb-sep">›</span>
              <span className="crumb-title">{currentArticle.title}</span>
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
      </div>

      {/* Mobile slide-over nav */}
      <div className={`mobile-drawer ${mobileNavOpen ? 'open' : ''}`} aria-hidden={!mobileNavOpen}>
        <div className="mobile-drawer-header">
          <div className="drawer-title">Docs</div>
          <button className="drawer-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
            <XMarkIcon width={22} height={22} />
          </button>
        </div>
        <div className="mobile-drawer-body">
          {renderNavigation(organizedNavigation)}
        </div>
      </div>
      <div className={`mobile-backdrop ${mobileNavOpen ? 'show' : ''}`} onClick={() => setMobileNavOpen(false)}></div>

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
              <div className="title-tag" data-testid="article-title-tag">{currentArticle.title}</div>
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
      </main>

      {/* Right-side TOC as independent column */}
      {currentArticle && (
        <aside className="docs-toc" data-testid="table-of-contents">
          <div className="toc-mobile-header">
            <button className="toc-mobile-toggle" onClick={() => setMobileTocOpen(true)}>
              <ListBulletIcon width={18} height={18} />
              On this page
            </button>
          </div>
          <TableOfContents content={currentArticle.content} />
        </aside>
      )}

      {/* Mobile TOC drawer */}
      {currentArticle && (
        <div className={`mobile-toc-drawer ${mobileTocOpen ? 'open' : ''}`} aria-hidden={!mobileTocOpen}>
          <div className="mobile-drawer-header">
            <div className="drawer-title">On this page</div>
            <button className="drawer-close" aria-label="Close TOC" onClick={() => setMobileTocOpen(false)}>
              <XMarkIcon width={22} height={22} />
            </button>
          </div>
          <div className="mobile-drawer-body">
            <TableOfContents content={currentArticle.content} />
          </div>
        </div>
      )}
      <div className={`mobile-backdrop ${mobileTocOpen ? 'show' : ''}`} onClick={() => setMobileTocOpen(false)}></div>

      {/* Search overlay (global) */}
      <SearchOverlay
        isOpen={showOverlay}
        onClose={() => setShowOverlay(false)}
        onNavigate={(slug) => navigate(`/article/${slug}`)}
        navTree={organizedNavigation}
      />

    </div>
  );
};

export default Documentation;
