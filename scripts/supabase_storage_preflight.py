"""Read-only Supabase Storage inventory and safe upload-budget preflight."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def request_json(url: str, method: str, key: str, body: dict | None = None):
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"Supabase Storage preflight request failed ({error.code}): {message}") from error


def list_bucket_objects(base: str, key: str, bucket: str) -> dict[str, int]:
    objects: dict[str, int] = {}
    visited: set[str] = set()

    def walk(prefix: str) -> None:
        if prefix in visited:
            return
        visited.add(prefix)
        offset = 0
        while True:
            page = request_json(
                f"{base}/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}",
                "POST",
                key,
                {"prefix": prefix, "limit": 1000, "offset": offset, "sortBy": {"column": "name", "order": "asc"}},
            )
            if not isinstance(page, list):
                raise RuntimeError(f"Unexpected list response for bucket {bucket}: expected array")
            for item in page:
                name = str(item.get("name", "")).strip("/")
                if not name:
                    continue
                relative = f"{prefix.rstrip('/')}/{name}".strip("/")
                metadata = item.get("metadata") or {}
                size = metadata.get("size")
                if item.get("id") is None and not size:
                    walk(f"{relative}/")
                else:
                    try:
                        objects[relative] = int(size or 0)
                    except (TypeError, ValueError):
                        objects[relative] = 0
            if len(page) < 1000:
                break
            offset += len(page)

    walk("")
    return objects


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-dir", type=Path, required=True)
    parser.add_argument("--target-bucket", required=True)
    parser.add_argument("--project-cap-bytes", type=int, default=250_000_000)
    parser.add_argument("--max-file-bytes", type=int, default=48_000_000)
    args = parser.parse_args()

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only preflight")

    buckets = request_json(f"{base}/storage/v1/bucket", "GET", key)
    if not isinstance(buckets, list):
        raise SystemExit("Unexpected bucket inventory response; refusing upload")
    bucket_by_name = {str(bucket.get("name")): bucket for bucket in buckets}
    if args.target_bucket not in bucket_by_name:
        raise SystemExit(f"Target bucket {args.target_bucket!r} does not exist; no bucket/access settings were changed")

    current_project_bytes = 0
    current_target: dict[str, int] = {}
    for bucket_name in sorted(bucket_by_name):
        objects = list_bucket_objects(base, key, bucket_name)
        bucket_bytes = sum(objects.values())
        current_project_bytes += bucket_bytes
        if bucket_name == args.target_bucket:
            current_target = objects
        print(f"Current bucket {bucket_name}: {len(objects)} files, {bucket_bytes:,} bytes")

    planned: dict[str, int] = {}
    for path in args.asset_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".glb", ".pdb"} and path.name != "manifest.json":
            continue
        relative = path.relative_to(args.asset_dir).as_posix()
        size = path.stat().st_size
        if size <= 0 or size > args.max_file_bytes:
            raise SystemExit(f"File exceeds safe upload size: {relative} ({size:,} bytes)")
        planned[relative] = size
    if not planned:
        raise SystemExit("No GLB or PDB assets found to upload")

    replaced_bytes = sum(current_target.get(path, 0) for path in planned)
    planned_bytes = sum(planned.values())
    projected_project_bytes = current_project_bytes - replaced_bytes + planned_bytes
    print(f"Current project storage: {current_project_bytes:,} bytes")
    print(f"Replacing existing target paths: {replaced_bytes:,} bytes")
    print(f"New asset payload: {planned_bytes:,} bytes across {len(planned)} files")
    print(f"Projected project storage: {projected_project_bytes:,} / {args.project_cap_bytes:,} byte safety ceiling")
    if projected_project_bytes > args.project_cap_bytes:
        raise SystemExit("Projected storage exceeds the conservative project cap; no upload was attempted")
    print("Storage preflight passed. Note: this measurement covers this Supabase project only, not other projects in the organization.")


if __name__ == "__main__":
    main()
