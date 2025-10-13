import React, { useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';

const normalizeText = (str) => (str || '').trim().replace(/\s+/g, ' ').toLowerCase();

const slugify = (text) => (text || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9\-]/g, '');

const preprocessHtml = (html, { title, stripDuplicateTopHeading, transformH1ToH2 }) => {
  if (!html) return '';
  try {
    const container = document.createElement('div');
    container.innerHTML = html;

    if (stripDuplicateTopHeading && title) {
      const titleNorm = normalizeText(title);
      container.querySelectorAll('h1').forEach((h1) => {
        if (normalizeText(h1.textContent) === titleNorm) {
          h1.remove();
        }
      });
    }

    if (transformH1ToH2) {
      const remaining = Array.from(container.querySelectorAll('h1'));
      remaining.forEach((h1) => {
        const h2 = document.createElement('h2');
        h2.innerHTML = h1.innerHTML;
        Array.from(h1.attributes).forEach((attr) => {
          if (attr.name.toLowerCase() !== 'id') h2.setAttribute(attr.name, attr.value);
        });
        h1.parentNode.replaceChild(h2, h1);
      });
    }

    const all = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prev = null;
    all.forEach((h) => {
      if (prev && prev.tagName === h.tagName && normalizeText(prev.textContent) === normalizeText(h.textContent)) {
        h.remove();
      } else {
        prev = h;
      }
    });

    const idCounts = new Map();
    Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).forEach((h) => {
      const base = slugify(h.textContent || '');
      if (!base) return;
      const count = (idCounts.get(base) || 0) + 1;
      idCounts.set(base, count);
      const finalId = count > 1 ? `${base}-${count}` : base;
      if (!h.id) h.id = finalId;
    });

    return container.innerHTML;
  } catch (e) {
    return html;
  }
};

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true, transformH1ToH2 = true }) => {
  const contentRef = useRef(null);

  const processedHtml = useMemo(
    () => preprocessHtml(content, { title, stripDuplicateTopHeading, transformH1ToH2 }),
    [content, title, stripDuplicateTopHeading, transformH1ToH2]
  );

  useEffect(() => {
    if (!contentRef.current) return;
    try {
      const root = contentRef.current;
      const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((h) => {
        if (!h.id && h.textContent) {
          const id = h.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
          if (id) h.id = id;
        }
      });
    } catch (e) {
      // non-blocking
    }
  }, [processedHtml]);

  if (!content) return null;

  return <div ref={contentRef} dangerouslySetInnerHTML={{ __html: processedHtml }} />;
};

// Steps (public)
export const StepsBlock = ({ block }) => {
  const steps = Array.isArray(block?.steps) ? block.steps : [];
  if (!block || steps.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const toHtml = (s) => {
    if (s && typeof s.html === 'string' && s.html.trim().length > 0) return s.html;
    const parts = [];
    if (s?.description) parts.push(`<p>${s.description}</p>`);
    if (Array.isArray(s?.bullets) && s.bullets.length > 0) {
      parts.push(`<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`);
    }
    return parts.join('');
  };

  return (
    <section className="steps" id={id || undefined}>
      {block.title && <h2>{block.title}</h2>}
      <ol className="steps-list">
        {steps.map((s, idx) => {
          const safeHtml = DOMPurify.sanitize(toHtml(s), { USE_PROFILES: { html: true } });
          return (
            <li key={idx} className="step-item">
              <div className="step-number" aria-hidden="true">{idx + 1}</div>
              <div className="step-content">
                {s?.title ? <div className="step-title">{s.title}</div> : null}
                {safeHtml ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} /> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export const IntegrationsBlock = ({ block }) => {
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const cols = Number(block?.columns) === 3 ? 3 : 2;

  const Icon = ({ name }) => {
    const n = String(name || '').toLowerCase();
    const attrs = { className: 'integration-icon', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' };
    if (n === 'stripe') return (<svg {...attrs}><path d="M11.5 3C6.8 3 3 5 3 5v14s3.9 2 8.5 2 8.5-2 8.5-2V5s-3.9-2-8.5-2Zm0 3.2c2.4 0 4.3.5 4.3.5v3.1s-1.8-.6-4.2-.6c-2.1 0-3.5.7-3.5 2 0 1.5 1.9 2 3.9 2.5 2.9.7 6 1.5 6 5 0 3.5-3 5.3-6.8 5.3-4.5 0-7-1.8-7-1.8v-3.3s2.5 1.4 6.9 1.4c2.4 0 3.9-.6 3.9-2.1 0-1.4-1.6-2-3.6-2.5-3-.7-6.4-1.5-6.4-5.1 0-3.2 2.8-4.4 6.4-4.4Z"/></svg>);
    if (n === 'openai') return (<svg {...attrs}><path d="M12 2a6 6 0 0 1 6 6c0 .6-.1 1.2-.3 1.8A6 6 0 0 1 22 16a6 6 0 0 1-6 6c-.6 0-1.2-.1-1.8-.3A6 6 0 0 1 8 22a6 6 0 0 1-6-6c0-.6.1-1.2.3-1.8A6 6 0 0 1 2 8a6 6 0 0 1 6-6 6 6 0 0 1 4 1.5A6 6 0 0 1 12 2Z"/></svg>);
    if (n === 'anthropic') return (<svg {...attrs}><circle cx="12" cy="12" r="10"/></svg>);
    if (n === 'resend') return (<svg {...attrs}><rect x="3" y="4" width="18" height="16" rx="2"/></svg>);
    if (n === 'clerk') return (<svg {...attrs}><path d="M4 4h16v4H4zM4 10h16v10H4z"/></svg>);
    if (n === 'three' || n === 'three.js') return (<svg {...attrs}><polygon points="12,2 22,22 2,22"/></svg>);
    if (n === 'd3' || n === 'd3.js') return (<svg {...attrs}><path d="M4 4h8a6 6 0 0 1 0 12H4zM12 10h4a4 4 0 0 1 0 8h-4z"/></svg>);
    if (n === 'highcharts') return (<svg {...attrs}><path d="M4 20V8l5 5 6-9 5 8v8z"/></svg>);
    if (n === 'p5' || n === 'p5.js') return (<svg {...attrs}><circle cx="8" cy="12" r="4"/><rect x="12" y="8" width="8" height="8" rx="2"/></svg>);
    return (<svg {...attrs}><rect x="4" y="4" width="16" height="16" rx="4"/></svg>);
  };

  return (
    <section className={`integrations ${cols === 3 ? 'three' : 'two'}`} id={id || undefined}>
      {block.title && <h2>{block.title}</h2>}
      {block.description && <p className="integrations-desc">{block.description}</p>}
      <div className="integrations-grid">
        {items.map((it, i) => (
          <a key={i} className="integration-card" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={it.name}>
            <div className={`integration-icon-wrap ${it.icon || ''}`}>
              <Icon name={it.icon} />
            </div>
            <div className="integration-content">
              <div className="integration-name-row">
                <div className="integration-name">{it.name}</div>
              </div>
              <div className="integration-summary">{it.summary}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

import { BACKEND_URL } from '../config';

export const ArticleLinksBlock = ({ block, onNavigate }) => {
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const cols = Number(block?.columns) === 2 ? 2 : 3;

  const BuiltinIcon = ({ name }) => {
    const n = String(name || '').toLowerCase();
    const attrs = { className: 'al-icon', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' };
    if (n === 'document') return (<svg {...attrs}><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5"/></svg>);
    if (n === 'link') return (<svg {...attrs}><path d="M10.6 13.4a3 3 0 0 0 0-4.2l-1.8-1.8a3 3 0 1 0-4.2 4.2l.9.9M13.4 10.6a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 1 0 4.2-4.2l-.9-.9" strokeWidth="2" stroke="currentColor" fill="none"/></svg>);
    if (n === 'book') return (<svg {...attrs}><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/></svg>);
    if (n === 'lightbulb') return (<svg {...attrs}><path d="M9 18h6M12 2a6 6 0 0 1 6 6c0 2.2-1.2 3.6-2.2 4.7-.6.6-1.1 1.3-1.3 2.1H9.5c-.3-.8-.8-1.5-1.4-2.1C7.1 11.6 6 10.2 6 8a6 6 0 0 1 6-6Z"/></svg>);
    if (n === 'play') return (<svg {...attrs}><path d="M8 5v14l11-7z"/></svg>);
    if (n === 'code') return (<svg {...attrs}><path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/></svg>);
    if (n === 'shield') return (<svg {...attrs}><path d="M12 2l7 4v6c0 5-3.4 9.4-7 10-3.6-.6-7-5-7-10V6z"/></svg>);
    if (n === 'cog') return (<svg {...attrs}><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/><path d="M19 12a7 7 0 0 0-.2-1.6l2.1-1.6-2-3.4-2.5 1a7.6 7.6 0 0 0-2.8-1.6l-.3-2.7H11l-.3 2.7a7.6 7.6 0 0 0-2.8 1.6l-2.5-1-2 3.4 2.1 1.6A7 7 0 0 0 5 12c0 .6.1 1.1.2 1.6L3 15.2l2 3.4 2.5-1a7.6 7.6 0 0 0 2.8 1.6l.3 2.7h3.2l.3-2.7a7.6 7.6 0 0 0 2.8-1.6l2.5 1 2-3.4-2.1-1.6c.1-.5.2-1 .2-1.6Z"/></svg>);
    if (n === 'bolt') return (<svg {...attrs}><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>);
    return (<svg {...attrs}><rect x="4" y="4" width="16" height="16" rx="4"/></svg>);
  };

  const handleClick = (e, it) => {
    if (it.slug) {
      e.preventDefault();
      if (onNavigate) onNavigate(it.slug);
    }
  };

  return (
    <section className={`article-links ${cols === 3 ? 'three' : 'two'}`} id={id || undefined}>
      {block.title && <h2>{block.title}</h2>}
      <div className="article-links-grid">
        {items.map((it, i) => {
          const title = it.title && it.title.trim().length ? it.title : (it.articleTitle || '');
          const href = it.slug ? `/article/${it.slug}` : (it.url || '#');
          const isExternal = !it.slug && /^https?:\/\//i.test(href);
          return (
            <a key={i} className="article-link-card" href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} onClick={(e)=>handleClick(e, it)}>
              <div className="al-icon-wrap">
                {it.iconUrl ? (
                  <img src={it.iconUrl.startsWith('/') ? `${BACKEND_URL}${it.iconUrl}` : it.iconUrl} alt="" className="al-icon-img" />
                ) : (
                  <BuiltinIcon name={it.icon} />
                )}
              </div>
              <div className="al-content">
                <div className="al-title">{title}</div>
                {it.description && <div className="al-desc">{it.description}</div>}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

export const AccordionBlock = ({ block }) => {
  const [openIndex, setOpenIndex] = React.useState(null);
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;

  const toggleItem = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="accordion-block">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const safeContent = DOMPurify.sanitize(item.content || '', { USE_PROFILES: { html: true } });
        
        return (
          <div key={index} className={`accordion-item ${isOpen ? 'open' : ''}`}>
            <button
              className="accordion-header"
              onClick={() => toggleItem(index)}
              aria-expanded={isOpen}
            >
              <span className="accordion-icon" aria-hidden="true">
                {isOpen ? '▼' : '▶'}
              </span>
              <span className="accordion-title">{item.title || `Item ${index + 1}`}</span>
            </button>
            {isOpen && (
              <div className="accordion-content">
                <div dangerouslySetInnerHTML={{ __html: safeContent }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ArticleContent;
