import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limit import (
    AuthenticatedWritePostRateLimitMiddleware,
    PublicEndpointRateLimitMiddleware,
    RateLimitRule,
)
from app.services.exceptions import ServiceError

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Fail fast on startup if the database is unreachable (after migrations in the process supervisor)."""
    logger.info("Application startup: validating database connectivity")
    try:
        from app.core.database import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Application startup: database connectivity OK")
    except Exception:
        logger.exception("Application startup failed — full traceback above")
        raise
    yield
    logger.info("Application shutdown")


app = FastAPI(
    title="Hospital Management API",
    version="1.0.0",
    debug=settings.DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


@app.get("/health")
def root_health() -> dict[str, str]:
    """Minimal health check for load balancers (e.g. Render) without API prefix."""
    return {"status": "ok"}


# CORS: MUST be first middleware, before any routes or custom middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight for 10 minutes
)


# Debug: Log incoming Origin header for CORS troubleshooting
@app.middleware("http")
async def debug_cors_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    logger.info(f"CORS Debug - Origin: {origin}, Method: {request.method}, Path: {request.url.path}")
    response = await call_next(request)
    # Log response CORS headers
    cors_header = response.headers.get("access-control-allow-origin")
    logger.info(f"CORS Debug - Response Access-Control-Allow-Origin: {cors_header}")
    return response


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
app.add_middleware(
    PublicEndpointRateLimitMiddleware,
    rule=RateLimitRule(window_seconds=60, max_requests=100),
)
app.add_middleware(AuthenticatedWritePostRateLimitMiddleware)


@app.exception_handler(ServiceError)
def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
    logger.error(f"Service error: {exc.detail} (status: {exc.status_code})")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
def handle_generic_exception(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception occurred")
    # TEMP DEBUG: Return actual error details for troubleshooting
    error_msg = str(exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {error_msg}"},
    )


@app.get("/health/cors")
def health_cors():
    """Health check endpoint to verify CORS configuration"""
    return {
        "cors_origins": settings.cors_origins,
        "allowed_origins_raw": settings.ALLOWED_ORIGINS,
        "environment": settings.ENVIRONMENT,
    }


app.include_router(api_router, prefix="/api/v1")
