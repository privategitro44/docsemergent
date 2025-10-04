import React, { useState, useEffect } from "react";
import { ListBulletIcon } from "@heroicons/react/24/outline";

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
          try {
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
          } catch (error) {
            console.error("Error extracting headings:", error);
          }
        }
      });
      
      setHeadings(headingList);
    };

    if (content && content.length > 0) {
      extractHeadings();
    }
  }, [content]);

  useEffect(() => {
    if (headings.length === 0) return;
    try {
      // If the first heading is in view on load, mark it active immediately
      const firstId = headings[0]?.id;
      if (firstId && document.getElementById(firstId)) {
        setActiveHeading(firstId);
      }

      const observerOptions = {
        rootMargin: "-20% 0% -70% 0%",
        threshold: [0, 0.25, 0.5, 1.0]
      };

      let lastActive = firstId || "";
      const observer = new IntersectionObserver((entries) => {
        // Sort entries by boundingClientRect.top to pick the one closest to top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible.length > 0) {
          lastActive = visible[0].target.id;
          setActiveHeading(lastActive);
        }
      }, observerOptions);

      headings.forEach((heading) => {
        const el = document.getElementById(heading.id);
        if (el) observer.observe(el);
      });

      return () => observer.disconnect();
    } catch (error) {
      console.error("Error setting up IntersectionObserver:", error);
    }
  }, [headings]);

  const scrollToHeading = (headingId) => {
    try {
      const element = document.getElementById(headingId);
      if (element) {
        const yOffset = -72; // account for sticky header height with some spacing
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    } catch (error) {
      console.error("Error scrolling to heading:", error);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="docs-toc" data-testid="table-of-contents">
      <div className="toc-title"><ListBulletIcon className="toc-title-icon" width={16} height={16} />On this page</div>
      <ul className="toc-list toc-reset">
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
