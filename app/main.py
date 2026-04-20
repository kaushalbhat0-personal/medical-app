import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fnmatch import fnmatch

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.exceptions import ServiceError

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hospital Management API",
    version="1.0.0",
    debug=settings.DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: Support wildcard patterns (Vercel preview URLs)
def _is_origin_allowed(origin: str, allowed_patterns: list[str]) -> bool:
    """Check if origin matches any allowed pattern (supports wildcards)."""
    for pattern in allowed_patterns:
        if fnmatch(origin, pattern):
            return True
        if origin == pattern:
            return True
    return False

# Dynamic CORS middleware for wildcard support
class DynamicCORSMiddleware:
    """Custom middleware to handle wildcard CORS origins."""
    
    def __init__(self, app, allowed_origins: list[str]):
        self.app = app
        self.allowed_origins = allowed_origins

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        origin = dict(scope.get("headers", [])).get(b"origin", b"").decode()
        
        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                if origin and _is_origin_allowed(origin, self.allowed_origins):
                    headers.append((b"access-control-allow-origin", origin.encode()))
                    headers.append((b"access-control-allow-credentials", b"true"))
                    headers.append((b"access-control-allow-methods", b"*"))
                    headers.append((b"access-control-allow-headers", b"*"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_cors)

# Add dynamic CORS middleware first
app.add_middleware(DynamicCORSMiddleware, allowed_origins=settings.cors_origins)

# Standard CORS middleware as fallback
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing and logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log request
    logger.info(f"{request.method} {request.url.path} - Started")
    
    response = await call_next(request)
    
    # Log response
    duration = time.time() - start_time
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s"
    )
    
    return response


# Rate limiting middleware placeholder
@app.middleware("http")
async def rate_limit_placeholder(request: Request, call_next):
    # Placeholder for future rate limiting implementation
    # TODO: Implement Redis-based rate limiting
    return await call_next(request)


@app.exception_handler(ServiceError)
def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
    logger.error(f"Service error: {exc.detail} (status: {exc.status_code})")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
def handle_generic_exception(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception occurred")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


app.include_router(api_router, prefix="/api/v1")
