import React, { useEffect, useRef } from 'react';

const normalizeText = (str) => (str || '').trim().replace(/\s+/g, ' ').toLowerCase();

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    // Add IDs to headings after render, remove duplicate headings, and drop any H1 matching the article title
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

      // 2) Remove immediately repeated duplicate headings across all levels (e.g., <h2>X</h2><h2>X</h2>)
      const allHeadings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      allHeadings.forEach((heading) => {
        // Find previous element sibling (skip text nodes)
        let prev = heading.previousElementSibling;
        while (prev && !/^H[1-6]$/.test(prev.tagName)) {
          // If the previous element is not a heading, break to avoid skipping sections entirely
          break;
        }
        if (prev && /^H[1-6]$/.test(prev.tagName)) {
          const sameLevel = prev.tagName === heading.tagName;
          const sameText = normalizeText(prev.textContent) === normalizeText(heading.textContent);
          if (sameLevel && sameText) {
            heading.remove();
          }
        }
      });

      // 3) After removals, assign IDs safely for TOC
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
  }, [content, title, stripDuplicateTopHeading]);

  if (!content) {
    return null;
  }

  return <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />;
};

export default ArticleContent;
