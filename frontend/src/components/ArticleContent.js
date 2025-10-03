import React, { useEffect, useRef } from 'react';

const ArticleContent = ({ content, title, stripDuplicateTopHeading = true }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    // Add IDs to headings after render and optionally remove duplicate top H1 matching the article title
    if (!contentRef.current || !content) return;
    
    try {
      // Optionally remove the first H1 if it matches the article title
      if (stripDuplicateTopHeading && title) {
        const firstH1 = contentRef.current.querySelector('h1');
        if (firstH1) {
          const h1Text = (firstH1.textContent || '').trim().toLowerCase();
          const titleText = (title || '').trim().toLowerCase();
          if (h1Text && titleText && h1Text === titleText) {
            firstH1.remove();
          }
        }
      }

      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => {
        if (!heading.id && heading.textContent) {
          const text = heading.textContent.trim();
          if (text) {
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            if (id) {
              heading.id = id;
            }
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

  return (
    <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

export default ArticleContent;
