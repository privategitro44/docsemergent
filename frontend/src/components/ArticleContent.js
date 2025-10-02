import React, { useEffect, useRef } from 'react';

const ArticleContent = ({ content }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    // Add IDs to headings after render
    if (contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => {
        if (!heading.id) {
          const text = heading.textContent;
          const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
          heading.id = id;
        }
      });
    }
  }, [content]);

  return (
    <div ref={contentRef} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

export default ArticleContent;
