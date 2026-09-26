#!/usr/bin/env python3
"""Create a private local access key; never print its value."""
from pathlib import Path
import os
import secrets

folder = Path.home() / ".config" / "dtrade"
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
if folder.is_symlink() or folder.stat().st_uid != os.getuid():
    raise SystemExit("Unsafe configuration directory")
folder.chmod(0o700)
path = folder / "access-token"
try:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit("An access key already exists; it was not overwritten.")
with os.fdopen(fd, "w") as handle:
    handle.write(secrets.token_urlsafe(48) + "\n")
print(f"Access key created in {path}. Read it locally to sign in; never commit or share it.")
