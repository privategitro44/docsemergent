import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { Save, ArrowLeft, Upload, Link as LinkIcon, Eye, EyeOff, X, ArrowUp, ArrowDown } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  const fetchArticle = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`${API}/articles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArticle(response.data);
      setKeywordInput(response.data.keywords.join(", "));
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
    
    // Auto-generate slug from title
    if (field === "title" && !isEditing) {
      setArticle(prev => ({ ...prev, slug: generateSlug(value) }));
    }
    
    // Clear errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
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
      
      // Update content with uploaded file URL
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
    
    if (!article.content.some(block => block.content.trim())) {
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
      
      if (isEditing) {
        await axios.put(`${API}/admin/articles/${id}`, article, { headers });
        alert("Article updated successfully!");
      } else {
        await axios.post(`${API}/admin/articles`, article, { headers });
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

  // Simple HTML formatting helper
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
      newText = `${before}<${tag}>\n  <li>${selectedText || 'List item'}</li>\n</${tag}>${after}`;
    } else if (tag === 'a') {
      newText = `${before}<a href="url">${selectedText || 'Link text'}</a>${after}`;
    } else if (tag === 'code') {
      newText = `${before}<code>${selectedText || 'code'}</code>${after}`;
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
        <div className="info-banner" data-testid="navigation-reminder">
          <div className="info-icon">ℹ️</div>
          <div className="info-content">
            <strong>Important:</strong> After creating this article, you need to add it to the Navigation Manager 
            so it appears in the sidebar for users. Go to <strong>Navigation</strong> → <strong>Add Navigation Item</strong> 
            → Set type to "article" and target to your article slug.
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
                  onChange={(e) => handleInputChange("order", parseInt(e.target.value) || 0)}
                  className="form-input"
                  min="0"
                  data-testid="article-order"
                />
              </div>
            </div>
          </div>

          {/* SEO Information */}
          <div className="editor-section">
            <h2 className="section-title">SEO & Metadata</h2>
            
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
                    onChange={(e) => handleContentChange(index, "type", e.target.value)}
                    className="content-type-select"
                    data-testid={`content-type-${index}`}
                  >
                    <option value="text">Rich Text</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="embed">Embed/HTML</option>
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
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'h1')}
                          className="toolbar-btn"
                          title="Heading 1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'h2')}
                          className="toolbar-btn"
                          title="Heading 2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'h3')}
                          className="toolbar-btn"
                          title="Heading 3"
                        >
                          H3
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'p')}
                          className="toolbar-btn"
                          title="Paragraph"
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'strong')}
                          className="toolbar-btn"
                          title="Bold"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'em')}
                          className="toolbar-btn"
                          title="Italic"
                        >
                          <em>I</em>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'ul')}
                          className="toolbar-btn"
                          title="Bullet List"
                        >
                          UL
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'ol')}
                          className="toolbar-btn"
                          title="Numbered List"
                        >
                          OL
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'a')}
                          className="toolbar-btn"
                          title="Link"
                        >
                          <LinkIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting(index, 'code')}
                          className="toolbar-btn"
                          title="Code"
                        >
                          &lt;/&gt;
                        </button>
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
                        <small>You can write HTML directly or use the buttons above to insert tags. Example: &lt;p&gt;Your text&lt;/p&gt;</small>
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
                        placeholder={`Enter ${block.type} URL or upload file`}
                      />
                      
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
                </div>
              </div>
            ))}
            
            <div className="add-content-buttons">
              <button
                onClick={() => addContentBlock("text")}
                className="add-content-btn"
                data-testid="add-text-block"
              >
                + Add Text
              </button>
              <button
                onClick={() => addContentBlock("image")}
                className="add-content-btn"
                data-testid="add-image-block"
              >
                + Add Image
              </button>
              <button
                onClick={() => addContentBlock("video")}
                className="add-content-btn"
                data-testid="add-video-block"
              >
                + Add Video
              </button>
              <button
                onClick={() => addContentBlock("embed")}
                className="add-content-btn"
                data-testid="add-embed-block"
              >
                + Add Embed
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ArticleEditor;
