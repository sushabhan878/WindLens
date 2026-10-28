"""Normalize deployment settings before passing them to framework middleware."""
from urllib.parse import urlsplit


def cors_origins(value: str) -> list[str]:
    """Accept comma-separated origins copied with whitespace or trailing slashes.

    Never widen to a wildcard. Invalid URLs, credentials, paths, query strings,
    and fragments are rejected instead of silently granting another origin.
    """
    origins = []
    for entry in value.split(","):
        candidate = entry.strip().rstrip("/")
        if not candidate:
            continue
        try:
            parsed = urlsplit(candidate)
            port = parsed.port
        except ValueError as exc:
            raise ValueError("CORS_ORIGINS must contain valid HTTP(S) origins") from exc
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username is not None or parsed.password is not None
                or parsed.path or parsed.query or parsed.fragment):
            raise ValueError("CORS_ORIGINS must contain HTTP(S) origins without paths, credentials, queries, or fragments")
        host = parsed.hostname.lower()
        if ":" in host:
            host = f"[{host}]"
        suffix = f":{port}" if port is not None and port != {"http": 80, "https": 443}[parsed.scheme] else ""
        origin = f"{parsed.scheme}://{host}{suffix}"
        if origin not in origins:
            origins.append(origin)
    return origins
