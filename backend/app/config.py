from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deriv_ws_url: str = "wss://ws.derivws.com/websockets/v3"
    deriv_app_id: int = 1089
    # Se True: Access-Control-Allow-Origin: * (recomendado em dev; sem cookies na API).
    cors_allow_all: bool = True
    cors_origins: str = "http://192.168.13.140:3000,http://127.0.0.1:3000"

    @property
    def deriv_ws_full_url(self) -> str:
        return f"{self.deriv_ws_url}?app_id={self.deriv_app_id}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
