import React, { useState, useEffect } from "react";

const TableOfContents = ({ content }) => {
  const [headings, setHeadings] = useState([]);
  const [activeHeading, setActiveHeading] = useState("");

  useEffect(() => {
    // Extract headings from content
    const extractHeadings = () => {
      const headingList = [];
      
      content.forEach((item) => {
        if (item.type === "text") {
          // Parse HTML content to extract headings
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = item.content;
          
          const headingElements = tempDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");
          headingElements.forEach((heading) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent;
            const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
            
            headingList.push({
              id,
              text,
              level
            });
          });
        }
      });
      
      setHeadings(headingList);
    };

    extractHeadings();
    
    // Add IDs to actual DOM headings after they're rendered
    const addHeadingIds = () => {
      headings.forEach((heading) => {
        const element = document.querySelector(`h${heading.level}:not([id])`);
        if (element && element.textContent.trim() === heading.text) {
          element.id = heading.id;
        }
      });
    };
    
    if (headings.length > 0) {
      setTimeout(addHeadingIds, 100);
    }
  }, [content, headings]);

  useEffect(() => {
    // Set up intersection observer for active heading detection
    const observerOptions = {
      rootMargin: "-20% 0% -80% 0%",
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveHeading(entry.target.id);
        }
      });
    }, observerOptions);

    // Observe all headings
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (headingId) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="docs-toc" data-testid="table-of-contents">
      <div className="toc-title">On this page</div>
      <ul className="toc-list">
        {headings.map((heading) => (
          <li key={heading.id} className="toc-item">
            <button
              className={`toc-link level-${heading.level} ${
                activeHeading === heading.id ? "active" : ""
              }`}
              onClick={() => scrollToHeading(heading.id)}
              data-testid={`toc-${heading.id}`}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TableOfContents;
