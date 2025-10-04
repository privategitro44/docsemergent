from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
import jwt
import hashlib
import aiofiles
from urllib.parse import unquote

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)

# Security
security = HTTPBearer()
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = hashlib.sha256("admin123".encode()).hexdigest()

# Create the main app
app = FastAPI(title="Emergent Documentation System")

# Static files for uploads
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Create API router
api_router = APIRouter(prefix="/api")

# Pydantic Models
class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ArticleContent(BaseModel):
    type: str  # 'text', 'image', 'video', 'embed'
    content: str
    alt: Optional[str] = None
    caption: Optional[str] = None

class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    slug: str
    content: List[ArticleContent]
    category: str
    order: int = 0
    meta_description: Optional[str] = None
    keywords: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    published: bool = True

class ArticleCreate(BaseModel):
    title: str
    slug: str
    content: List[ArticleContent]
    category: str
    order: int = 0
    meta_description: Optional[str] = None
    keywords: List[str] = []
    published: bool = True

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[List[ArticleContent]] = None
    category: Optional[str] = None
    order: Optional[int] = None
    meta_description: Optional[str] = None
    keywords: Optional[List[str]] = None
    published: Optional[bool] = None

class NavigationItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    type: str  # 'category', 'article', 'link'
    target: Optional[str] = None  # article slug or external URL
    parent_id: Optional[str] = None
    order: int = 0
    icon: Optional[str] = None

class NavigationCreate(BaseModel):
    label: str
    type: str
    target: Optional[str] = None
    parent_id: Optional[str] = None
    order: int = 0
    icon: Optional[str] = None

class SearchResult(BaseModel):
    id: str
    title: str
    slug: str
    category: str
    snippet: str
    relevance: float

# Helper Functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username != ADMIN_USERNAME:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def prepare_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, list):
                result[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, dict):
                result[key] = prepare_for_mongo(value)
            else:
                result[key] = value
        return result
    return data

def parse_from_mongo(item: Dict[str, Any]) -> Dict[str, Any]:
    """Convert ISO strings back to datetime objects from MongoDB"""
    if isinstance(item, dict):
        result = {}
        for key, value in item.items():
            if key in ['created_at', 'updated_at'] and isinstance(value, str):
                try:
                    result[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    result[key] = value
            elif isinstance(value, list):
                result[key] = [parse_from_mongo(subitem) if isinstance(subitem, dict) else subitem for subitem in value]
            elif isinstance(value, dict):
                result[key] = parse_from_mongo(value)
            else:
                result[key] = value
        return result
    return item

# Authentication Routes
@api_router.post("/admin/login", response_model=Token)
async def admin_login(credentials: AdminLogin):
    password_hash = hashlib.sha256(credentials.password.encode()).hexdigest()
    if credentials.username != ADMIN_USERNAME or password_hash != ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": credentials.username})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/admin/verify")
async def verify_admin(current_admin: str = Depends(get_current_admin)):
    return {"valid": True, "username": current_admin}

# Article Routes
@api_router.get("/articles", response_model=List[Article])
async def get_articles(published_only: bool = True):
    filter_query = {"published": True} if published_only else {}
    articles = await db.articles.find(filter_query).sort([("category", 1), ("order", 1)]).to_list(1000)
    return [Article(**parse_from_mongo(article)) for article in articles]

@api_router.get("/articles/{slug}", response_model=Article)
async def get_article(slug: str):
    article = await db.articles.find_one({"slug": slug})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return Article(**parse_from_mongo(article))

@api_router.get("/admin/articles/{article_id}", response_model=Article)
async def get_article_by_id(article_id: str, current_admin: str = Depends(get_current_admin)):
    article = await db.articles.find_one({"id": article_id})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return Article(**parse_from_mongo(article))

@api_router.post("/admin/articles", response_model=Article)
async def create_article(article: ArticleCreate, current_admin: str = Depends(get_current_admin)):
    # Check if slug already exists
    existing = await db.articles.find_one({"slug": article.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Article with this slug already exists")
    
    article_obj = Article(**article.dict())
    article_dict = prepare_for_mongo(article_obj.dict())
    await db.articles.insert_one(article_dict)
    
    # Automatically create navigation item for the new article
    try:
        # Find or create category based on article category
        category_nav = await db.navigation.find_one({
            "type": "category",
            "label": article.category.upper()
        })
        
        parent_id = None
        if category_nav:
            parent_id = category_nav["id"]
        else:
            # Create new category if it doesn't exist
            new_category = {
                "id": str(uuid.uuid4()),
                "label": article.category.upper(),
                "type": "category",
                "target": None,
                "parent_id": None,
                "order": 1000,  # Put new categories at the end
                "icon": None
            }
            await db.navigation.insert_one(new_category)
            parent_id = new_category["id"]
        
        # Get the highest order in this category
        existing_nav = await db.navigation.find({"parent_id": parent_id}).sort("order", -1).limit(1).to_list(1)
        next_order = (existing_nav[0]["order"] + 1) if existing_nav else 1
        
        # Create navigation item for the article
        nav_item = {
            "id": str(uuid.uuid4()),
            "label": article.title,
            "type": "article",
            "target": article.slug,
            "parent_id": parent_id,
            "order": next_order,
            "icon": None
        }
        await db.navigation.insert_one(nav_item)
        logger.info(f"Auto-created navigation item for article: {article.title}")
    except Exception as e:
        logger.error(f"Failed to auto-create navigation item: {e}")
        # Don't fail article creation if navigation fails
    
    return article_obj

@api_router.put("/admin/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, article_update: ArticleUpdate, current_admin: str = Depends(get_current_admin)):
    article = await db.articles.find_one({"id": article_id})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    update_data = {k: v for k, v in article_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        prepared_data = prepare_for_mongo(update_data)
        await db.articles.update_one({"id": article_id}, {"$set": prepared_data})
    
    updated_article = await db.articles.find_one({"id": article_id})
    return Article(**parse_from_mongo(updated_article))

@api_router.delete("/admin/articles/{article_id}")
async def delete_article(article_id: str, current_admin: str = Depends(get_current_admin)):
    # Get article before deletion to find its slug
    article = await db.articles.find_one({"id": article_id})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Delete the article
    result = await db.articles.delete_one({"id": article_id})
    
    # Also delete associated navigation item
    try:
        await db.navigation.delete_one({"target": article["slug"], "type": "article"})
        logger.info(f"Deleted navigation item for article: {article['slug']}")
    except Exception as e:
        logger.error(f"Failed to delete navigation item: {e}")
    
    return {"message": "Article deleted successfully"}

# Navigation Routes
@api_router.get("/navigation", response_model=List[NavigationItem])
async def get_navigation():
    nav_items = await db.navigation.find().sort("order", 1).to_list(1000)
    return [NavigationItem(**item) for item in nav_items]

@api_router.post("/admin/navigation", response_model=NavigationItem)
async def create_navigation_item(nav_item: NavigationCreate, current_admin: str = Depends(get_current_admin)):
    nav_obj = NavigationItem(**nav_item.dict())
    await db.navigation.insert_one(nav_obj.dict())
    return nav_obj

@api_router.put("/admin/navigation/{nav_id}", response_model=NavigationItem)
async def update_navigation_item(nav_id: str, nav_update: NavigationCreate, current_admin: str = Depends(get_current_admin)):
    result = await db.navigation.update_one({"id": nav_id}, {"$set": nav_update.dict()})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Navigation item not found")
    
    updated_nav = await db.navigation.find_one({"id": nav_id})
    return NavigationItem(**updated_nav)

@api_router.delete("/admin/navigation/{nav_id}")
async def delete_navigation_item(nav_id: str, current_admin: str = Depends(get_current_admin)):
    result = await db.navigation.delete_one({"id": nav_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Navigation item not found")
    return {"message": "Navigation item deleted successfully"}

# Media Upload Routes
@api_router.post("/admin/upload")
async def upload_media(file: UploadFile = File(...), current_admin: str = Depends(get_current_admin)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = uploads_dir / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as buffer:
        content = await file.read()
        await buffer.write(content)
    
    # Return file URL
    file_url = f"/uploads/{unique_filename}"
    return {"url": file_url, "filename": unique_filename}

# Search Routes
@api_router.get("/search", response_model=List[SearchResult])
async def search_articles(q: str, limit: int = 10):
    if not q or len(q.strip()) < 2:
        return []
    
    search_query = {
        "$and": [
            {"published": True},
            {
                "$or": [
                    {"title": {"$regex": q, "$options": "i"}},
                    {"content.content": {"$regex": q, "$options": "i"}},
                    {"keywords": {"$in": [q]}}
                ]
            }
        ]
    }
    
    articles = await db.articles.find(search_query).limit(limit).to_list(limit)
    results = []
    
    for article in articles:
        # Create snippet from content
        content_text = ""
        for content_item in article.get("content", []):
            if content_item.get("type") == "text":
                content_text += content_item.get("content", "") + " "
        
        snippet = content_text[:200] + "..." if len(content_text) > 200 else content_text
        relevance = 1.0  # Simple relevance for now
        
        results.append(SearchResult(
            id=article["id"],
            title=article["title"],
            slug=article["slug"],
            category=article["category"],
            snippet=snippet,
            relevance=relevance
        ))
    
    return results

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create sample data if none exists
    article_count = await db.articles.count_documents({})
    if article_count == 0:
        await create_sample_data()
    logger.info("Emergent Documentation System started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Sample Data Creation
async def create_sample_data():
    """Create comprehensive sample content"""
    
    # Sample articles with rich content
    sample_articles = [
        {
            "id": str(uuid.uuid4()),
            "title": "Welcome to Emergent",
            "slug": "welcome",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Welcome to Emergent Documentation</h1><p>Emergent is a powerful, modern documentation platform designed for teams that want to create beautiful, searchable documentation with ease. Built with a comprehensive Content Management System (CMS), it enables you to manage your documentation efficiently.</p><h2>Why Emergent?</h2><p>We built Emergent to solve common documentation challenges:</p><ul><li><strong>Easy Content Management:</strong> Update documentation without touching code</li><li><strong>Rich Media Support:</strong> Include images, videos, and embedded content</li><li><strong>Fast Search:</strong> Help users find what they need instantly</li><li><strong>Clean Design:</strong> Professional, corporate aesthetic that builds trust</li></ul><h2>Key Features</h2><p>Emergent comes with everything you need:</p><blockquote><p>\"Documentation is a love letter that you write to your future self.\" - Damian Conway</p></blockquote><p>Start by exploring the guides in the sidebar, or jump directly to <a href=\"/article/quick-start\">Quick Start Guide</a>.</p>"
                }
            ],
            "category": "Introduction",
            "order": 1,
            "meta_description": "Welcome to Emergent documentation platform",
            "keywords": ["welcome", "introduction", "emergent", "documentation"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Quick Start Guide",
            "slug": "quick-start",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Quick Start Guide</h1><p>Get up and running with Emergent in less than 5 minutes. This guide will walk you through the essential steps to start creating your documentation.</p><h2>Step 1: Access the Admin Panel</h2><p>Navigate to <code>/admin/login</code> and use your credentials to log in to the CMS.</p><p>Default credentials:</p><ul><li>Username: <code>admin</code></li><li>Password: <code>admin123</code></li></ul><h2>Step 2: Create Your First Article</h2><p>Once logged in, you can create articles with rich content including:</p><ol><li>Rich text with HTML formatting</li><li>Images from uploads or external URLs</li><li>Videos (uploaded or embedded)</li><li>Code snippets with syntax highlighting</li></ol><h2>Step 3: Organize Navigation</h2><p>Use the Navigation Manager to structure your documentation:</p><ul><li>Create categories for grouping content</li><li>Add article links</li><li>Include external resources</li><li>Reorder items with drag and drop</li></ul><h2>Step 4: Publish and Share</h2><p>Once your content is ready, publish it and share the documentation with your team. All changes are reflected instantly.</p><h3>Pro Tips</h3><blockquote><p>Use descriptive slugs for better SEO and user experience. Keep titles concise and descriptive.</p></blockquote>"
                }
            ],
            "category": "Introduction",
            "order": 2,
            "meta_description": "Get started with Emergent in 5 minutes",
            "keywords": ["quick start", "getting started", "tutorial", "setup"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Content Management",
            "slug": "content-management",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Content Management</h1><p>Learn how to effectively manage your documentation content using the Emergent CMS.</p><h2>Article Structure</h2><p>Each article in Emergent consists of:</p><ul><li><strong>Title:</strong> The main heading displayed to users</li><li><strong>Slug:</strong> URL-friendly identifier for the article</li><li><strong>Content:</strong> Mixed media content blocks</li><li><strong>Category:</strong> Organizational grouping</li><li><strong>Metadata:</strong> SEO description and keywords</li></ul><h2>Content Types</h2><h3>Text Content</h3><p>Use HTML to format your text content. Supported elements include headings, paragraphs, lists, links, and more.</p><h3>Images</h3><p>Add images by uploading them directly or providing external URLs. Each image can have:</p><ul><li>Alt text for accessibility</li><li>Caption for context</li><li>Automatic responsive sizing</li></ul><h3>Videos</h3><p>Include videos in two ways:</p><ol><li><strong>Upload:</strong> Upload MP4 files directly to the system</li><li><strong>Embed:</strong> Use iframe embeds from YouTube, Vimeo, etc.</li></ol><h2>Publishing Workflow</h2><p>Articles can be saved as drafts or published immediately. Unpublished articles are only visible in the admin panel.</p><blockquote><p>Tip: Use the draft feature to prepare content in advance and publish when ready.</p></blockquote>"
                }
            ],
            "category": "Features",
            "order": 3,
            "meta_description": "Manage your documentation content effectively",
            "keywords": ["content", "management", "cms", "articles"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Navigation Setup",
            "slug": "navigation-setup",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Navigation Setup</h1><p>Create an intuitive navigation structure that helps users find information quickly.</p><h2>Navigation Types</h2><p>Emergent supports three types of navigation items:</p><h3>1. Categories</h3><p>Categories are organizational labels that group related content. They appear as headers in the sidebar and cannot be clicked.</p><h3>2. Article Links</h3><p>Direct links to articles within your documentation. Specify the article slug to create the connection.</p><h3>3. External Links</h3><p>Links to external resources or websites. These open in a new tab.</p><h2>Hierarchy</h2><p>Build multi-level navigation by setting parent-child relationships:</p><ul><li>Top-level items appear directly in the sidebar</li><li>Child items are nested under their parent</li><li>Use order values to control positioning</li></ul><h2>Best Practices</h2><p>Follow these guidelines for effective navigation:</p><ol><li><strong>Keep it simple:</strong> Limit nesting to 2-3 levels</li><li><strong>Logical grouping:</strong> Group related content together</li><li><strong>Clear labels:</strong> Use descriptive, concise labels</li><li><strong>Consistent order:</strong> Organize by importance or sequence</li></ol><blockquote><p>Good navigation is invisible. Users should find what they need without thinking about the structure.</p></blockquote>"
                }
            ],
            "category": "Features",
            "order": 4,
            "meta_description": "Set up navigation for your documentation",
            "keywords": ["navigation", "sidebar", "menu", "structure"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Search Functionality",
            "slug": "search",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Search Functionality</h1><p>Help users find information instantly with powerful search capabilities.</p><h2>How Search Works</h2><p>Emergent's search feature indexes all published articles and searches across:</p><ul><li>Article titles</li><li>Content text</li><li>Keywords and metadata</li></ul><h2>Using Search</h2><p>Users can search from anywhere in the documentation:</p><ol><li>Click the search bar in the header</li><li>Type at least 2 characters</li><li>View real-time results</li><li>Click a result to navigate to that article</li></ol><h2>Search Results</h2><p>Results display:</p><ul><li>Article title</li><li>Content snippet showing context</li><li>Category badge</li></ul><h3>Relevance Ranking</h3><p>Results are ranked based on:</p><ul><li>Title matches (highest priority)</li><li>Keyword matches</li><li>Content matches</li></ul><h2>Optimization Tips</h2><blockquote><p>Add relevant keywords to your articles to improve searchability. Use clear, descriptive titles.</p></blockquote>"
                }
            ],
            "category": "Features",
            "order": 5,
            "meta_description": "Learn about search functionality",
            "keywords": ["search", "find", "lookup", "discovery"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "API Reference",
            "slug": "api-reference",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>API Reference</h1><p>Emergent provides a RESTful API for programmatic access to your documentation.</p><h2>Authentication</h2><p>Most endpoints require authentication using JWT tokens. Obtain a token by logging in through the admin panel.</p><pre><code>POST /api/admin/login\nContent-Type: application/json\n\n{\n  \"username\": \"admin\",\n  \"password\": \"admin123\"\n}</code></pre><h2>Endpoints</h2><h3>Articles</h3><p><code>GET /api/articles</code> - List all published articles</p><p><code>GET /api/articles/{slug}</code> - Get a specific article</p><p><code>POST /api/admin/articles</code> - Create a new article (auth required)</p><p><code>PUT /api/admin/articles/{id}</code> - Update an article (auth required)</p><p><code>DELETE /api/admin/articles/{id}</code> - Delete an article (auth required)</p><h3>Navigation</h3><p><code>GET /api/navigation</code> - Get all navigation items</p><p><code>POST /api/admin/navigation</code> - Create navigation item (auth required)</p><h3>Search</h3><p><code>GET /api/search?q={query}</code> - Search articles</p><h2>Response Format</h2><p>All API responses use JSON format with consistent structure.</p>"
                }
            ],
            "category": "Developers",
            "order": 6,
            "meta_description": "API reference documentation",
            "keywords": ["api", "reference", "endpoints", "rest"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        }
    ]
    
    # Sample navigation with proper hierarchy
    intro_cat_id = str(uuid.uuid4())
    features_cat_id = str(uuid.uuid4())
    dev_cat_id = str(uuid.uuid4())
    
    sample_navigation = [
        {
            "id": intro_cat_id,
            "label": "GETTING STARTED",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 1,
            "icon": "book-open"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Welcome",
            "type": "article",
            "target": "welcome",
            "parent_id": intro_cat_id,
            "order": 2,
            "icon": None
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Quick Start",
            "type": "article",
            "target": "quick-start",
            "parent_id": intro_cat_id,
            "order": 3,
            "icon": None
        },
        {
            "id": features_cat_id,
            "label": "FEATURES",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 4,
            "icon": "settings"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Content Management",
            "type": "article",
            "target": "content-management",
            "parent_id": features_cat_id,
            "order": 5,
            "icon": None
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Navigation Setup",
            "type": "article",
            "target": "navigation-setup",
            "parent_id": features_cat_id,
            "order": 6,
            "icon": None
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Search",
            "type": "article",
            "target": "search",
            "parent_id": features_cat_id,
            "order": 7,
            "icon": None
        },
        {
            "id": dev_cat_id,
            "label": "DEVELOPERS",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 8,
            "icon": "code"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "API Reference",
            "type": "article",
            "target": "api-reference",
            "parent_id": dev_cat_id,
            "order": 9,
            "icon": None
        }
    ]
    
    # Insert sample data
    await db.articles.insert_many(sample_articles)
    await db.navigation.insert_many(sample_navigation)
    
    logger.info("Sample data created successfully")
