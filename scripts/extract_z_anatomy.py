"""Export validated system and organ GLBs from the preloaded Z-Anatomy blend.

The workflow must load the verified source .blend before invoking this script.
Reopening a blend from inside Blender can reset the running script.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

import bpy

SYSTEMS: dict[str, tuple[str, ...]] = {}

ORGANS = {
    "Heart": ("heart",),
    "Brain": ("brain", "encephalon"),
    "Liver": ("liver", "hepatic"),
    "Lungs": ("lung", "lungs", "pulmonary"),
}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def collection_parent_map() -> dict[int, bpy.types.Collection]:
    parent_by_child: dict[int, bpy.types.Collection] = {}
    for parent in bpy.data.collections:
        for child in parent.children:
            parent_by_child[child.as_pointer()] = parent
    return parent_by_child


def searchable_name(obj: bpy.types.Object, parent_by_child: dict[int, bpy.types.Collection]) -> str:
    names = [obj.name]
    collection = obj.users_collection[0] if obj.users_collection else None
    visited: set[int] = set()
    while collection:
        pointer = collection.as_pointer()
        if pointer in visited:
            break
        visited.add(pointer)
        names.append(collection.name)
        collection = parent_by_child.get(pointer)
    return normalize(" ".join(names))


def objects_for_keywords(
    objects: list[bpy.types.Object],
    names_by_object: dict[int, str],
    keywords: tuple[str, ...],
    label: str,
) -> list[bpy.types.Object]:
    normalized_keywords = tuple(normalize(keyword) for keyword in keywords)
    matches = [
        obj for obj in objects
        if any(keyword in names_by_object[obj.as_pointer()] for keyword in normalized_keywords)
    ]
    if not matches:
        raise RuntimeError(f"No mesh objects matched {label}")
    return matches


def validate_glb(path: Path) -> dict[str, int]:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise RuntimeError(f"Exported GLB is truncated: {path}")
        magic, version, declared_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or declared_length != path.stat().st_size:
            raise RuntimeError(f"Exported GLB has an invalid GLB 2.0 header: {path}")

        document = None
        while True:
            chunk_header = stream.read(8)
            if not chunk_header:
                break
            if len(chunk_header) != 8:
                raise RuntimeError(f"Exported GLB has a truncated chunk header: {path}")
            chunk_length, chunk_type = struct.unpack("<II", chunk_header)
            chunk_data = stream.read(chunk_length)
            if len(chunk_data) != chunk_length:
                raise RuntimeError(f"Exported GLB has a truncated chunk: {path}")
            if chunk_type == 0x4E4F534A:
                document = json.loads(chunk_data.decode("utf-8").rstrip(" \t\r\n\0"))

    if not document:
        raise RuntimeError(f"Exported GLB has no JSON chunk: {path}")
    meshes = document.get("meshes", [])
    primitives = [primitive for mesh in meshes for primitive in mesh.get("primitives", [])]
    accessors = document.get("accessors", [])
    position_accessors = [
        accessors[primitive["attributes"]["POSITION"]]
        for primitive in primitives
        if "POSITION" in primitive.get("attributes", {})
        and primitive["attributes"]["POSITION"] < len(accessors)
    ]
    vertex_count = sum(int(accessor.get("count", 0)) for accessor in position_accessors)
    if not meshes or not primitives or vertex_count <= 0:
        raise RuntimeError(
            f"Refusing empty model {path}: meshes={len(meshes)}, "
            f"primitives={len(primitives)}, vertices={vertex_count}"
        )
    return {
        "meshes": len(meshes),
        "nodes": len(document.get("nodes", [])),
        "primitives": len(primitives),
        "vertices": vertex_count,
    }


def export(objects: list[bpy.types.Object], output: Path, label: str) -> dict[str, int]:
    copies: list[bpy.types.Object] = []
    export_collection = bpy.context.scene.collection
    print(f"Exporting {label}: {len(objects)} source mesh objects", flush=True)
    for obj in objects:
        duplicate = obj.copy()
        # Share source mesh datablocks; deep-copying every atlas mesh can multiply
        # Blender memory use before the exporter runs.
        duplicate.name = obj.name
        duplicate.parent = None
        duplicate.hide_set(False)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        export_collection.objects.link(duplicate)
        duplicate.matrix_world = obj.matrix_world.copy()
        copies.append(duplicate)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in copies:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.context.view_layer.update()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=False,
    )
    for duplicate in copies:
        bpy.data.objects.remove(duplicate, do_unlink=True)
    stats = validate_glb(output)
    print(f"Validated {label} / {output.name}: {output.stat().st_size} bytes, {stats}", flush=True)
    return stats


def parse_args() -> argparse.Namespace:
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-record", required=True)
    parser.add_argument("--only-model", choices=sorted((*SYSTEMS, *ORGANS)))
    return parser.parse_args(sys.argv[separator + 1 :])


def main() -> None:
    args = parse_args()
    blend = Path(bpy.data.filepath)
    if not blend.is_file() or "z-anatomy" not in blend.name.casefold():
        raise RuntimeError(
            "The verified full Z-Anatomy.blend must be loaded before this exporter runs; "
            f"current Blender file is {blend or 'unsaved'}"
        )
    print(f"Using preloaded verified anatomy source: {blend}", flush=True)

    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    parent_by_child = collection_parent_map()
    names_by_object = {
        obj.as_pointer(): searchable_name(obj, parent_by_child)
        for obj in mesh_objects
    }
    stats_by_path: dict[str, dict[str, int]] = {}
    groups = [("systems", SYSTEMS), ("organs", ORGANS)]
    for folder, group in groups:
        for label, keywords in group.items():
            if args.only_model and label != args.only_model:
                continue
            matches = objects_for_keywords(mesh_objects, names_by_object, keywords, label)
            relative_path = f"{folder}/{label}.glb"
            stats_by_path[relative_path] = export(
                matches, args.output_dir / relative_path, label
            )

    manifest = {
        "source": {
            "zenodo_record": args.source_record,
            "doi": f"10.5281/zenodo.{args.source_record}",
            "record_license": "CC BY 4.0",
            "embedded_source_license": "CC BY-SA 2.1 Japan",
            "attribution": (
                "BodyParts3D (Database Center for Life Science); "
                "Z-Anatomy / Gauthier Kervyn. Derived GLB exports; see the "
                "source archive's Licence.txt and Zenodo record."
            ),
        },
        "models": [
            {"path": path, **stats}
            for path, stats in sorted(stats_by_path.items())
        ],
        "draco_compressed": False,
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
