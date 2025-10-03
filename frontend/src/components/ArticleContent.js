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

export default ArticleContent;
