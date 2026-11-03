#!/usr/bin/env python3
"""Append-only, quota-limited upload of validated Live Class concept schematics."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from supabase_storage_preflight import list_bucket_objects, request_json

PROJECT_ORIGIN = "https://hixvbcrrklyajhkyliay.supabase.co"
TARGET_BUCKET = "medical-models"
PREFIX = "concepts/v1/"
PROJECT_CEILING_BYTES = 535_000_000
PACK_CEILING_BYTES = 8_000_000
EXPECTED_MODELS = 19
MAX_SINGLE_ASSET_BYTES = 600_000


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-dir", type=Path, required=True)
    args = parser.parse_args()
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if base != PROJECT_ORIGIN or not key:
        raise SystemExit("The exact Study Hub Supabase credentials are required; refusing upload.")
    source = args.asset_dir.resolve()
    manifest_path = source / "manifest-concepts-v1.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets")
    if not isinstance(assets, list) or len(assets) != EXPECTED_MODELS:
        raise SystemExit("The 19-model teaching pack manifest is missing or incomplete.")
    if not all(item.get("license") == "CC BY 4.0" and
               item.get("source") == "Original LenxiQ diagrammatic teaching geometry" for item in assets):
        raise SystemExit("Source attribution or licence metadata is not valid.")

    planned: dict[str, tuple[Path, int, str]] = {}
    for item in assets:
        relative = item.get("path", "")
        if not isinstance(relative, str) or
            not relative.endswith(".glb") or
            not relative.startswith(("microbiology/", "immunology/", "haematology/", "pathology/", "pharmacology/")) or
            ".." in relative or "\\" in relative:
            raise SystemExit("Invalid GLB path in reviewed pack")
        path = (source / relative).resolve()
        if source not in path.parents:
            raise SystemExit("Source path escapes model pack")
        raw = path.read_bytes()
        if len(raw) > MAX_SINGLE_ASSET_BYTES or len(raw) < 1024 or
            raw[:4] != b"glTF" or
            hashlib.sha256(raw).hexdigest() != item.get("sha256") or
            len(raw) != item.get("bytes"):
            raise SystemExit("GLB integrity check failed: " + relative)
        planned[PREFIX + relative] = (path, len(raw), "model/gltf-binary")

    if len(planned) != EXPECTED_MODELS:
        raise SystemExit("Duplicate model path in manifest")
    planned[PREFIX + "manifest.json"] = (manifest_path, manifest_path.stat().st_size, "application/json")
    if sum(entry[1] for entry in planned.values()) > PACK_CEILING_BYTES:
        raise SystemExit("Pack exceeds 8 MB budget")

    buckets = request_json(base + "/storage/v1/bucket", "GET", key)
    if not isinstance(buckets, list) or not any(b.get("name") == TARGET_BUCKET for b in buckets):
        raise SystemExit("Expected existing medical-models bucket not found; no settings changed.")
    existing: dict[str, int] = {}
    total_bytes = 0
    for b in buckets:
        objects = list_bucket_objects(base, key, b["name"])
        total_bytes += sum(objects.values())
        if b["name"] == TARGET_BUCKET:
            existing = objects
    additions = sum(size for name, (_, size, _) in planned.items() if name not in existing)
    for name, (_, size, _) in planned.items():
        if name in existing and existing[name] != size:
            raise SystemExit("Existing file differs: " + name + "; will not overwrite.")
    print("Read-only preflight: project bytes", total_bytes,
          "new pack bytes", additions,
          "project ceiling", PROJECT_CEILING_BYTES)
    if total_bytes + additions > PROJECT_CEILING_BYTES:
        raise SystemExit("Not enough project headroom; no uploads.")
    uploaded = []
    for remote, (path, size, content_type) in sorted(planned.items()):
        if remote in existing:
            print("Already present, unchanged:", remote)
            continue
        url = (base + "/storage/v1/object/" + TARGET_BUCKET + "/" +
               urllib.parse.quote(remote, safe="/"))
        request = urllib.request.Request(
            url, data=path.read_bytes(), method="POST",
            headers={
                "Authorization": "Bearer " + key,
                "apikey": key,
                "Content-Type": content_type,
                "cache-control": "max-age=31536000",
                "x-upsert": "false",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                if response.status not in (200, 201):
                    raise RuntimeError("Unexpected upload response")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Upload stopped on {remote}, HTTP {exc.code}; existing models are unchanged") from exc
        uploaded.append(remote)
        print("Inserted:", remote, size)
    verified = list_bucket_objects(base, key, TARGET_BUCKET)
    for name, (_, size, _) in planned.items():
        if verified.get(name) != size:
            raise SystemExit("Post-upload verification failed for " + name)
    print("SUCCESS: verified", len(assets), "original teaching GLBs;",
          len(uploaded), "new insertions;", sum(v[1] for v in planned.values()), "pack bytes.")
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(f"### LenxiQ Live Class teaching models\n"
                         f"- Validated models: {len(assets)}\n"
                         f"- New objects uploaded: {len(uploaded)}\n"
                         f"- Total projected preflight storage: {total_bytes + additions:,} bytes\n"
                         f"- Existing objects overwritten or deleted: 0\n"
                         f"- Tutor, audio and session logic changed: no\n")


if __name__ == "__main__":
    main()
