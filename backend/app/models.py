from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    token: str = Field(min_length=1, description="Deriv API token")


class SessionCreated(BaseModel):
    session_id: str
    loginid: str | None = None
    currency: str | None = None


class DerivBalanceOut(BaseModel):
    balance: float
    currency: str
    loginid: str


class DerivAccountOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loginid: str
    is_virtual: bool = False
    currency: str = ""


class DerivAssetOut(BaseModel):
    symbol: str
    display_name: str
    market: str
    market_display_name: str
    submarket: str
    submarket_display_name: str


class DerivTicketOut(BaseModel):
    contract_id: int
    contract_type: str
    currency: str
    buy_price: float
    sell_price: float
    profit: float
    profit_percentage: float
    payout: float
    purchase_time: int
    expiry_time: int
    underlying: str
    underlying_display_name: str
    status: Literal["open", "sold", "won", "lost"]
    longcode: str


class SessionSnapshot(BaseModel):
    connected: bool
    error: str | None = None
    balance: DerivBalanceOut | None = None
    accounts: list[DerivAccountOut] = Field(default_factory=list)
    assets: list[DerivAssetOut] = Field(default_factory=list)
    tickets: list[DerivTicketOut] = Field(default_factory=list)


class TicksHistoryRequest(BaseModel):
    symbol: str
    count: int = Field(ge=1, le=5000)
    granularity: int | None = None
    subscribe: bool = False


class DerivForwardRequest(BaseModel):
    payload: dict[str, Any]


class CandleIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    time: int
    open: float
    high: float
    low: float
    close: float


class TicketIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    contract_id: int = 0
    underlying: str = ""
    contract_type: str = ""
    profit: float = 0.0
    status: str = "open"
    buy_price: float = 0.0
    longcode: str = ""


class AnalyzeTesteRequest(BaseModel):
    """Payload para o robô Teste: velas + tickets (atuais e recentes) + timeframe do gráfico."""

    symbol: str = Field(min_length=1)
    candles: list[CandleIn] = Field(default_factory=list, max_length=5000)
    tickets: list[TicketIn] = Field(default_factory=list, max_length=500)
    chart_granularity_seconds: int = Field(ge=60, le=86400)
    trade_duration_label: str = ""


class AnalyzeTesteResponse(BaseModel):
    signal: Literal["CALL", "PUT", "HOLD"]
    confidence: float
    probability_call: float
    probability_put: float
    indicators: dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""
