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
JWT_SECRET = "emergent-docs-secret-key-2024"
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

@api_router.post("/admin/articles", response_model=Article)
async def create_article(article: ArticleCreate, current_admin: str = Depends(get_current_admin)):
    # Check if slug already exists
    existing = await db.articles.find_one({"slug": article.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Article with this slug already exists")
    
    article_obj = Article(**article.dict())
    article_dict = prepare_for_mongo(article_obj.dict())
    await db.articles.insert_one(article_dict)
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
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
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
    """Create minimal sample content"""
    
    # Sample articles
    sample_articles = [
        {
            "id": str(uuid.uuid4()),
            "title": "Getting Started",
            "slug": "getting-started",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Welcome to Emergent Documentation</h1><p>This is a comprehensive documentation system built with a powerful CMS. You can manage all content through the admin panel.</p>"
                }
            ],
            "category": "Introduction",
            "order": 1,
            "meta_description": "Get started with Emergent documentation system",
            "keywords": ["getting started", "introduction", "emergent"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Core Features",
            "slug": "core-features",
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Core Features</h1><p>Explore the powerful features of our documentation system:</p><ul><li>Rich text editing</li><li>Media management</li><li>Navigation control</li><li>Search functionality</li></ul>"
                }
            ],
            "category": "Features",
            "order": 2,
            "meta_description": "Learn about core features",
            "keywords": ["features", "core", "functionality"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published": True
        }
    ]
    
    # Sample navigation
    sample_navigation = [
        {
            "id": str(uuid.uuid4()),
            "label": "Introduction",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 1,
            "icon": "book-open"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Getting Started",
            "type": "article",
            "target": "getting-started",
            "parent_id": None,
            "order": 2,
            "icon": "play"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Features",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 3,
            "icon": "settings"
        },
        {
            "id": str(uuid.uuid4()),
            "label": "Core Features",
            "type": "article",
            "target": "core-features",
            "parent_id": None,
            "order": 4,
            "icon": "star"
        }
    ]
    
    # Insert sample data
    await db.articles.insert_many(sample_articles)
    await db.navigation.insert_many(sample_navigation)
    
    logger.info("Sample data created successfully")
