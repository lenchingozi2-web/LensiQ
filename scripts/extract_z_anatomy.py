"""Export system and organ GLBs from the Z-Anatomy Blender template.

The source is a Blender application-template ZIP. This script deliberately
matches both collection paths and object names because template releases have
used both naming schemes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import bpy


SYSTEMS = {
    "Integumentary_System": ("integument", "skin", "cutaneous"),
    "Skeletal_System": ("skeletal", "skeleton", "bone", "bones"),
    "Muscular_System": ("muscular", "muscle", "muscles"),
    "Nervous_System": ("nervous", "brain", "spinal cord", "nerve"),
    "Endocrine_System": ("endocrine",),
    "Cardiovascular_System": ("cardiovascular", "cardio", "circulatory"),
    "Lymphatic_System": ("lymphatic", "lymph"),
    "Respiratory_System": ("respiratory", "respiration"),
    "Digestive_System": ("digestive", "gastrointestinal", "alimentary"),
    "Urinary_System": ("urinary", "urogenital"),
    "Reproductive_System": ("reproductive", "genital"),
}

ORGANS = {
    "Heart": ("heart",),
    "Brain": ("brain", "encephalon"),
    "Liver": ("liver", "hepatic"),
    "Lungs": ("lung", "lungs", "pulmonary"),
    "Kidneys": ("kidney", "kidneys", "renal"),
}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def source_blend(source_root: Path) -> Path:
    candidates = sorted(source_root.rglob("*.blend"))
    if not candidates:
        raise RuntimeError(f"No .blend file found below {source_root}")
    if len(candidates) > 1:
        preferred = [path for path in candidates if "z-anatomy" in path.name.casefold()]
        candidates = preferred or candidates
    return candidates[0]


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.data.objects if obj.type == "MESH"]


def collection_parent_map() -> dict[int, bpy.types.Collection]:
    parent_by_child: dict[int, bpy.types.Collection] = {}
    for parent in bpy.data.collections:
        for child in parent.children:
            parent_by_child[child.as_pointer()] = parent
    return parent_by_child


def searchable_name(obj: bpy.types.Object) -> str:
    names = [obj.name]
    parent_by_child = collection_parent_map()
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


def objects_for_keywords(keywords: tuple[str, ...]) -> list[bpy.types.Object]:
    normalized_keywords = tuple(normalize(keyword) for keyword in keywords)
    return [
        obj for obj in mesh_objects()
        if any(keyword in searchable_name(obj) for keyword in normalized_keywords)
    ]


def join_for_export(objects: list[bpy.types.Object], label: str) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"No mesh objects matched {label}")
    copies = []
    export_collection = bpy.context.scene.collection
    for obj in objects:
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        duplicate.hide_set(False)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        export_collection.objects.link(duplicate)
        copies.append(duplicate)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in copies:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = label
    return joined


def export(objects: list[bpy.types.Object], output: Path, label: str) -> None:
    joined = join_for_export(objects, label)
    bpy.ops.object.select_all(action="DESELECT")
    joined.select_set(True)
    bpy.context.view_layer.objects.active = joined
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    bpy.data.objects.remove(joined, do_unlink=True)


def parse_args() -> argparse.Namespace:
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-record", required=True)
    return parser.parse_args(sys.argv[separator + 1 :])


def main() -> None:
    args = parse_args()
    blend = source_blend(args.source_root)
    bpy.ops.wm.open_mainfile(filepath=str(blend))

    exported: list[str] = []
    for label, keywords in SYSTEMS.items():
        objects = objects_for_keywords(keywords)
        export(objects, args.output_dir / "systems" / f"{label}.glb", label)
        exported.append(f"systems/{label}.glb")

    for label, keywords in ORGANS.items():
        objects = objects_for_keywords(keywords)
        export(objects, args.output_dir / "organs" / f"{label}.glb", label)
        exported.append(f"organs/{label}.glb")

    manifest = {
        "source": {
            "zenodo_record": args.source_record,
            "doi": f"10.5281/zenodo.{args.source_record}",
            "license": "CC BY 4.0",
            "attribution": "BodyParts3D; Z-Anatomy - the libre 3D atlas of anatomy",
        },
        "models": exported,
        "draco_compressed": True,
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
