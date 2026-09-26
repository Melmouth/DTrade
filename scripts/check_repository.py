#!/usr/bin/env python3
"""Reject private/generated artifacts in the Git index or every reachable commit."""
import argparse
from pathlib import PurePosixPath
import re
import subprocess
import sys

BAD_DIRS = {'venv', '.venv', '__pycache__', 'node_modules', '.cache', 'secrets', 'private', 'backups', 'audit-output', 'dist', 'build', 'test-results', 'playwright-report'}
BAD_NAMES = {'.npmrc', '.pypirc', '.netrc', '.git-credentials', 'id_rsa', 'id_ed25519', '.bash_history', '.zsh_history'}
BAD_EXT = re.compile(r'\.(?:db(?:-.*)?|sqlite3?(?:-.*)?|py[co]|pem|key|p12|pfx|keystore|log|bundle|bak|backup|dump|sql|zip|tar|gz)$', re.I)

def forbidden(path):
    parts = PurePosixPath(path).parts
    name = parts[-1]
    return bool(set(parts) & BAD_DIRS or name in BAD_NAMES or BAD_EXT.search(name)
                or (name.startswith('.env') and name != '.env.example'))


def git(*args):
    return subprocess.check_output(['git', *args])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--history', action='store_true', help='Check every reachable historical tree too')
    args = parser.parse_args()
    errors = set()
    paths = git('ls-files', '-z').decode().split('\0')
    for path in filter(None, paths):
        if forbidden(path):
            errors.add(f'Forbidden artifact: {path}')
        if not args.history:
            data = git('show', ':' + path)
            if len(data) > 2 * 1024 * 1024:
                errors.add(f'File larger than 2 MiB: {path}')
            if data.startswith((b'SQLite format 3', b'\x7fELF', b'PK\x03\x04')):
                errors.add(f'Unexpected database, binary or archive: {path}')
    if args.history:
        for commit in git('rev-list', '--all').decode().splitlines():
            for path in filter(None, git('ls-tree', '-r', '--name-only', '-z', commit).decode().split('\0')):
                if forbidden(path):
                    errors.add(f'Historical artifact: {path}')
        for email in git('log', '--all', '--format=%ae%n%ce').decode().splitlines():
            if not email.endswith('@users.noreply.github.com'):
                errors.add('History contains an author/committer email outside GitHub noreply')
    if errors:
        print('\n'.join(sorted(errors)[:30]), file=sys.stderr)
        print(f'Repository guard failed: {len(errors)} finding(s).', file=sys.stderr)
        return 1
    print('Repository artifact/privacy guard passed.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
