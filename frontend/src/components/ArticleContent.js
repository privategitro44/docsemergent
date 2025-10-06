import React, { useEffect, useRef, useMemo } from 'react';

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

    // Remove any H1 that exactly matches the page title
    if (stripDuplicateTopHeading && title) {
      const titleNorm = normalizeText(title);
      container.querySelectorAll('h1').forEach((h1) => {
        if (normalizeText(h1.textContent) === titleNorm) {
          h1.remove();
        }
      });
    }

    // Optionally transform remaining H1s to H2s for consistency
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

    // Remove immediate duplicate headings (same level and same text) in document order
    const all = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prev = null;
    all.forEach((h) => {
      if (prev && prev.tagName === h.tagName && normalizeText(prev.textContent) === normalizeText(h.textContent)) {
        h.remove();
      } else {
        prev = h;
      }
    });

    // Ensure stable, unique IDs for all headings before HTML is injected
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
    // If anything fails, return original html
    return html;
  }
};

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true, transformH1ToH2 = true }) => {
  const contentRef = useRef(null);

  // Preprocess before initial paint to avoid flicker/duplicates
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

// New components for structured blocks: Steps and Integrations
export const StepsBlock = ({ block }) => {
  if (!block || !Array.isArray(block.steps) || block.steps.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return (
    <section className="steps" id={id || undefined}>
      {block.title && <h2>{block.title}</h2>}
      <ol className="steps-list">
        {block.steps.map((s, idx) => (
          <li key={idx} className="step-item">
            <div className="step-number" aria-hidden="true">{idx + 1}</div>
            <div className="step-content">
              {s.title && <div className="step-title">{s.title}</div>}
              {s.description && <div className="step-desc">{s.description}</div>}
              {Array.isArray(s.bullets) && s.bullets.length > 0 && (
                <ul className="step-bullets">
                  {s.bullets.map((b, i) => (<li key={i}>{b}</li>))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const IntegrationsBlock = ({ block }) => {
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const cols = Number(block?.columns) === 3 ? 3 : 2; // default 2

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

export default ArticleContent;
