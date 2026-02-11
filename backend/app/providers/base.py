from abc import ABC, abstractmethod
import pandas as pd
from typing import Dict, Any, Optional

class MarketDataProvider(ABC):
    """
    Interface abstraite que tous les providers doivent implémenter.
    Garantit que le reste de l'application ne sait pas qui fournit la donnée.
    """

    @abstractmethod
    def fetch_history(self, ticker: str, period: str, interval: str) -> Optional[pd.DataFrame]:
        """Retourne un DataFrame avec : Open, High, Low, Close, Volume"""
        pass

    @abstractmethod
    def fetch_info(self, ticker: str) -> Dict[str, Any]:
        """Retourne un dictionnaire standardisé d'infos sur l'entreprise"""
        pass

    @abstractmethod
    def fetch_live_price(self, ticker: str) -> Dict[str, Any]:
        """Retourne {price, prev_close, is_open, next_event, exchange}"""
        pass