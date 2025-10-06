import React, { useState, useEffect } from "react";
import { ListBulletIcon } from "@heroicons/react/24/outline";

const TableOfContents = ({ content }) => {
  const [headings, setHeadings] = useState([]);
  const [activeHeading, setActiveHeading] = useState("");

  // Compute dynamic top offset accounting for sticky headers
  const getTopOffset = () => {
    try {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      const header = parseInt((styles.getPropertyValue('--header-height') || '').replace('px','').trim(), 10) || 64;
      const support = window.innerWidth <= 1024
        ? parseInt((styles.getPropertyValue('--support-height') || '').replace('px','').trim(), 10) || 0
        : 0;
      // Add a small breathing room so the heading title isn't hidden under the header
      return header + support + 8;
    } catch (e) {
      return 72; // sensible fallback
    }
  };

  useEffect(() => {
    // Extract headings from content (H2 only per spec)
    const extractHeadings = () => {
      const headingList = [];

      content.forEach((item) => {
        if (item.type === "text") {
          try {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = item.content;

            const headingElements = tempDiv.querySelectorAll("h2");
            headingElements.forEach((heading) => {
              const level = 2;
              const text = heading.textContent || "";
              const id = text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
              if (!id) return;
              headingList.push({ id, text, level });
            });
          } catch (error) {
            console.error("Error extracting headings:", error);
          }
        } else if (item.type === "steps" || item.type === "integrations") {
          try {
            const text = (item.title || "").trim();
            const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
            if (id) headingList.push({ id, text, level: 2 });
          } catch (e) {
            // ignore
          }
        }
      });

      setHeadings(headingList);
    };

    if (content && content.length > 0) {
      extractHeadings();
    } else {
      setHeadings([]);
    }
  }, [content]);

  useEffect(() => {
    if (headings.length === 0) return;
    try {
      // Default to first heading as active on load
      const firstId = headings[0]?.id;
      if (firstId && document.getElementById(firstId)) {
        setActiveHeading(firstId);
      }

      const topOffset = getTopOffset();
      const observerOptions = {
        root: null,
        rootMargin: `-${topOffset}px 0px -80% 0px`,
        threshold: [0, 0.01, 0.25, 0.5]
      };

      const fallbackUpdate = () => {
        try {
          const offset = getTopOffset();
          let bestId = firstId || "";
          let bestDist = Number.POSITIVE_INFINITY;
          for (let i = 0; i < headings.length; i++) {
            const h = headings[i];
            const el = document.getElementById(h.id);
            if (!el) continue;
            const top = el.getBoundingClientRect().top - offset;
            const dist = Math.abs(top);
            if (dist < bestDist) {
              bestDist = dist;
              bestId = h.id;
            }
          }
          if (bestId) setActiveHeading(bestId);
        } catch (e) {
          // non-blocking
        }
      };

      const observer = new IntersectionObserver((entries) => {
        // Consider intersecting headings and choose the closest to top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top));

        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id) setActiveHeading(id);
        } else {
          // When no heading is intersecting (e.g., between sections), use fallback
          fallbackUpdate();
        }
      }, observerOptions);

      // Observe all h2 elements by id in the actual DOM
      headings.forEach((heading) => {
        const el = document.getElementById(heading.id);
        if (el) observer.observe(el);
      });

      // As a safety net, update on scroll for cases where IO doesn't fire
      const onScroll = () => {
        // Throttle via rAF
        if (typeof window === 'undefined') return;
        if (onScroll._ticking) return;
        onScroll._ticking = true;
        requestAnimationFrame(() => {
          onScroll._ticking = false;
          fallbackUpdate();
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll);
      };
    } catch (error) {
      console.error("Error setting up IntersectionObserver:", error);
    }
  }, [headings]);

  const scrollToHeading = (headingId) => {
    try {
      const element = document.getElementById(headingId);
      if (element) {
        const yOffset = -getTopOffset();
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
