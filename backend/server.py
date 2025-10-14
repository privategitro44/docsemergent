from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
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
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "rohit@emergent.sh")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "8a9b88cd8eb57717de3709ae722b0a21be50256e18e8fc12810d9b5c479bfcd6")

# Create the main app
app = FastAPI(title="Emergent Documentation System")

# CORS - must be added early for all routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

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
    type: str  # 'text', 'image', 'video', 'embed', 'steps', 'integrations'
    # For legacy types (text/image/video/embed)
    content: Optional[str] = None
    alt: Optional[str] = None
    caption: Optional[str] = None
    # For steps block
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None  # [{ title, description, bullets: [str], media?: {...} }]
    # For integrations block
    items: Optional[List[Dict[str, Any]]] = None  # [{ name, summary, url, icon, verified }]

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
    likes: int = 0
    dislikes: int = 0

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
    likes: Optional[int] = None
    dislikes: Optional[int] = None

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

class FeedbackRequest(BaseModel):
    slug: str
    type: str  # 'like' or 'dislike'

class FeedbackResponse(BaseModel):
    slug: str
    likes: int
    dislikes: int

class SocialLink(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    icon: str  # name key for frontend to map to an icon (e.g., 'x', 'linkedin', 'github', 'youtube', 'discord')
    url: str
    order: int = 0
    enabled: bool = True

class SocialLinkCreate(BaseModel):
    label: str
    icon: str
    url: str
    order: int = 0
    enabled: bool = True

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

# Mongo helpers for datetime serialization
def prepare_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
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
    existing = await db.articles.find_one({"slug": article.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Article with this slug already exists")
    article_obj = Article(**article.dict())
    article_dict = prepare_for_mongo(article_obj.dict())
    await db.articles.insert_one(article_dict)

    # Auto create nav item under category (case-insensitive matching)
    try:
        # Find existing category with case-insensitive search
        category_nav = await db.navigation.find_one({
            "type": "category", 
            "label": {"$regex": f"^{re.escape(article.category)}$", "$options": "i"}
        })
        parent_id = None
        if category_nav:
            parent_id = category_nav["id"]
            # Use the existing category's label (preserve its case)
            category_label = category_nav["label"]
        else:
            # Create new category with the case provided by user
            category_label = article.category
            new_category = {
                "id": str(uuid.uuid4()),
                "label": category_label,
                "type": "category",
                "target": None,
                "parent_id": None,
                "order": 1000,
                "icon": None
            }
            await db.navigation.insert_one(new_category)
            parent_id = new_category["id"]
        existing_nav = await db.navigation.find({"parent_id": parent_id}).sort("order", -1).limit(1).to_list(1)
        next_order = (existing_nav[0]["order"] + 1) if existing_nav else 1
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
    article = await db.articles.find_one({"id": article_id})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.articles.delete_one({"id": article_id})
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
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = uploads_dir / unique_filename
    async with aiofiles.open(file_path, 'wb') as buffer:
        content = await file.read()
        await buffer.write(content)
    # Return API route URL instead of direct /uploads/ path
    file_url = f"/api/uploads/{unique_filename}"
    return {"url": file_url, "filename": unique_filename}

# Route to serve uploaded files through API with correct MIME types
@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    import mimetypes
    
    file_path = uploads_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Read file content
    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()
    
    # Determine MIME type based on file extension
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"
    
    # Return with proper MIME type and CORS headers
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Cache-Control": "public, max-age=31536000"
        }
    )

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
        content_text = ""
        for content_item in article.get("content", []):
            if content_item.get("type") == "text":
                content_text += content_item.get("content", "") + " "
        snippet = content_text[:200] + "..." if len(content_text) > 200 else content_text
        relevance = 1.0
        results.append(SearchResult(
            id=article["id"],
            title=article["title"],
            slug=article["slug"],
            category=article["category"],
            snippet=snippet,
            relevance=relevance
        ))
    return results

# Feedback Routes
@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest):
    if req.type not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Invalid feedback type")
    inc_field = "likes" if req.type == "like" else "dislikes"
    await db.articles.find_one_and_update({"slug": req.slug}, {"$inc": {inc_field: 1}}, return_document=True)
    # If article missing (shouldn't happen), return error
    updated = await db.articles.find_one({"slug": req.slug})
    if not updated:
        raise HTTPException(status_code=404, detail="Article not found")
    return FeedbackResponse(slug=req.slug, likes=int(updated.get("likes", 0)), dislikes=int(updated.get("dislikes", 0)))

# Social Links Routes
@api_router.get("/social-links", response_model=List[SocialLink])
async def list_social_links():
    links = await db.social_links.find({"enabled": {"$ne": False}}).sort("order", 1).to_list(100)
    return [SocialLink(**link) for link in links]

@api_router.get("/admin/social-links", response_model=List[SocialLink])
async def admin_list_social_links(current_admin: str = Depends(get_current_admin)):
    links = await db.social_links.find().sort("order", 1).to_list(100)
    return [SocialLink(**link) for link in links]

@api_router.post("/admin/social-links", response_model=SocialLink)
async def create_social_link(link: SocialLinkCreate, current_admin: str = Depends(get_current_admin)):
    obj = SocialLink(**link.dict())
    await db.social_links.insert_one(obj.dict())
    return obj

@api_router.put("/admin/social-links/{link_id}", response_model=SocialLink)
async def update_social_link(link_id: str, link: SocialLinkCreate, current_admin: str = Depends(get_current_admin)):
    result = await db.social_links.update_one({"id": link_id}, {"$set": link.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Social link not found")
    updated = await db.social_links.find_one({"id": link_id})
    return SocialLink(**updated)

@api_router.delete("/admin/social-links/{link_id}")
async def delete_social_link(link_id: str, current_admin: str = Depends(get_current_admin)):
    result = await db.social_links.delete_one({"id": link_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Social link not found")
    return {"message": "Deleted"}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Seed sample articles only if none exist (no bulk-delete logic here)
    article_count = await db.articles.count_documents({})
    if article_count == 0:
        await create_sample_data()
    # Ensure default social links exist for visibility in public footer
    social_count = await db.social_links.count_documents({})
    if social_count == 0:
        await create_default_social_links()
    logger.info("Emergent Documentation System started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Sample Data Creation
async def create_sample_data():
    """Create comprehensive sample content"""
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
            "published": True,
            "likes": 0,
            "dislikes": 0
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Quick Start Guide",
            "slug": "quick-start",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Quick Start Guide</h1><p>Get up and running with Emergent in less than 5 minutes. This guide will walk you through the essential steps to start creating your documentation.</p>"
                }
            ],
            "category": "Introduction",
            "order": 2,
            "meta_description": "Get started with Emergent in 5 minutes",
            "keywords": ["quick start", "getting started", "tutorial", "setup"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True,
            "likes": 0,
            "dislikes": 0
        }
    ]

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
            "label": "API Reference",
            "type": "article",
            "target": "api-reference",
            "parent_id": dev_cat_id,
            "order": 9,
            "icon": None
        }
    ]

    await db.articles.insert_many(sample_articles)
    await db.navigation.insert_many(sample_navigation)
    logger.info("Sample data created successfully")

async def create_default_social_links():
    """Seed a basic set of social links if none exist so public footer is not empty."""
    defaults = [
        {"label": "X", "icon": "x", "url": "https://x.com/emergent", "order": 1},
        {"label": "LinkedIn", "icon": "linkedin", "url": "https://www.linkedin.com/company/emergent", "order": 2},
        {"label": "GitHub", "icon": "github", "url": "https://github.com/", "order": 3},
        {"label": "YouTube", "icon": "youtube", "url": "https://www.youtube.com/", "order": 4},
        {"label": "Discord", "icon": "discord", "url": "https://discord.com/", "order": 5},
    ]
    await db.social_links.insert_many([{**d, "id": str(uuid.uuid4())} for d in defaults])
    logger.info("Default social links created")
