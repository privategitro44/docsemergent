import React, { useEffect, useRef } from 'react';

const ArticleContent = ({ content }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    // Add IDs to headings after render
    if (!contentRef.current || !content) return;
    
    try {
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
      console.error('Error adding IDs to headings:', error);
    }
  }, [content]);

  if (!content) {
    return null;
  }

  return (
    <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

export default ArticleContent;
