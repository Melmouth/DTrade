"""Fail-closed settings for a single-owner, local-first application."""
from dataclasses import dataclass, field
import os
from pathlib import Path
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[2]

@dataclass(frozen=True)
class Settings:
    access_token: str = field(repr=False)
    data_dir: Path
    origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173")
    hosts: tuple[str, ...] = ("localhost", "127.0.0.1")
    secure_cookie: bool = False
    session_seconds: int = 28800
    max_sessions: int = 16
    max_websockets: int = 16
    request_limit: int = 120
    login_limit: int = 5
    worker_enabled: bool = True

    def __post_init__(self):
        if not 32 <= len(self.access_token) <= 256 or not self.access_token.isascii() or self.access_token.isspace():
            raise ValueError("Generate an access key with scripts/init_local.py before starting DTrade")
        data = self.data_dir.expanduser().resolve()
        if data == REPO_ROOT or REPO_ROOT in data.parents:
            raise ValueError("DTRADE_DATA_DIR must be outside the repository")
        object.__setattr__(self, "data_dir", data)
        for origin in self.origins:
            url = urlsplit(origin)
            if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
                    or url.path or url.query or url.fragment or "*" in origin):
                raise ValueError("Configure exact origins without paths or wildcards")
            if url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1"}:
                raise ValueError("Non-local origins require HTTPS")
            if url.hostname not in {"localhost", "127.0.0.1"} and not self.secure_cookie:
                raise ValueError("Non-local origins require secure cookies")
        if not self.origins or not self.hosts or any("*" in host or "/" in host for host in self.hosts):
            raise ValueError("Explicit origins and hosts are required")

    @classmethod
    def from_env(cls):
        config = Path.home() / ".config" / "dtrade" / "access-token"
        token = os.environ.get("DTRADE_ACCESS_TOKEN", "")
        if not token and config.exists():
            if config.is_symlink() or config.stat().st_mode & 0o077 or config.stat().st_uid != os.getuid():
                raise ValueError("The access-key file must be owner-only (0600)")
            token = config.read_text().strip()
        defaults = cls.__dataclass_fields__
        return cls(
            access_token=token,
            data_dir=Path(os.environ.get("DTRADE_DATA_DIR", Path.home() / ".local/share/dtrade")),
            origins=tuple(x.strip() for x in os.environ.get("DTRADE_ALLOWED_ORIGINS", ",".join(defaults["origins"].default)).split(",")),
            hosts=tuple(x.strip() for x in os.environ.get("DTRADE_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")),
            secure_cookie=os.environ.get("DTRADE_SECURE_COOKIE", "false").lower() == "true",
        )
