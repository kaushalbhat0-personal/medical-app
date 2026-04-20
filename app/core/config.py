from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # CORS settings - supports localhost, Vercel preview/production, and custom domains
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"  # comma-separated
    
    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        # Auto-add common Vercel patterns if not already present
        default_patterns = [
            "https://*.vercel.app",  # Vercel preview/production
            "https://medical-webapp.vercel.app",  # Common production domain
        ]
        for pattern in default_patterns:
            if pattern not in origins:
                origins.append(pattern)
        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
