"""Create small, original educational cell/tissue GLB schematics with Blender.

These are simplified teaching aids, not diagnostic microscopy or clinical models.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy


def material(name: str, color: tuple[float, float, float], roughness: float = 0.5) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (*color, 1.0)
        principled.inputs["Roughness"].default_value = roughness
    return mat


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def smooth(obj: bpy.types.Object) -> bpy.types.Object:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def add_sphere(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material, segments: int = 20) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return smooth(obj)


def add_biconcave_rbc(name: str, loc: tuple[float, float, float], scale: float, mat: bpy.types.Material) -> bpy.types.Object:
    segments, rings = 40, 12
    vertices: list[tuple[float, float, float]] = []
    for side in (1.0, -1.0):
        vertices.append((0.0, 0.0, side * 0.09))
        for ring in range(1, rings + 1):
            radius = ring / rings
            half_thickness = 0.09 + 0.19 * math.exp(-((radius - 0.76) / 0.20) ** 2)
            for segment in range(segments):
                angle = 2.0 * math.pi * segment / segments
                vertices.append((radius * math.cos(angle), radius * math.sin(angle), side * half_thickness))

    faces: list[tuple[int, ...]] = []
    side_size = 1 + rings * segments
    for side_offset, side_sign in ((0, 1), (side_size, -1)):
        center = side_offset
        first_ring = side_offset + 1
        for segment in range(segments):
            nxt = (segment + 1) % segments
            a = first_ring + segment
            b = first_ring + nxt
            faces.append((center, b, a) if side_sign < 0 else (center, a, b))
        for ring in range(rings - 1):
            current = first_ring + ring * segments
            following = current + segments
            for segment in range(segments):
                nxt = (segment + 1) % segments
                quad = (current + segment, current + nxt, following + nxt, following + segment)
                faces.append(tuple(reversed(quad)) if side_sign < 0 else quad)
    top_edge = 1 + (rings - 1) * segments
    bottom_edge = side_size + 1 + (rings - 1) * segments
    for segment in range(segments):
        nxt = (segment + 1) % segments
        faces.append((top_edge + segment, top_edge + nxt, bottom_edge + nxt, bottom_edge + segment))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.scale = (scale, scale, scale)
    return smooth(obj)


def add_sickle_cell(loc: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=loc)
    obj = bpy.context.object
    obj.name = "Sickle erythrocyte (schematic)"
    for vertex in obj.data.vertices:
        point = vertex.co.copy()
        vertex.co.x = point.x * 1.05
        vertex.co.y = point.y * 0.30 + 0.34 * (1.0 - point.x * point.x) * point.x
        vertex.co.z = point.z * 0.22
    obj.scale = (0.8, 0.8, 0.8)
    obj.data.materials.append(mat)
    return smooth(obj)


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No geometry generated for {path}")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_materials="EXPORT",
        export_draco_mesh_compression_enable=False,
    )
    if path.stat().st_size < 1000:
        raise RuntimeError(f"Generated GLB is unexpectedly small: {path}")
    print(f"Created {path.relative_to(path.parents[1])}: {path.stat().st_size} bytes, {len(meshes)} mesh objects", flush=True)


def blood_cell_morphology(root: Path) -> None:
    reset_scene()
    red = material("Erythrocyte · oxygenated red", (0.70, 0.045, 0.075), 0.34)
    deep_red = material("Erythrocyte · shadow red", (0.38, 0.018, 0.05), 0.42)
    add_biconcave_rbc("Normal erythrocyte 1", (-1.1, 0.35, 0), 0.67, red)
    add_biconcave_rbc("Normal erythrocyte 2", (0.35, 0.70, 0), 0.60, red)
    add_biconcave_rbc("Normal erythrocyte 3", (0.25, -0.75, 0), 0.56, deep_red)
    add_sickle_cell((1.2, -0.15, 0), deep_red)
    export_glb(root / "cytology" / "Blood_Cell_Morphology.glb")


def leukocyte_morphology(root: Path) -> None:
    reset_scene()
    cytoplasm = material("Leukocyte cytoplasm", (0.77, 0.79, 0.88), 0.44)
    nucleus = material("Nucleus · violet", (0.20, 0.12, 0.44), 0.4)
    granule = material("Neutrophil granules", (0.48, 0.35, 0.70), 0.45)
    eosin_granule = material("Eosinophil granules", (0.85, 0.27, 0.32), 0.45)

    # Neutrophil: segmented nucleus and fine granules.
    add_sphere("Neutrophil cell membrane", (-1.5, 0.1, 0), (0.9, 0.9, 0.70), cytoplasm)
    for i, (x, y) in enumerate([(-1.9, 0.1), (-1.55, 0.28), (-1.2, 0.08)]):
        add_sphere(f"Neutrophil nuclear lobe {i + 1}", (x, y, 0.48), (0.30, 0.28, 0.20), nucleus)
    for i in range(10):
        angle = 2 * math.pi * i / 10
        add_sphere(f"Neutrophil granule {i + 1}", (-1.5 + 0.64 * math.cos(angle), 0.1 + 0.60 * math.sin(angle), 0.15), (0.08, 0.08, 0.07), granule, 12)

    # Lymphocyte: large round nucleus and a thin cytoplasmic rim.
    add_sphere("Lymphocyte cell membrane", (0.0, 0.1, 0), (0.88, 0.88, 0.69), cytoplasm)
    add_sphere("Lymphocyte nucleus", (0.0, 0.1, 0.38), (0.69, 0.67, 0.40), nucleus)

    # Eosinophil: bilobed nucleus and coarse granules.
    add_sphere("Eosinophil cell membrane", (1.6, 0.1, 0), (0.9, 0.9, 0.70), cytoplasm)
    add_sphere("Eosinophil nuclear lobe A", (1.34, 0.1, 0.42), (0.34, 0.35, 0.22), nucleus)
    add_sphere("Eosinophil nuclear lobe B", (1.84, 0.1, 0.42), (0.34, 0.35, 0.22), nucleus)
    for i in range(8):
        angle = 2 * math.pi * i / 8
        add_sphere(f"Eosinophil granule {i + 1}", (1.6 + 0.67 * math.cos(angle), 0.1 + 0.62 * math.sin(angle), 0.13), (0.10, 0.10, 0.08), eosin_granule, 12)
    export_glb(root / "cytology" / "Leukocyte_Morphology.glb")


def leukemia_blast_morphology(root: Path) -> None:
    reset_scene()
    cytoplasm = material("Blast cytoplasm · pale blue", (0.52, 0.70, 0.82), 0.46)
    nucleus = material("Blast nucleus · deep violet", (0.24, 0.11, 0.43), 0.4)
    nucleolus = material("Blast nucleolus · rose", (0.88, 0.45, 0.59), 0.4)
    mature_cytoplasm = material("Mature neutrophil cytoplasm", (0.76, 0.80, 0.89), 0.48)
    red_cell = material("Erythrocyte · red", (0.68, 0.045, 0.08), 0.42)

    # Compare a mature granulocyte with a simplified blast having a high
    # nucleus-to-cytoplasm ratio; this is educational morphology, not diagnosis.
    add_sphere("Mature neutrophil cell membrane · comparison", (-1.2, 0.0, 0), (0.70, 0.68, 0.52), mature_cytoplasm)
    for index, x in enumerate((-1.48, -1.20, -0.92)):
        add_sphere(f"Mature neutrophil nuclear lobe {index + 1}", (x, 0.0, 0.36), (0.24, 0.22, 0.17), nucleus, 16)

    add_sphere("Acute leukaemia myeloblast cell membrane · schematic", (0.72, 0.05, 0), (0.82, 0.80, 0.66), cytoplasm, 28)
    add_sphere("Acute leukaemia myeloblast nucleus · schematic", (0.72, 0.05, 0.37), (0.61, 0.58, 0.40), nucleus, 28)
    add_sphere("Myeloblast nucleolus 1 · schematic", (0.52, -0.10, 0.68), (0.12, 0.12, 0.08), nucleolus, 16)
    add_sphere("Myeloblast nucleolus 2 · schematic", (0.89, 0.22, 0.68), (0.09, 0.09, 0.07), nucleolus, 16)
    add_biconcave_rbc("Erythrocyte reference 1", (-0.15, -0.88, -0.05), 0.30, red_cell)
    add_biconcave_rbc("Erythrocyte reference 2", (0.82, -1.02, -0.05), 0.26, red_cell)
    export_glb(root / "pathology" / "Leukemia_Blast_Morphology.glb")


def epithelial_dysplasia(root: Path) -> None:
    reset_scene()
    normal_cell = material("Normal epithelium · pale rose", (0.82, 0.57, 0.53), 0.5)
    normal_nucleus = material("Normal nucleus · plum", (0.35, 0.18, 0.35), 0.46)
    dysplastic_cell = material("Dysplastic epithelium · rose", (0.72, 0.36, 0.42), 0.48)
    dysplastic_nucleus = material("Dysplastic nucleus · deep violet", (0.22, 0.08, 0.30), 0.42)
    membrane = material("Basement membrane · warm ivory", (0.86, 0.75, 0.60), 0.58)

    for group_x, label, cell_mat, nucleus_mat, irregular in [
        (-1.8, "Normal epithelium", normal_cell, normal_nucleus, False),
        (1.8, "Dysplastic epithelium", dysplastic_cell, dysplastic_nucleus, True),
    ]:
        for row in range(3):
            for col in range(4):
                x = group_x + (col - 1.5) * 0.42
                y = (row - 1) * 0.42
                height = 0.86 if not irregular else 0.70 + 0.15 * ((row + col) % 3)
                bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0))
                cell = bpy.context.object
                cell.name = f"{label} cell r{row + 1} c{col + 1}"
                cell.scale = (0.38, 0.38, height / 2)
                cell.data.materials.append(cell_mat)
                bevel = cell.modifiers.new("Soft cell edge", "BEVEL")
                bevel.width = 0.07
                bevel.segments = 3
                cell.modifiers.new("Cell normals", "WEIGHTED_NORMAL")
                nucleus_scale = (0.105, 0.11, 0.16) if not irregular else (0.15 + 0.025 * ((col + row) % 2), 0.14, 0.18)
                add_sphere(f"{label} nucleus r{row + 1} c{col + 1}", (x, y, height * 0.22), nucleus_scale, nucleus_mat, 16)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(group_x, -0.92, -0.42))
        base = bpy.context.object
        base.name = f"{label} basement membrane"
        base.scale = (1.02, 0.08, 0.10)
        base.data.materials.append(membrane)
    export_glb(root / "histology" / "Epithelial_Dysplasia.glb")


def atherosclerosis(root: Path) -> None:
    reset_scene()
    wall = material("Arterial wall · coral", (0.66, 0.17, 0.21), 0.43)
    lumen = material("Lumen · dark red", (0.31, 0.04, 0.08), 0.46)
    plaque = material("Atherosclerotic plaque · amber lipid", (0.93, 0.57, 0.12), 0.39)
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=20, location=(0, 0, 0), major_radius=1.0, minor_radius=0.23)
    ring = bpy.context.object
    ring.name = "Arterial wall cross-section"
    ring.data.materials.append(wall)
    smooth(ring)
    add_sphere("Lumen interior", (0, 0, -0.18), (0.77, 0.77, 0.10), lumen, 32)
    add_sphere("Atherosclerotic plaque", (0.55, 0.08, 0.05), (0.42, 0.53, 0.23), plaque, 24)
    export_glb(root / "pathology" / "Atherosclerosis.glb")


def tumor_microenvironment(root: Path) -> None:
    reset_scene()
    tumor = material("Tumor cell · muted magenta", (0.72, 0.32, 0.48), 0.48)
    tumor_nucleus = material("Tumor nucleus · deep plum", (0.24, 0.08, 0.31), 0.43)
    stroma = material("Stromal cell · slate blue", (0.35, 0.58, 0.69), 0.5)
    vessel = material("Microvessel · warm red", (0.64, 0.16, 0.20), 0.42)
    positions = [(-0.75, -0.35, 0), (-0.2, -0.50, 0.15), (0.35, -0.38, 0), (0.82, -0.08, 0.08), (-0.62, 0.35, 0.12), (-0.08, 0.30, 0), (0.48, 0.48, 0.12)]
    for i, pos in enumerate(positions):
        add_sphere(f"Tumor cell {i + 1}", pos, (0.36, 0.32, 0.30), tumor, 20)
        add_sphere(f"Tumor cell nucleus {i + 1}", (pos[0], pos[1], pos[2] + 0.22), (0.15, 0.14, 0.13), tumor_nucleus, 16)
    for i, pos in enumerate([(-1.15, 0.82, 0.05), (1.12, 0.72, 0.05), (1.12, -0.75, 0.05)]):
        cell = add_sphere(f"Stromal fibroblast {i + 1}", pos, (0.42, 0.12, 0.10), stroma, 18)
        cell.rotation_euler[2] = 0.25 * (i - 1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.10, depth=2.5, location=(0, -1.25, 0.08), rotation=(math.pi / 2, 0, 0))
    vessel_obj = bpy.context.object
    vessel_obj.name = "Tumor-associated microvessel"
    vessel_obj.data.materials.append(vessel)
    smooth(vessel_obj)
    export_glb(root / "pathology" / "Tumor_Microenvironment.glb")


def main() -> None:
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(sys.argv[separator + 1 :])
    args.output_dir.mkdir(parents=True, exist_ok=True)
    blood_cell_morphology(args.output_dir)
    leukocyte_morphology(args.output_dir)
    leukemia_blast_morphology(args.output_dir)
    epithelial_dysplasia(args.output_dir)
    atherosclerosis(args.output_dir)
    tumor_microenvironment(args.output_dir)


if __name__ == "__main__":
    main()
