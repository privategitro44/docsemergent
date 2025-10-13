import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { Save, ArrowLeft, Upload, Link as LinkIcon, Eye, EyeOff } from "lucide-react";
import { BACKEND_URL, API } from "../../config";
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

const TipTapToolbar = ({ editor }) => {
  if (!editor) return null;
  const btn = (label, onClick, isActive=false) => (
    <button type="button" className={`toolbar-btn${isActive ? ' active' : ''}`} onClick={onClick}>{label}</button>
  );
  return (
    <div className="editor-toolbar">
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      {btn('UL', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('OL', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('</>', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
    </div>
  );
};

const AccordionToolbar = ({ editor }) => {
  if (!editor) return null;
  const btn = (label, onClick, isActive=false) => (
    <button type="button" className={`toolbar-btn${isActive ? ' active' : ''}`} onClick={onClick}>{label}</button>
  );
  
  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="editor-toolbar">
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('U', () => editor.chain().focus().toggleUnderline?.().run(), false)}
      {btn('UL', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('OL', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('Link', addLink, editor.isActive('link'))}
    </div>
  );
};

const StepRichEditor = ({ value, onChange, placeholder }) => {
  const isInternalUpdateRef = React.useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Mark updates originating from the editor to avoid resetting content/focus
      isInternalUpdateRef.current = true;
      // Slightly debounce to batch keystrokes and reduce parent re-renders
      if (StepRichEditor._raf) cancelAnimationFrame(StepRichEditor._raf);
      StepRichEditor._raf = requestAnimationFrame(() => {
        onChange(html);
        // allow effect to know this was internal
        setTimeout(() => { isInternalUpdateRef.current = false; }, 0);
      });
    },
  });

  // Reflect external value changes without breaking caret/focus
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdateRef.current) return;
    const current = editor.getHTML();
    // Only set when truly different to avoid resetting selection
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  return (
    <div className="html-editor">
      <TipTapToolbar editor={editor} />
      <div className="tiptap-wrap">
        <EditorContent editor={editor} />
      </div>
      {placeholder ? (
        <div className="editor-help"><small>{placeholder}</small></div>
      ) : null}
    </div>
  );
};

const AccordionRichEditor = ({ value, onChange, placeholder }) => {
  const isInternalUpdateRef = React.useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        style: 'font-size: 16px; line-height: 28px;',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      isInternalUpdateRef.current = true;
      if (AccordionRichEditor._raf) cancelAnimationFrame(AccordionRichEditor._raf);
      AccordionRichEditor._raf = requestAnimationFrame(() => {
        onChange(html);
        setTimeout(() => { isInternalUpdateRef.current = false; }, 0);
      });
    },
  });

  // Reflect external value changes without breaking caret/focus
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdateRef.current) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  return (
    <div className="html-editor">
      <AccordionToolbar editor={editor} />
      <div className="tiptap-wrap">
        <EditorContent editor={editor} />
      </div>
      {placeholder ? (
        <div className="editor-help"><small>{placeholder}</small></div>
      ) : null}
    </div>
  );
};

const ArticleEditor = ({ onLogout }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [article, setArticle] = useState({
    title: "",
    slug: "",
    content: [{ type: "text", content: "" }],
    category: "",
    order: 0,
    meta_description: "",
    keywords: [],
    published: true
  });
  
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (isEditing) {
      fetchArticle();
    }
  }, [id]);

  const migrateStepsBlock = (block) => {
    if (!block || block.type !== 'steps') return block;
    const steps = Array.isArray(block.steps) ? block.steps : [];
    // If already new format (has html or title fields), return as-is
    const isNew = steps.some(s => typeof s?.html === 'string' || typeof s?.title === 'string');
    if (isNew) return block;
    // Legacy: title, description, bullets
    const migrated = steps.map((s) => {
      const parts = [];
      if (s?.description) parts.push(`<p>${s.description}</p>`);
      if (Array.isArray(s?.bullets) && s.bullets.length) {
        parts.push(`<ul>${s.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
      }
      return { title: s?.title || '', html: parts.join('') };
    });
    return { ...block, steps: migrated };
  };

  const migrateArticle = (a) => {
    try {
      if (!a || !Array.isArray(a.content)) return a;
      const newContent = a.content.map((b) => migrateStepsBlock(b));
      return { ...a, content: newContent };
    } catch (e) { return a; }
  };

  const fetchArticle = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`${API}/admin/articles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = migrateArticle(response.data);
      setArticle(data);
      setKeywordInput((data.keywords || []).join(", "));
    } catch (error) {
      console.error("Error fetching article:", error);
      alert("Failed to load article. Please try again.");
      navigate("/admin/articles");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleInputChange = (field, value) => {
    setArticle(prev => ({ ...prev, [field]: value }));
    if (field === "title" && !isEditing) {
      setArticle(prev => ({ ...prev, slug: generateSlug(value) }));
    }
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const updateBlock = (index, updater) => {
    setArticle(prev => {
      const content = [...prev.content];
      const old = content[index] || {};
      content[index] = updater(old);
      return { ...prev, content };
    });
  };

  const handleContentChange = (index, field, value) => {
    const newContent = [...article.content];
    newContent[index] = { ...newContent[index], [field]: value };
    setArticle(prev => ({ ...prev, content: newContent }));
  };

  const addContentBlock = (type = "text") => {
    const newBlock = {
      type,
      content: "",
      alt: "",
      caption: ""
    };
    if (type === 'steps') {
      newBlock.title = '';
      newBlock.steps = [{ title: '', html: '' }];
    }
    if (type === 'accordion') {
      newBlock.items = [{ title: '', content: '' }];
    }
    setArticle(prev => ({
      ...prev,
      content: [...prev.content, newBlock]
    }));
  };

  const removeContentBlock = (index) => {
    if (article.content.length <= 1) return;
    const newContent = article.content.filter((_, i) => i !== index);
    setArticle(prev => ({ ...prev, content: newContent }));
  };

  const moveContentBlock = (index, direction) => {
    const newContent = [...article.content];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newContent.length) return;
    [newContent[index], newContent[newIndex]] = [newContent[newIndex], newContent[index]];
    setArticle(prev => ({ ...prev, content: newContent }));
  };

  const uploadMedia = async (file, contentIndex) => {
    try {
      const token = localStorage.getItem("adminToken");
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post(`${API}/admin/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      handleContentChange(contentIndex, "content", response.data.url);
      alert("File uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    }
  };

  const handleKeywordChange = (value) => {
    setKeywordInput(value);
    const keywords = value
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);
    setArticle(prev => ({ ...prev, keywords }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!article.title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!article.slug.trim()) {
      newErrors.slug = "Slug is required";
    }
    if (!article.category.trim()) {
      newErrors.category = "Category is required";
    }
    if (!article.content.some(block => (block.type === 'text' && (block.content || '').trim()) || (block.type !== 'text'))) {
      newErrors.content = "Article must have some content";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("adminToken");
      const headers = { Authorization: `Bearer ${token}` };
      const payload = migrateArticle(article);
      if (isEditing) {
        await axios.put(`${API}/admin/articles/${id}`, payload, { headers });
        alert("Article updated successfully!");
      } else {
        await axios.post(`${API}/admin/articles`, payload, { headers });
        alert("Article created successfully!");
      }
      navigate("/admin/articles");
    } catch (error) {
      console.error("Error saving article:", error);
      if (error.response?.status === 400 && error.response?.data?.detail?.includes("slug")) {
        setErrors({ slug: "This slug is already in use. Please choose a different one." });
      } else {
        alert("Failed to save article. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const insertFormatting = (index, tag) => {
    const textarea = document.getElementById(`content-${index}`);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    let newText;
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'p') {
      newText = `${before}<${tag}>${selectedText || 'Your text here'}</${tag}>${after}`;
    } else if (tag === 'ul' || tag === 'ol') {
      newText = `${before}<${tag}>
  <li>${selectedText || 'List item'}</li>
</${tag}>${after}`;
    } else if (tag === 'a') {
      newText = `${before}<a href="url">${selectedText || 'Link text'}</a>${after}`;
    } else if (tag === 'code') {
      newText = `${before}<code>${selectedText || 'code'}</code>${after}`;
    } else if (tag === 'table') {
      const tableTpl = `<div class="table-responsive">
  <table class="doc-table">
    <thead>
      <tr>
        <th>Header 1</th>
        <th>Header 2</th>
        <th>Header 3</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Cell 1</td>
        <td>Cell 2</td>
        <td>Cell 3</td>
      </tr>
      <tr>
        <td>Cell 4</td>
        <td>Cell 5</td>
        <td>Cell 6</td>
      </tr>
    </tbody>
  </table>
</div>`;
      newText = `${before}${tableTpl}${after}`;
    } else {
      newText = `${before}<${tag}>${selectedText}</${tag}>${after}`;
    }
    handleContentChange(index, 'content', newText);
  };

  if (loading) {
    return (
      <AdminLayout onLogout={onLogout}>
        <div className="loading" data-testid="editor-loading">
          <div className="spinner"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={onLogout}>
      <div className="article-editor" data-testid="article-editor">
        {/* Header */}
        <div className="editor-header">
          <div className="editor-title-section">
            <button
              onClick={() => navigate("/admin/articles")}
              className="back-btn"
              data-testid="back-to-articles"
            >
              <ArrowLeft size={16} />
              Back to Articles
            </button>
            <h1 className="editor-title">
              {isEditing ? "Edit Article" : "Create Article"}
            </h1>
          </div>
          
          <div className="editor-actions">
            <button
              onClick={() => handleInputChange("published", !article.published)}
              className={`status-btn ${article.published ? 'published' : 'draft'}`}
              data-testid="toggle-publish"
            >
              {article.published ? (
                <>
                  <Eye size={16} />
                  Published
                </>
              ) : (
                <>
                  <EyeOff size={16} />
                  Draft
                </>
              )}
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              data-testid="save-article"
            >
              {saving ? (
                <>
                  <div className="btn-spinner"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? "Update" : "Create"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Important Notice */}
        <div className="info-banner success-banner" data-testid="navigation-reminder">
          <div className="info-icon">✅</div>
          <div className="info-content">
            <strong>Auto-Navigation Enabled:</strong> When you save this article, a navigation item will be 
            automatically created in the sidebar under the <strong>{article.category || 'specified'}</strong> category. 
            You can manage navigation items later in the <strong>Navigation Manager</strong>.
          </div>
        </div>

        <div className="editor-content">
          {/* Basic Information */}
          <div className="editor-section">
            <h2 className="section-title">Basic Information</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  value={article.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className={`form-input ${errors.title ? 'error' : ''}`}
                  placeholder="Enter article title"
                  data-testid="article-title"
                />
                {errors.title && <span className="error-message">{errors.title}</span>}
              </div>
              
              <div className="form-group">
                <label className="form-label">Slug *</label>
                <input
                  type="text"
                  value={article.slug}
                  onChange={(e) => handleInputChange("slug", e.target.value)}
                  className={`form-input ${errors.slug ? 'error' : ''}`}
                  placeholder="article-url-slug"
                  data-testid="article-slug"
                />
                {errors.slug && <span className="error-message">{errors.slug}</span>}
              </div>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <input
                  type="text"
                  value={article.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className={`form-input ${errors.category ? 'error' : ''}`}
                  placeholder="e.g., Getting Started, API, Guides"
                  data-testid="article-category"
                />
                {errors.category && <span className="error-message">{errors.category}</span>}
              </div>
              
              <div className="form-group">
                <label className="form-label">Order</label>
                <input
                  type="number"
                  value={article.order}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleInputChange("order", value === "" ? 0 : parseInt(value));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="form-input"
                  min="0"
                  placeholder="0"
                  data-testid="article-order"
                />
              </div>
            </div>
          </div>

          {/* SEO Information */}
          <div className="editor-section">
            <h2 className="section-title">SEO &amp; Metadata</h2>
            
            <div className="form-group">
              <label className="form-label">Meta Description</label>
              <textarea
                value={article.meta_description}
                onChange={(e) => handleInputChange("meta_description", e.target.value)}
                className="form-textarea"
                placeholder="Brief description for search engines..."
                rows={3}
                maxLength={160}
                data-testid="meta-description"
              />
              <small className="form-help">
                {article.meta_description.length}/160 characters
              </small>
            </div>
            
            <div className="form-group">
              <label className="form-label">Keywords</label>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => handleKeywordChange(e.target.value)}
                className="form-input"
                placeholder="keyword1, keyword2, keyword3"
                data-testid="article-keywords"
              />
              <small className="form-help">
                Separate keywords with commas
              </small>
            </div>
          </div>

          {/* Content */}
          <div className="editor-section">
            <h2 className="section-title">Content</h2>
            {errors.content && <span className="error-message">{errors.content}</span>}
            
            {article.content.map((block, index) => (
              <div key={index} className="content-block" data-testid={`content-block-${index}`}>
                <div className="content-block-header">
                  <select
                    value={block.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateBlock(index, (old) => {
                        const next = { ...old, type: val };
                        if (val === 'steps' && !Array.isArray(next.steps)) {
                          next.title = next.title || '';
                          next.steps = [{ title: '', html: '' }];
                        }
                        if (val === 'accordion' && !Array.isArray(next.items)) {
                          next.items = [{ title: '', content: '' }];
                        }
                        return next;
                      });
                    }}
                    className="content-type-select"
                    data-testid={`content-type-${index}`}
                  >
                    <option value="text">Rich Text</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="embed">Embed/HTML</option>
                    <option value="steps">Steps</option>
                    <option value="accordion">Accordion</option>
                    <option value="integrations">Integrations Grid</option>
                    <option value="article-links">Article Links</option>
                  </select>
                  
                  <div className="content-block-actions">
                    {index > 0 && (
                      <button
                        onClick={() => moveContentBlock(index, "up")}
                        className="action-btn"
                        title="Move Up"
                      >
                        ↑
                      </button>
                    )}
                    {index < article.content.length - 1 && (
                      <button
                        onClick={() => moveContentBlock(index, "down")}
                        className="action-btn"
                        title="Move Down"
                      >
                        ↓
                      </button>
                    )}
                    {article.content.length > 1 && (
                      <button
                        onClick={() => removeContentBlock(index)}
                        className="action-btn delete"
                        title="Remove Block"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="content-block-content">
                  {block.type === "text" && (
                    <div className="html-editor">
                      <div className="editor-toolbar">
                        <button type="button" onClick={() => insertFormatting(index, 'h1')} className="toolbar-btn" title="Heading 1">H1</button>
                        <button type="button" onClick={() => insertFormatting(index, 'h2')} className="toolbar-btn" title="Heading 2">H2</button>
                        <button type="button" onClick={() => insertFormatting(index, 'h3')} className="toolbar-btn" title="Heading 3">H3</button>
                        <button type="button" onClick={() => insertFormatting(index, 'p')} className="toolbar-btn" title="Paragraph">P</button>
                        <button type="button" onClick={() => insertFormatting(index, 'strong')} className="toolbar-btn" title="Bold"><strong>B</strong></button>
                        <button type="button" onClick={() => insertFormatting(index, 'em')} className="toolbar-btn" title="Italic"><em>I</em></button>
                        <button type="button" onClick={() => insertFormatting(index, 'ul')} className="toolbar-btn" title="Bullet List">UL</button>
                        <button type="button" onClick={() => insertFormatting(index, 'ol')} className="toolbar-btn" title="Numbered List">OL</button>
                        <button type="button" onClick={() => insertFormatting(index, 'a')} className="toolbar-btn" title="Link"><LinkIcon size={14} /></button>
                        <button type="button" onClick={() => insertFormatting(index, 'code')} className="toolbar-btn" title="Code">{'</>'}</button>
                        <button type="button" onClick={() => insertFormatting(index, 'table')} className="toolbar-btn" title="Insert table">Table</button>
                      </div>
                      <textarea
                        id={`content-${index}`}
                        value={block.content}
                        onChange={(e) => handleContentChange(index, "content", e.target.value)}
                        className="html-textarea"
                        placeholder="Write your content here using HTML tags... Use the buttons above to insert formatting."
                        rows={15}
                      />
                      <div className="editor-help">
                        <small>You can write HTML directly or use the buttons above to insert tags. Example: {'<p>'}Your text{'</p>'}</small>
                      </div>
                    </div>
                  )}
                  
                  {(block.type === "image" || block.type === "video") && (
                    <div className="media-input">
                      <input
                        type="text"
                        value={block.content}
                        onChange={(e) => handleContentChange(index, "content", e.target.value)}
                        className="form-input"
                        placeholder={
                          block.type === "video" 
                            ? "Enter video URL (YouTube, Vimeo, or direct .mp4 link)" 
                            : "Enter image URL or upload file"
                        }
                      />
                      
                      {block.type === "video" && (
                        <div className="field-help">
                          <small>
                            💡 <strong>Video URLs:</strong> Paste YouTube (youtube.com/watch?v=...), 
                            Vimeo (vimeo.com/...), or direct video file URLs. YouTube and Vimeo links 
                            will be automatically converted to embeds.
                          </small>
                        </div>
                      )}
                      
                      <div className="media-actions">
                        <label className="upload-btn">
                          <Upload size={16} />
                          Upload File
                          <input
                            type="file"
                            accept={block.type === "image" ? "image/*" : "video/*"}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) uploadMedia(file, index);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                      
                      <input
                        type="text"
                        value={block.alt || ""}
                        onChange={(e) => handleContentChange(index, "alt", e.target.value)}
                        className="form-input"
                        placeholder="Alt text (for accessibility)"
                      />
                      
                      <input
                        type="text"
                        value={block.caption || ""}
                        onChange={(e) => handleContentChange(index, "caption", e.target.value)}
                        className="form-input"
                        placeholder="Caption (optional)"
                      />
                    </div>
                  )}
                  
                  {block.type === "embed" && (
                    <div className="embed-input">
                      <textarea
                        value={block.content}
                        onChange={(e) => handleContentChange(index, "content", e.target.value)}
                        className="form-textarea"
                        placeholder="Paste embed code or HTML here..."
                        rows={4}
                      />
                      <input
                        type="text"
                        value={block.caption || ""}
                        onChange={(e) => handleContentChange(index, "caption", e.target.value)}
                        className="form-input"
                        placeholder="Caption (optional)"
                      />
                    </div>
                  )}

                  {block.type === "steps" && (
                    <div className="steps-editor">
                      <div className="form-group">
                        <label className="form-label">Section Title (H2)</label>
                        <input
                          type="text"
                          value={block.title || ''}
                          onChange={(e) => handleContentChange(index, 'title', e.target.value)}
                          className="form-input"
                          placeholder="e.g., Getting set up"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Steps</label>
                        <div className="steps-list-editor">
                          {Array.isArray(block.steps) && block.steps.length > 0 ? block.steps.map((s, i) => (
                            <div key={i} className="step-edit-card">
                              <div className="form-row">
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder={`Step ${i+1} name`}
                                  value={s.title || ''}
                                  onChange={(e) => {
                                    const steps = [...(block.steps || [])];
                                    steps[i] = { ...(steps[i] || {}), title: e.target.value };
                                    handleContentChange(index, 'steps', steps);
                                  }}
                                />
                              </div>
                              <StepRichEditor
                                value={typeof s?.html === 'string' ? s.html : ''}
                                onChange={(html) => {
                                  const steps = [...(block.steps || [])];
                                  steps[i] = { ...(steps[i] || {}), html };
                                  handleContentChange(index, 'steps', steps);
                                }}
                                placeholder="Write rich content for this step. Use H3 for subheadings if needed."
                              />
                              <div className="content-block-actions">
                                {i > 0 && (
                                  <button onClick={() => {
                                    const steps = [...(block.steps || [])];
                                    [steps[i-1], steps[i]] = [steps[i], steps[i-1]];
                                    handleContentChange(index, 'steps', steps);
                                  }} className="action-btn" title="Move Up">↑</button>
                                )}
                                {i < (block.steps?.length || 0) - 1 && (
                                  <button onClick={() => {
                                    const steps = [...(block.steps || [])];
                                    [steps[i+1], steps[i]] = [steps[i], steps[i+1]];
                                    handleContentChange(index, 'steps', steps);
                                  }} className="action-btn" title="Move Down">↓</button>
                                )}
                                <button onClick={() => {
                                  const steps = (block.steps || []).filter((_, j) => j !== i);
                                  handleContentChange(index, 'steps', steps);
                                }} className="action-btn delete" title="Remove Step">✕</button>
                              </div>
                            </div>
                          )) : <div className="field-help"><small>No steps yet. Add one below.</small></div>}
                          <button onClick={() => {
                            const steps = [...(block.steps || [])];
                            if (steps.length >= 10) return alert('Max 10 steps allowed');
                            steps.push({ title: '', html: '' });
                            handleContentChange(index, 'steps', steps);
                          }} className="add-content-btn">+ Add Step</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === "integrations" && (
                    <div className="integrations-editor">
                      <div className="form-group">
                        <label className="form-label">Section Title (H2)</label>
                        <input
                          type="text"
                          value={block.title || ''}
                          onChange={(e) => handleContentChange(index, 'title', e.target.value)}
                          className="form-input"
                          placeholder="e.g., Verified Integrations"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Columns</label>
                        <select
                          value={Number(block.columns) === 3 ? 3 : 2}
                          onChange={(e)=> handleContentChange(index, 'columns', parseInt(e.target.value))}
                          className="form-input"
                        >
                          <option value={2}>2 per row</option>
                          <option value={3}>3 per row</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description (optional)</label>
                        <textarea
                          value={block.description || ''}
                          onChange={(e) => handleContentChange(index, 'description', e.target.value)}
                          className="form-textarea"
                          placeholder="Short blurb under the title"
                          rows={2}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Integrations</label>
                        <div className="integrations-list-editor">
                          {Array.isArray(block.items) && block.items.length > 0 ? block.items.map((it, i) => (
                            <div key={i} className="integration-edit-card">
                              <div className="form-row">
                                <input type="text" className="form-input" placeholder="Name" value={it.name || ''} onChange={(e)=>{
                                  const items = [...(block.items || [])];
                                  items[i] = { ...items[i], name: e.target.value };
                                  handleContentChange(index, 'items', items);
                                }} />
                                <select className="form-input" value={it.icon || ''} onChange={(e)=>{
                                  const items = [...(block.items || [])];
                                  items[i] = { ...items[i], icon: e.target.value };
                                  handleContentChange(index, 'items', items);
                                }}>
                                  <option value="">Choose icon</option>
                                  <option value="stripe">Stripe</option>
                                  <option value="openai">OpenAI</option>
                                  <option value="anthropic">Anthropic</option>
                                  <option value="resend">Resend</option>
                                  <option value="clerk">Clerk</option>
                                  <option value="three">Three.js</option>
                                  <option value="d3">D3.js</option>
                                  <option value="highcharts">Highcharts</option>
                                  <option value="p5">p5.js</option>
                                </select>
                              </div>
                              <div className="form-row">
                                <input type="text" className="form-input" placeholder="Summary" value={it.summary || ''} onChange={(e)=>{
                                  const items = [...(block.items || [])];
                                  items[i] = { ...items[i], summary: e.target.value };
                                  handleContentChange(index, 'items', items);
                                }} />
                              </div>
                              <div className="form-row">
                                <input type="url" className="form-input" placeholder="https://..." value={it.url || ''} onChange={(e)=>{
                                  const items = [...(block.items || [])];
                                  items[i] = { ...items[i], url: e.target.value };
                                  handleContentChange(index, 'items', items);
                                }} />
                              </div>
                              <div className="content-block-actions">
                                {i > 0 && (
                                  <button onClick={() => { const items = [...(block.items || [])]; [items[i-1], items[i]] = [items[i], items[i-1]]; handleContentChange(index, 'items', items); }} className="action-btn" title="Move Up">↑</button>
                                )}
                                {i < (block.items?.length || 0) - 1 && (
                                  <button onClick={() => { const items = [...(block.items || [])]; [items[i+1], items[i]] = [items[i], items[i+1]]; handleContentChange(index, 'items', items); }} className="action-btn" title="Move Down">↓</button>
                                )}
                                <button onClick={() => { const items = (block.items || []).filter((_, j) => j !== i); handleContentChange(index, 'items', items); }} className="action-btn delete" title="Remove">✕</button>
                              </div>
                            </div>
                          )) : <div className="field-help"><small>No integrations yet. Add one below.</small></div>}
                          <button onClick={() => {
                            const items = [...(block.items || [])];
                            if (items.length >= 12) return alert('Max 12 integrations allowed');
                            items.push({ name: '', summary: '', url: '', icon: '', verified: true });
                            handleContentChange(index, 'items', items);
                          }} className="add-content-btn">+ Add Integration</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === "article-links" && (
                    <div className="article-links-editor">
                      <div className="form-group">
                        <label className="form-label">Section Title (H2)</label>
                        <input type="text" className="form-input" value={block.title || ''} onChange={(e)=>handleContentChange(index,'title',e.target.value)} placeholder="Related articles" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Columns</label>
                        <select className="form-input" value={Number(block.columns)===2?2:3} onChange={(e)=>handleContentChange(index,'columns',parseInt(e.target.value))}>
                          <option value={3}>3 per row</option>
                          <option value={2}>2 per row</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Links</label>
                        <div className="al-list-editor">
                          {Array.isArray(block.items) && block.items.length>0 ? block.items.map((it,i)=> (
                            <div key={i} className="al-edit-card">
                              <div className="form-row">
                                <select className="form-input" value={it.slug || ''} onChange={(e)=>{
                                  const items=[...(block.items||[])];
                                  items[i] = { ...items[i], slug: e.target.value, url: '' };
                                  handleContentChange(index,'items',items);
                                }}>
                                  <option value="">Select internal article…</option>
                                  {(Array.isArray(article?.allArticles) ? article.allArticles : []).map(a=> (
                                    <option key={a.slug} value={a.slug}>{a.title}</option>
                                  ))}
                                </select>
                                <input type="url" className="form-input" placeholder="or external URL https://..." value={it.url || ''} onChange={(e)=>{
                                  const items=[...(block.items||[])];
                                  items[i] = { ...items[i], url: e.target.value, slug: '' };
                                  handleContentChange(index,'items',items);
                                }} />
                              </div>
                              <div className="form-row">
                                <input type="text" className="form-input" placeholder="Display title (leave blank to use article title)" value={it.title || ''} onChange={(e)=>{ const items=[...(block.items||[])]; items[i] = { ...items[i], title: e.target.value }; handleContentChange(index,'items',items); }} />
                              </div>
                              <div className="form-row">
                                <textarea className="form-textarea" placeholder="Short description" rows={2} value={it.description || ''} onChange={(e)=>{ const items=[...(block.items||[])]; items[i] = { ...items[i], description: e.target.value }; handleContentChange(index,'items',items); }} />
                              </div>
                              <div className="form-row">
                                <select className="form-input" value={it.icon || ''} onChange={(e)=>{ const items=[...(block.items||[])]; items[i] = { ...items[i], icon: e.target.value, iconUrl: '' }; handleContentChange(index,'items',items); }}>
                                  <option value="">Choose built-in icon</option>
                                  <option value="document">Document</option>
                                  <option value="link">Link</option>
                                  <option value="book">Book</option>
                                  <option value="lightbulb">Lightbulb</option>
                                  <option value="play">Play</option>
                                  <option value="code">Code</option>
                                  <option value="shield">Shield</option>
                                  <option value="cog">Cog</option>
                                  <option value="bolt">Bolt</option>
                                </select>
                                <label className="upload-btn">
                                  Upload Icon
                                  <input type="file" accept="image/*" className="hidden" onChange={async (e)=>{
                                    const file = e.target.files && e.target.files[0];
                                    if (!file) return;
                                    try {
                                      const token = localStorage.getItem('adminToken');
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      const resp = await axios.post(`${API}/admin/upload`, formData, { headers: { Authorization: `Bearer ${token}`,'Content-Type':'multipart/form-data' } });
                                      const items=[...(block.items||[])];
                                      items[i] = { ...items[i], iconUrl: resp.data.url, icon: '' };
                                      handleContentChange(index,'items',items);
                                    } catch(err) { alert('Upload failed'); }
                                  }} />
                                </label>
                              </div>
                              <div className="content-block-actions">
                                {i>0 && <button className="action-btn" onClick={()=>{ const items=[...(block.items||[])]; [items[i-1],items[i]]=[items[i],items[i-1]]; handleContentChange(index,'items',items); }}>↑</button>}
                                {i < (block.items?.length||0)-1 && <button className="action-btn" onClick={()=>{ const items=[...(block.items||[])]; [items[i+1],items[i]]=[items[i],items[i+1]]; handleContentChange(index,'items',items); }}>↓</button>}
                                <button className="action-btn delete" onClick={()=>{ const items=(block.items||[]).filter((_,j)=>j!==i); handleContentChange(index,'items',items); }}>✕</button>
                              </div>
                            </div>
                          )) : <div className="field-help"><small>No links yet. Add one below.</small></div>}
                          <button className="add-content-btn" onClick={()=>{ const items=[...(block.items||[])]; items.push({ slug:'', url:'', title:'', description:'', icon:'document', iconUrl:'' }); handleContentChange(index,'items',items); }}>+ Add Link</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === "accordion" && (
                    <div className="accordion-editor">
                      <div className="form-group">
                        <label className="form-label">Accordion Items</label>
                        <div className="accordion-list-editor">
                          {Array.isArray(block.items) && block.items.length > 0 ? block.items.map((item, i) => (
                            <div key={i} className="accordion-edit-card">
                              <div className="form-row">
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder={`Item ${i+1} title`}
                                  value={item.title || ''}
                                  onChange={(e) => {
                                    const items = [...(block.items || [])];
                                    items[i] = { ...(items[i] || {}), title: e.target.value };
                                    handleContentChange(index, 'items', items);
                                  }}
                                />
                              </div>
                              <AccordionRichEditor
                                value={typeof item?.content === 'string' ? item.content : ''}
                                onChange={(content) => {
                                  const items = [...(block.items || [])];
                                  items[i] = { ...(items[i] || {}), content };
                                  handleContentChange(index, 'items', items);
                                }}
                                placeholder="Enter content for this accordion item. Use formatting buttons above."
                              />
                              <div className="content-block-actions">
                                {i > 0 && (
                                  <button onClick={() => {
                                    const items = [...(block.items || [])];
                                    [items[i-1], items[i]] = [items[i], items[i-1]];
                                    handleContentChange(index, 'items', items);
                                  }} className="action-btn" title="Move Up">↑</button>
                                )}
                                {i < (block.items?.length || 0) - 1 && (
                                  <button onClick={() => {
                                    const items = [...(block.items || [])];
                                    [items[i+1], items[i]] = [items[i], items[i+1]];
                                    handleContentChange(index, 'items', items);
                                  }} className="action-btn" title="Move Down">↓</button>
                                )}
                                <button onClick={() => {
                                  const items = (block.items || []).filter((_, j) => j !== i);
                                  handleContentChange(index, 'items', items);
                                }} className="action-btn delete" title="Remove Item">✕</button>
                              </div>
                            </div>
                          )) : <div className="field-help"><small>No accordion items yet. Add one below.</small></div>}
                          <button onClick={() => {
                            const items = [...(block.items || [])];
                            if (items.length >= 10) return alert('Max 10 accordion items allowed');
                            items.push({ title: '', content: '' });
                            handleContentChange(index, 'items', items);
                          }} className="add-content-btn">+ Add Accordion Item</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <div className="add-content-buttons">
              <button onClick={() => addContentBlock("text")} className="add-content-btn" data-testid="add-text-block">+ Add Text</button>
              <button onClick={() => addContentBlock("image")} className="add-content-btn" data-testid="add-image-block">+ Add Image</button>
              <button onClick={() => addContentBlock("video")} className="add-content-btn" data-testid="add-video-block">+ Add Video</button>
              <button onClick={() => addContentBlock("embed")} className="add-content-btn" data-testid="add-embed-block">+ Add Embed</button>
              <button onClick={() => addContentBlock("steps")} className="add-content-btn">+ Add Steps</button>
              <button onClick={() => addContentBlock("accordion")} className="add-content-btn">+ Add Accordion</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ArticleEditor;
