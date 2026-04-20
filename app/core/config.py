from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # CORS settings - EXPLICIT ORIGINS ONLY (FastAPI CORSMiddleware doesn't support wildcards)
    # For Vercel preview URLs, add them explicitly or set ALLOWED_ORIGINS=* in .env for development only
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        # Filter out wildcards - FastAPI CORSMiddleware requires explicit origins
        explicit_origins = [o for o in origins if "*" not in o]
        return explicit_origins if explicit_origins else ["*"]  # Fallback to allow all if no valid origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
