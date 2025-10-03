import React, { useEffect, useRef } from 'react';

const normalizeText = (str) => (str || '').trim().replace(/\s+/g, ' ').toLowerCase();

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true, transformH1ToH2 = true }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    // Process headings inside the rendered HTML safely
    if (!contentRef.current || !content) return;

    try {
      const root = contentRef.current;

      // 1) Remove ANY H1 whose text matches the article title (prevents double title)
      if (stripDuplicateTopHeading && title) {
        const titleNorm = normalizeText(title);
        root.querySelectorAll('h1').forEach((h1) => {
          if (normalizeText(h1.textContent) === titleNorm) {
            h1.remove();
          }
        });
      }

      // 2) Optionally transform remaining H1s in body to H2 for semantic consistency
      if (transformH1ToH2) {
        const remainingH1s = Array.from(root.querySelectorAll('h1'));
        remainingH1s.forEach((h1) => {
          const h2 = document.createElement('h2');
          h2.innerHTML = h1.innerHTML;
          // Preserve classes/attrs except ID (will reassign)
          Array.from(h1.attributes).forEach((attr) => {
            if (attr.name.toLowerCase() !== 'id') {
              h2.setAttribute(attr.name, attr.value);
            }
          });
          h1.parentNode.replaceChild(h2, h1);
        });
      }

      // 3) Remove immediately repeated duplicate headings across all levels (e.g., <h2>X</h2><h2>X</h2>)
      const allHeadings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      allHeadings.forEach((heading) => {
        // Find previous element sibling that is a heading
        const prev = heading.previousElementSibling;
        if (prev && /^H[1-6]$/.test(prev.tagName)) {
          const sameLevel = prev.tagName === heading.tagName;
          const sameText = normalizeText(prev.textContent) === normalizeText(heading.textContent);
          if (sameLevel && sameText) {
            heading.remove();
          }
        }
      });

      // 4) After removals/transform, assign IDs safely for TOC
      const headingsAfter = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headingsAfter.forEach((h) => {
        if (!h.id && h.textContent) {
          const text = h.textContent.trim();
          if (text) {
            const id = text
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '');
            if (id) h.id = id;
          }
        }
      });
    } catch (error) {
      console.error('Error processing headings in ArticleContent:', error);
    }
  }, [content, title, stripDuplicateTopHeading, transformH1ToH2]);

  if (!content) {
    return null;
  }

  return <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />;
};

export default ArticleContent;
