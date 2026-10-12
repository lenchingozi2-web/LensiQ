"""Validate Live Class assets and emit one provenance/size manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from datetime import datetime, timezone
from pathlib import Path

MAX_FILE_BYTES = 48_000_000
MAX_TOTAL_BYTES = 250_000_000

ANATOMY_LICENSE = {
    "source": "Z-Anatomy, Open source atlas of human anatomy",
    "zenodo_record": "https://zenodo.org/records/4953712",
    "doi": "10.5281/zenodo.4953712",
    "record_license": "CC BY 4.0",
    "embedded_source_license": "CC BY-SA 2.1 Japan",
    "attribution": "BodyParts3D (Database Center for Life Science); Z-Anatomy / Gauthier Kervyn. Derived model export; see source archive Licence.txt and Zenodo record.",
}

ANATOMY_LABELS = {
    "Integumentary_System": "Integumentary system",
    "Skeletal_System": "Skeletal system",
    "Muscular_System": "Muscular system",
    "Nervous_System": "Nervous system",
    "Endocrine_System": "Endocrine system",
    "Cardiovascular_System": "Cardiovascular system",
    "Lymphatic_System": "Lymphatic system",
    "Respiratory_System": "Respiratory system",
    "Digestive_System": "Digestive system",
    "Urinary_System": "Urinary system",
    "Reproductive_System": "Reproductive system",
    "Heart": "Heart",
    "Brain": "Brain",
    "Liver": "Liver",
    "Lungs": "Lungs",
    "Kidneys": "Kidneys",
}

SCHEMATIC_ASSETS = {
    "cytology/Blood_Cell_Morphology.glb": {
        "title": "Blood-cell morphology",
        "category": "cytology",
        "tags": ["erythrocyte", "red blood cell", "sickle cell", "haemoglobin", "hemoglobin"],
    },
    "cytology/Leukocyte_Morphology.glb": {
        "title": "Leukocyte morphology",
        "category": "cytology",
        "tags": ["neutrophil", "lymphocyte", "eosinophil", "white blood cell", "granulocyte"],
    },
    "pathology/Leukemia_Blast_Morphology.glb": {
        "title": "Acute leukaemia blast morphology",
        "category": "pathology",
        "tags": ["acute leukaemia", "acute leukemia", "myeloblast", "myeloblasts", "bone marrow", "blast morphology"],
    },
    "histology/Epithelial_Dysplasia.glb": {
        "title": "Epithelial tissue and dysplasia",
        "category": "histology",
        "tags": ["epithelium", "epithelial", "histology", "dysplasia", "metaplasia", "carcinoma"],
    },
    "pathology/Atherosclerosis.glb": {
        "title": "Atherosclerosis and arterial plaque",
        "category": "pathology",
        "tags": ["atherosclerosis", "plaque", "coronary artery disease", "stenosis"],
    },
    "pathology/Tumor_Microenvironment.glb": {
        "title": "Tumour microenvironment",
        "category": "pathology",
        "tags": ["tumour", "tumor", "cancer", "neoplasm", "metastasis", "angiogenesis"],
    },
}

PHARMACOLOGY_ASSETS = {
    "pharmacology/2RH1.pdb": {
        "title": "Human β2-adrenergic receptor with carazolol",
        "category": "pharmacology",
        "tags": ["beta blocker", "β-blocker", "carazolol", "beta-2 receptor", "β2-adrenergic receptor", "GPCR"],
        "pdb_id": "2RH1",
        "ligand": "carazolol",
    },
    "pharmacology/4EY7.pdb": {
        "title": "Human acetylcholinesterase with donepezil",
        "category": "pharmacology",
        "tags": ["donepezil", "acetylcholinesterase", "cholinesterase", "AChE"],
        "pdb_id": "4EY7",
        "ligand": "donepezil",
    },
    "pharmacology/1U72.pdb": {
        "title": "Dihydrofolate reductase with methotrexate",
        "category": "pharmacology",
        "tags": ["methotrexate", "dihydrofolate reductase", "DHFR", "antifolate"],
        "pdb_id": "1U72",
        "ligand": "methotrexate",
    },
}

EXPECTED_ANATOMY = [
    *(f"systems/{name}.glb" for name in (
        "Integumentary_System", "Skeletal_System", "Muscular_System", "Nervous_System",
        "Endocrine_System", "Cardiovascular_System", "Lymphatic_System", "Respiratory_System",
        "Digestive_System", "Urinary_System", "Reproductive_System",
    )),
    *(f"organs/{name}.glb" for name in ("Heart", "Brain", "Liver", "Lungs", "Kidneys")),
]


def glb_document(path: Path) -> dict:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise ValueError(f"Truncated GLB header: {path}")
        magic, version, declared_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or declared_length != path.stat().st_size:
            raise ValueError(f"Invalid GLB 2.0 header or length: {path}")
        document = None
        while True:
            header = stream.read(8)
            if not header:
                break
            if len(header) != 8:
                raise ValueError(f"Truncated GLB chunk header: {path}")
            length, kind = struct.unpack("<II", header)
            chunk = stream.read(length)
            if len(chunk) != length:
                raise ValueError(f"Truncated GLB chunk: {path}")
            if kind == 0x4E4F534A:
                document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\0"))
    if document is None:
        raise ValueError(f"Missing GLB JSON chunk: {path}")
    meshes = document.get("meshes", [])
    primitives = [primitive for mesh in meshes for primitive in mesh.get("primitives", [])]
    accessors = document.get("accessors", [])
    vertex_count = sum(
        int(accessors[primitive["attributes"]["POSITION"]].get("count", 0))
        for primitive in primitives
        if "POSITION" in primitive.get("attributes", {})
        and primitive["attributes"]["POSITION"] < len(accessors)
    )
    if not meshes or not primitives or vertex_count <= 0:
        raise ValueError(f"No actual mesh geometry in {path}: {len(meshes)} meshes, {vertex_count} vertices")
    return {
        "mesh_count": len(meshes),
        "node_count": len(document.get("nodes", [])),
        "primitive_count": len(primitives),
        "vertex_count": vertex_count,
    }


def metadata_for(relative: str) -> dict:
    if relative == "organs/Kidneys.glb":
        return {
            "title": "Kidney, Male, Right",
            "category": "anatomy",
            "tags": ["kidney", "renal anatomy", "urinary system", "right kidney", "human reference atlas"],
            "source": "Human Reference Atlas / NIH 3D entry 3DPX-021002, v1.2",
            "source_url": "https://3d.nih.gov/entries/21002/1",
            "doi": "10.48539/HBM364.QTSC.334",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Kidney, Male, Right by HRA; model creators Kristen Browne and Heidi Schlehlein; Human Reference Atlas 3D Reference Object Library, v1.2; DOI 10.48539/HBM364.QTSC.334; CC BY 4.0.",
        }
    if relative.startswith("systems/") or relative.startswith("organs/"):
        name = Path(relative).stem
        return {
            "title": ANATOMY_LABELS.get(name, name.replace("_", " ")),
            "category": "anatomy",
            "tags": [name.replace("_", " ").casefold()],
            **ANATOMY_LICENSE,
        }
    if relative in SCHEMATIC_ASSETS:
        return {
            **SCHEMATIC_ASSETS[relative],
            "source": "Original LenxiQ procedural teaching schematic",
            "license": "CC BY 4.0",
            "attribution": "LenxiQ Medical Learning; simplified educational schematic, not diagnostic imagery.",
            "educational_schematic": True,
        }
    if relative in PHARMACOLOGY_ASSETS:
        item = PHARMACOLOGY_ASSETS[relative]
        return {
            **item,
            "source": f"RCSB Protein Data Bank {item['pdb_id']}",
            "source_url": f"https://www.rcsb.org/structure/{item['pdb_id']}",
            "license": "CC0 1.0",
            "attribution": f"Structure authors of PDB entry {item['pdb_id']}; attribution is encouraged by RCSB PDB.",
        }
    raise ValueError(f"Unexpected asset path; add source and rights metadata first: {relative}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--max-total-bytes", type=int, default=MAX_TOTAL_BYTES)
    parser.add_argument("--max-file-bytes", type=int, default=MAX_FILE_BYTES)
    args = parser.parse_args()
    root = args.asset_dir

    expected = set(EXPECTED_ANATOMY) | set(SCHEMATIC_ASSETS) | set(PHARMACOLOGY_ASSETS)
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*") if path.is_file() and path.suffix.lower() in {".glb", ".pdb"}
    }
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing or unexpected:
        raise SystemExit(f"Asset catalog mismatch. Missing={missing}; unexpected={unexpected}")

    assets = []
    total_bytes = 0
    for relative in sorted(expected):
        path = root / relative
        size = path.stat().st_size
        if size <= 0 or size > args.max_file_bytes:
            raise SystemExit(f"Asset size outside safe limit: {relative} is {size} bytes")
        if path.suffix.lower() == ".glb":
            geometry = glb_document(path)
            fmt = "glb"
        else:
            with path.open("rb") as stream:
                header = stream.read(4096)
            atom_count = sum(1 for line in header.splitlines() if line.startswith((b"ATOM  ", b"HETATM")))
            if atom_count == 0:
                with path.open("rb") as stream:
                    atom_count = sum(1 for line in stream if line.startswith((b"ATOM  ", b"HETATM")))
            if atom_count < 100:
                raise SystemExit(f"PDB file has too few atom records: {relative} ({atom_count})")
            geometry = {"atom_records": atom_count}
            fmt = "pdb"
        metadata = metadata_for(relative)
        total_bytes += size
        assets.append({
            "path": relative,
            "format": fmt,
            "bytes": size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            **geometry,
            **metadata,
        })
    if total_bytes > args.max_total_bytes:
        raise SystemExit(f"Total upload payload exceeds safe cap: {total_bytes} > {args.max_total_bytes} bytes")

    manifest = {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "asset_count": len(assets),
        "total_bytes": total_bytes,
        "budget": {"max_file_bytes": args.max_file_bytes, "max_total_bytes": args.max_total_bytes},
        "assets": assets,
    }
    output = args.output or root / "manifest.json"
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {len(assets)} assets; total {total_bytes:,} bytes; manifest: {output}")
    for asset in assets:
        print(f"{asset['path']}: {asset['bytes']:,} bytes | {asset['title']}")


if __name__ == "__main__":
    main()
