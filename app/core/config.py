from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Doctor slots: optional time-off clamp to weekly availability (local wall-clock intersection).
    DOCTOR_SLOT_CLIP_PARTIAL_TIME_OFF_TO_AVAILABILITY: bool = False

    # Slot read cache: disable for debugging; backend "memory" is default (Redis reserved for future).
    DOCTOR_SLOT_CACHE_ENABLED: bool = True
    DOCTOR_SLOT_CACHE_BACKEND: str = "memory"

    # CORS settings - EXPLICIT ORIGINS ONLY (FastAPI CORSMiddleware doesn't support wildcards)
    # For Vercel preview URLs, add them explicitly or set ALLOWED_ORIGINS=* in .env for development only
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    @property
    def cors_origins(self) -> list[str]:
        if not self.ALLOWED_ORIGINS:
            # Fallback for production if env var is not set
            if self.ENVIRONMENT == "production":
                return ["https://hospital-management-system-nine-topaz.vercel.app"]
            return ["http://localhost:5173", "http://127.0.0.1:5173"]
        
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        # Filter out wildcards - FastAPI CORSMiddleware requires explicit origins
        explicit_origins = [o for o in origins if "*" not in o]
        
        # Ensure production frontend is always included in production
        if self.ENVIRONMENT == "production":
            prod_origin = "https://hospital-management-system-nine-topaz.vercel.app"
            if prod_origin not in explicit_origins:
                explicit_origins.append(prod_origin)
        
        return explicit_origins if explicit_origins else ["*"]  # Fallback to allow all if no valid origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
