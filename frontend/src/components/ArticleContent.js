import React, { useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';

const normalizeText = (str) =&gt; (str || '').trim().replace(/\s+/g, ' ').toLowerCase();

const slugify = (text) =&gt; (text || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9\-]/g, '');

const preprocessHtml = (html, { title, stripDuplicateTopHeading, transformH1ToH2 }) =&gt; {
  if (!html) return '';
  try {
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove any H1 that exactly matches the page title
    if (stripDuplicateTopHeading &amp;&amp; title) {
      const titleNorm = normalizeText(title);
      container.querySelectorAll('h1').forEach((h1) =&gt; {
        if (normalizeText(h1.textContent) === titleNorm) {
          h1.remove();
        }
      });
    }

    // Optionally transform remaining H1s to H2s for consistency
    if (transformH1ToH2) {
      const remaining = Array.from(container.querySelectorAll('h1'));
      remaining.forEach((h1) =&gt; {
        const h2 = document.createElement('h2');
        h2.innerHTML = h1.innerHTML;
        Array.from(h1.attributes).forEach((attr) =&gt; {
          if (attr.name.toLowerCase() !== 'id') h2.setAttribute(attr.name, attr.value);
        });
        h1.parentNode.replaceChild(h2, h1);
      });
    }

    // Remove immediate duplicate headings (same level and same text) in document order
    const all = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prev = null;
    all.forEach((h) =&gt; {
      if (prev &amp;&amp; prev.tagName === h.tagName &amp;&amp; normalizeText(prev.textContent) === normalizeText(h.textContent)) {
        h.remove();
      } else {
        prev = h;
      }
    });

    // Ensure stable, unique IDs for all headings before HTML is injected
    const idCounts = new Map();
    Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).forEach((h) =&gt; {
      const base = slugify(h.textContent || '');
      if (!base) return;
      const count = (idCounts.get(base) || 0) + 1;
      idCounts.set(base, count);
      const finalId = count &gt; 1 ? `${base}-${count}` : base;
      if (!h.id) h.id = finalId;
    });

    return container.innerHTML;
  } catch (e) {
    // If anything fails, return original html
    return html;
  }
};

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true, transformH1ToH2 = true }) =&gt; {
  const contentRef = useRef(null);

  // Preprocess before initial paint to avoid flicker/duplicates
  const processedHtml = useMemo(
    () =&gt; preprocessHtml(content, { title, stripDuplicateTopHeading, transformH1ToH2 }),
    [content, title, stripDuplicateTopHeading, transformH1ToH2]
  );

  useEffect(() =&gt; {
    if (!contentRef.current) return;
    try {
      const root = contentRef.current;
      const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((h) =&gt; {
        if (!h.id &amp;&amp; h.textContent) {
          const id = h.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
          if (id) h.id = id;
        }
      });
    } catch (e) {
      // non-blocking
    }
  }, [processedHtml]);

  if (!content) return null;

  return &lt;div ref={contentRef} dangerouslySetInnerHTML={{ __html: processedHtml }} /&gt;;
};

// New components for structured blocks: Steps and Integrations
export const StepsBlock = ({ block }) =&gt; {
  const steps = Array.isArray(block?.steps) ? block.steps : [];
  if (!block || steps.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const toHtml = (s) =&gt; {
    // If already in new format
    if (s &amp;&amp; typeof s.html === 'string' &amp;&amp; s.html.trim().length &gt; 0) return s.html;
    // Migrate legacy fields (title, description, bullets)
    const parts = [];
    if (s?.title) parts.push(`&lt;div class="step-title"&gt;${s.title}&lt;/div&gt;`);
    if (s?.description) parts.push(`&lt;p&gt;${s.description}&lt;/p&gt;`);
    if (Array.isArray(s?.bullets) &amp;&amp; s.bullets.length &gt; 0) {
      parts.push(`&lt;ul&gt;${s.bullets.map((b) =&gt; `&lt;li&gt;${b}&lt;/li&gt;`).join('')}&lt;/ul&gt;`);
    }
    return parts.join('');
  };

  return (
    &lt;section className="steps" id={id || undefined}&gt;
      {block.title &amp;&amp; &lt;h2&gt;{block.title}&lt;/h2&gt;}
      &lt;ol className="steps-list"&gt;
        {steps.map((s, idx) =&gt; {
          const raw = toHtml(s);
          const sanitized = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
          return (
            &lt;li key={idx} className="step-item"&gt;
              &lt;div className="step-number" aria-hidden="true"&gt;{idx + 1}&lt;/div&gt;
              &lt;div className="step-content"&gt;
                &lt;div dangerouslySetInnerHTML={{ __html: sanitized }} /&gt;
              &lt;/div&gt;
            &lt;/li&gt;
          );
        })}
      &lt;/ol&gt;
    &lt;/section&gt;
  );
};

export const IntegrationsBlock = ({ block }) =&gt; {
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const cols = Number(block?.columns) === 3 ? 3 : 2; // default 2

  const Icon = ({ name }) =&gt; {
    const n = String(name || '').toLowerCase();
    const attrs = { className: 'integration-icon', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' };
    if (n === 'stripe') return (&lt;svg {...attrs}&gt;&lt;path d="M11.5 3C6.8 3 3 5 3 5v14s3.9 2 8.5 2 8.5-2 8.5-2V5s-3.9-2-8.5-2Zm0 3.2c2.4 0 4.3.5 4.3.5v3.1s-1.8-.6-4.2-.6c-2.1 0-3.5.7-3.5 2 0 1.5 1.9 2 3.9 2.5 2.9.7 6 1.5 6 5 0 3.5-3 5.3-6.8 5.3-4.5 0-7-1.8-7-1.8v-3.3s2.5 1.4 6.9 1.4c2.4 0 3.9-.6 3.9-2.1 0-1.4-1.6-2-3.6-2.5-3-.7-6.4-1.5-6.4-5.1 0-3.2 2.8-4.4 6.4-4.4Z"/&gt;&lt;/svg&gt;);
    if (n === 'openai') return (&lt;svg {...attrs}&gt;&lt;path d="M12 2a6 6 0 0 1 6 6c0 .6-.1 1.2-.3 1.8A6 6 0 0 1 22 16a6 6 0 0 1-6 6c-.6 0-1.2-.1-1.8-.3A6 6 0 0 1 8 22a6 6 0 0 1-6-6c0-.6.1-1.2.3-1.8A6 6 0 0 1 2 8a6 6 0 0 1 6-6 6 6 0 0 1 4 1.5A6 6 0 0 1 12 2Z"/&gt;&lt;/svg&gt;);
    if (n === 'anthropic') return (&lt;svg {...attrs}&gt;&lt;circle cx="12" cy="12" r="10"/&gt;&lt;/svg&gt;);
    if (n === 'resend') return (&lt;svg {...attrs}&gt;&lt;rect x="3" y="4" width="18" height="16" rx="2"/&gt;&lt;/svg&gt;);
    if (n === 'clerk') return (&lt;svg {...attrs}&gt;&lt;path d="M4 4h16v4H4zM4 10h16v10H4z"/&gt;&lt;/svg&gt;);
    if (n === 'three' || n === 'three.js') return (&lt;svg {...attrs}&gt;&lt;polygon points="12,2 22,22 2,22"/&gt;&lt;/svg&gt;);
    if (n === 'd3' || n === 'd3.js') return (&lt;svg {...attrs}&gt;&lt;path d="M4 4h8a6 6 0 0 1 0 12H4zM12 10h4a4 4 0 0 1 0 8h-4z"/&gt;&lt;/svg&gt;);
    if (n === 'highcharts') return (&lt;svg {...attrs}&gt;&lt;path d="M4 20V8l5 5 6-9 5 8v8z"/&gt;&lt;/svg&gt;);
    if (n === 'p5' || n === 'p5.js') return (&lt;svg {...attrs}&gt;&lt;circle cx="8" cy="12" r="4"/&gt;&lt;rect x="12" y="8" width="8" height="8" rx="2"/&gt;&lt;/svg&gt;);
    return (&lt;svg {...attrs}&gt;&lt;rect x="4" y="4" width="16" height="16" rx="4"/&gt;&lt;/svg&gt;);
  };

  return (
    &lt;section className={`integrations ${cols === 3 ? 'three' : 'two'}`} id={id || undefined}&gt;
      {block.title &amp;&amp; &lt;h2&gt;{block.title}&lt;/h2&gt;}
      {block.description &amp;&amp; &lt;p className="integrations-desc"&gt;{block.description}&lt;/p&gt;}
      &lt;div className="integrations-grid"&gt;
        {items.map((it, i) =&gt; (
          &lt;a key={i} className="integration-card" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={it.name}&gt;
            &lt;div className={`integration-icon-wrap ${it.icon || ''}`}&gt;
              &lt;Icon name={it.icon} /&gt;
            &lt;/div&gt;
            &lt;div className="integration-content"&gt;
              &lt;div className="integration-name-row"&gt;
                &lt;div className="integration-name"&gt;{it.name}&lt;/div&gt;
              &lt;/div&gt;
              &lt;div className="integration-summary"&gt;{it.summary}&lt;/div&gt;
            &lt;/div&gt;
          &lt;/a&gt;
        ))}
      &lt;/div&gt;
    &lt;/section&gt;
  );
};

import { BACKEND_URL } from '../config';

export const ArticleLinksBlock = ({ block, onNavigate }) =&gt; {
  const items = Array.isArray(block?.items) ? block.items : [];
  if (items.length === 0) return null;
  const id = (block.title || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const cols = Number(block?.columns) === 2 ? 2 : 3; // default 3

  const BuiltinIcon = ({ name }) =&gt; {
    const n = String(name || '').toLowerCase();
    const attrs = { className: 'al-icon', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' };
    if (n === 'document') return (&lt;svg {...attrs}&gt;&lt;path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5"/&gt;&lt;/svg&gt;);
    if (n === 'link') return (&lt;svg {...attrs}&gt;&lt;path d="M10.6 13.4a3 3 0 0 0 0-4.2l-1.8-1.8a3 3 0 1 0-4.2 4.2l.9.9M13.4 10.6a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 1 0 4.2-4.2l-.9-.9" strokeWidth="2" stroke="currentColor" fill="none"/&gt;&lt;/svg&gt;);
    if (n === 'book') return (&lt;svg {...attrs}&gt;&lt;path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/&gt;&lt;/svg&gt;);
    if (n === 'lightbulb') return (&lt;svg {...attrs}&gt;&lt;path d="M9 18h6M12 2a6 6 0 0 1 6 6c0 2.2-1.2 3.6-2.2 4.7-.6.6-1.1 1.3-1.3 2.1H9.5c-.3-.8-.8-1.5-1.4-2.1C7.1 11.6 6 10.2 6 8a6 6 0 0 1 6-6Z"/&gt;&lt;/svg&gt;);
    if (n === 'play') return (&lt;svg {...attrs}&gt;&lt;path d="M8 5v14l11-7z"/&gt;&lt;/svg&gt;);
    if (n === 'code') return (&lt;svg {...attrs}&gt;&lt;path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/&gt;&lt;/svg&gt;);
    if (n === 'shield') return (&lt;svg {...attrs}&gt;&lt;path d="M12 2l7 4v6c0 5-3.4 9.4-7 10-3.6-.6-7-5-7-10V6z"/&gt;&lt;/svg&gt;);
    if (n === 'cog') return (&lt;svg {...attrs}&gt;&lt;path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/&gt;&lt;path d="M19 12a7 7 0 0 0-.2-1.6l2.1-1.6-2-3.4-2.5 1a7.6 7.6 0 0 0-2.8-1.6l-.3-2.7H11l-.3 2.7a7.6 7.6 0 0 0-2.8 1.6l-2.5-1-2 3.4 2.1 1.6A7 7 0 0 0 5 12c0 .6.1 1.1.2 1.6L3 15.2l2 3.4 2.5-1a7.6 7.6 0 0 0 2.8 1.6l.3 2.7h3.2l.3-2.7a7.6 7.6 0 0 0 2.8-1.6l2.5 1 2-3.4-2.1-1.6c.1-.5.2-1 .2-1.6Z"/&gt;&lt;/svg&gt;);
    if (n === 'bolt') return (&lt;svg {...attrs}&gt;&lt;path d="M13 2L3 14h7l-1 8 10-12h-7z"/&gt;&lt;/svg&gt;);
    return (&lt;svg {...attrs}&gt;&lt;rect x="4" y="4" width="16" height="16" rx="4"/&gt;&lt;/svg&gt;);
  };

  const handleClick = (e, it) =&gt; {
    if (it.slug) {
      e.preventDefault();
      if (onNavigate) onNavigate(it.slug);
    }
  };

  return (
    &lt;section className={`article-links ${cols === 3 ? 'three' : 'two'}`} id={id || undefined}&gt;
      {block.title &amp;&amp; &lt;h2&gt;{block.title}&lt;/h2&gt;}
      &lt;div className="article-links-grid"&gt;
        {items.map((it, i) =&gt; {
          const title = it.title &amp;&amp; it.title.trim().length ? it.title : (it.articleTitle || '');
          const href = it.slug ? `/article/${it.slug}` : (it.url || '#');
          const isExternal = !it.slug &amp;&amp; /^https?:\/\//i.test(href);
          return (
            &lt;a key={i} className="article-link-card" href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} onClick={(e)=&gt;handleClick(e, it)}&gt;
              &lt;div className="al-icon-wrap"&gt;
                {it.iconUrl ? (
                  &lt;img src={it.iconUrl.startsWith('/') ? `${BACKEND_URL}${it.iconUrl}` : it.iconUrl} alt="" className="al-icon-img" /&gt;
                ) : (
                  &lt;BuiltinIcon name={it.icon} /&gt;
                )}
              &lt;/div&gt;
              &lt;div className="al-content"&gt;
                &lt;div className="al-title"&gt;{title}&lt;/div&gt;
                {it.description &amp;&amp; &lt;div className="al-desc"&gt;{it.description}&lt;/div&gt;}
              &lt;/div&gt;
            &lt;/a&gt;
          );
        })}
      &lt;/div&gt;
    &lt;/section&gt;
  );
};

export default ArticleContent;