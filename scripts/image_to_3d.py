"""
═══════════════════════════════════════════════════════════════════════════════
 Image-to-3D Generator Script (GLB Output)
 Supports Open-Source 3D Backends:
   1. TripoSR (Stability AI & Tripo) - Fast, lightweight, direct GLB
   2. Unique3D (Tsinghua / Wuvin) - High-fidelity multi-view diffusion
   3. TRELLIS (Microsoft / JeffreyXiang) - SOTA Structured Latent 3D
   4. Local PyTorch (Direct CUDA execution with TripoSR / torch)

 Output: Production-ready .glb format compatible with Three.js & SCORM
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import argparse
import shutil
import time
import warnings
from pathlib import Path
from typing import Optional, Tuple

# Suppress PyTorch CUDA capability warnings for newer GPU architectures
warnings.filterwarnings("ignore", category=UserWarning, module="torch.cuda")

import torch
import trimesh
from PIL import Image
from gradio_client import Client, handle_file


def print_banner():
    banner = r"""
  ___                               _            _____ ____  
 |_ _|_ __ ___   __ _  __ _  ___   | |_ ___     |___ /|  _ \ 
  | || '_ ` _ \ / _` |/ _` |/ _ \  | __/ _ \      |_ \| | | |
  | || | | | | | (_| | (_| |  __/  | || (_) |    ___) | |_| |
 |___|_| |_| |_|\__,_|\__, |\___|   \__\___/    |____/|____/ 
                      |___/                                  
    [Image to 3D .GLB Model Generator - DJBC E-Learning]
"""
    print(banner)


def check_cuda_status():
    cuda_avail = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU only"
    print(f"[*] PyTorch Version : {torch.__version__}")
    print(f"[*] CUDA Available  : {cuda_avail} ({device_name})")
    return cuda_avail


def post_process_mesh(
    raw_mesh_path: str,
    output_glb_path: str,
    target_height: float = 1.82,
    ground_align: bool = True,
    center_xz: bool = True,
    verbose: bool = True
) -> str:
    """
    Standardize, scale, ground-align, and export mesh to .glb format using trimesh.
    """
    if verbose:
        print(f"[*] Post-processing 3D asset from: {raw_mesh_path}")

    # Load via trimesh (handles .glb, .gltf, .obj, .ply, .stl, etc.)
    loaded = trimesh.load(raw_mesh_path)

    if isinstance(loaded, trimesh.Scene):
        if len(loaded.geometry) == 0:
            raise ValueError("Loaded 3D scene contains no geometry.")
        mesh = trimesh.util.concatenate(list(loaded.geometry.values()))
    else:
        mesh = loaded

    bounds = mesh.bounds
    orig_width = bounds[1][0] - bounds[0][0]
    orig_height = bounds[1][1] - bounds[0][1]
    orig_depth = bounds[1][2] - bounds[0][2]

    if verbose:
        print(f"    - Vertices : {len(mesh.vertices):,}")
        print(f"    - Faces    : {len(mesh.faces):,}")
        print(f"    - Original Dimensions (WxHxD): {orig_width:.3f} x {orig_height:.3f} x {orig_depth:.3f}")

    # 1. Center X and Z
    if center_xz:
        center_x = (bounds[0][0] + bounds[1][0]) / 2.0
        center_z = (bounds[0][2] + bounds[1][2]) / 2.0
        mesh.apply_translation([-center_x, 0, -center_z])

    # 2. Ground align to y = 0
    if ground_align:
        min_y = mesh.bounds[0][1]
        mesh.apply_translation([0, -min_y, 0])

    # 3. Scale to target height (e.g., 1.82m for human character)
    if target_height > 0 and orig_height > 0:
        scale_factor = target_height / orig_height
        mesh.apply_scale(scale_factor)
        if verbose:
            new_h = mesh.bounds[1][1] - mesh.bounds[0][1]
            print(f"    - Scaled to target height: {new_h:.3f} m (scale factor: {scale_factor:.4f})")

    # 4. Repair & fix normals
    try:
        mesh.fix_normals()
    except Exception:
        pass

    # Ensure output directory exists
    out_path = Path(output_glb_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Export directly to .glb
    mesh.export(str(out_path), file_type="glb")
    file_size_kb = out_path.stat().st_size / 1024.0

    if verbose:
        print(f"[+] Output GLB saved: {out_path} ({file_size_kb:.1f} KB)")
        print(f"    - Final Bounds:\n{mesh.bounds}")

    return str(out_path)


# ─────────────────────────────────────────────────────────────────────────────
# BACKEND 1: TripoSR (Stability AI)
# ─────────────────────────────────────────────────────────────────────────────
def generate_with_triposr(
    image_path: str,
    remove_background: bool = True,
    foreground_ratio: float = 0.85,
    resolution: int = 256,
    hf_token: Optional[str] = None,
    verbose: bool = True
) -> str:
    """Generate 3D model using Stability AI TripoSR via Gradio API."""
    if verbose:
        print("\n[*] Initializing TripoSR Backend (stabilityai/TripoSR)...")

    client = Client("stabilityai/TripoSR", token=hf_token)

    if verbose:
        print(f"[*] Step 1/2: Preprocessing image (remove_bg={remove_background})...")

    preprocessed_img = client.predict(
        handle_file(image_path),
        remove_background,
        foreground_ratio,
        api_name="/preprocess"
    )

    if verbose:
        print(f"    - Preprocessed image saved to: {preprocessed_img}")
        print(f"[*] Step 2/2: Generating 3D mesh with marching cubes res={resolution}...")

    obj_path, glb_path = client.predict(
        handle_file(preprocessed_img),
        int(resolution),
        api_name="/generate"
    )

    if verbose:
        print(f"    - TripoSR raw GLB generated: {glb_path}")

    return glb_path


# ─────────────────────────────────────────────────────────────────────────────
# BACKEND 2: Unique3D (Tsinghua / Wuvin)
# ─────────────────────────────────────────────────────────────────────────────
def generate_with_unique3d(
    image_path: str,
    seed: int = -1,
    do_refine: bool = True,
    hf_token: Optional[str] = None,
    verbose: bool = True
) -> str:
    """Generate 3D model using Unique3D via Gradio API."""
    if verbose:
        print("\n[*] Initializing Unique3D Backend (Wuvin/Unique3D)...")

    client = Client("Wuvin/Unique3D", token=hf_token)

    if verbose:
        print(f"[*] Submitting to Unique3D multi-view pipeline (seed={seed}, refine={do_refine})...")

    # API: predict(preview_img, input_processing, seed, render_video, do_refine, expansion_weight, init_type, api_name="/generate3dv2")
    result = client.predict(
        handle_file(image_path),
        True,               # input_processing
        float(seed),        # seed
        False,              # render_video
        do_refine,          # do_refine
        0.1,                # expansion_weight
        "std",              # init_type
        api_name="/generate3dv2"
    )

    mesh_model_path, _ = result
    if verbose:
        print(f"    - Unique3D mesh generated: {mesh_model_path}")

    return mesh_model_path


# ─────────────────────────────────────────────────────────────────────────────
# BACKEND 3: TRELLIS (Microsoft / SOTA Latents)
# ─────────────────────────────────────────────────────────────────────────────
def generate_with_trellis(
    image_path: str,
    seed: int = 0,
    ss_steps: int = 12,
    slat_steps: int = 12,
    hf_token: Optional[str] = None,
    verbose: bool = True
) -> str:
    """Generate 3D model using Microsoft TRELLIS via Gradio API."""
    if verbose:
        print("\n[*] Initializing TRELLIS Backend (trellis-community/TRELLIS)...")

    client = Client("trellis-community/TRELLIS", token=hf_token)

    if verbose:
        print(f"[*] Submitting to TRELLIS pipeline (ss_steps={ss_steps}, slat_steps={slat_steps})...")

    # API: predict(image, multiimages, seed, ss_guidance_strength, ss_sampling_steps, slat_guidance_strength, slat_sampling_steps, multiimage_algo, mesh_simplify, texture_size, api_name="/generate_and_extract_glb")
    result = client.predict(
        handle_file(image_path),
        [],             # multiimages
        float(seed),    # seed
        7.5,            # ss_guidance_strength
        float(ss_steps),# ss_sampling_steps
        3.0,            # slat_guidance_strength
        float(slat_steps), # slat_sampling_steps
        "stochastic",   # multiimage_algo
        0.95,           # mesh_simplify
        1024.0,         # texture_size
        api_name="/generate_and_extract_glb"
    )

    # Returns: (video, extracted_glbgaussian, download_glb)
    _, _, download_glb = result
    if verbose:
        print(f"    - TRELLIS GLB extracted: {download_glb}")

    return download_glb


# ─────────────────────────────────────────────────────────────────────────────
# BACKEND 4: Pixal3D (SIGGRAPH 2026 - TencentARC / Tsinghua)
# ─────────────────────────────────────────────────────────────────────────────
def generate_with_pixal3d(
    image_path: str,
    seed: int = 42,
    resolution: int = 512,
    decimation_target: int = 50000,
    texture_size: int = 1024,
    hf_token: Optional[str] = None,
    verbose: bool = True
) -> str:
    """Generate 3D model using TencentARC Pixal3D."""
    if verbose:
        print("\n[*] Initializing Pixal3D Backend (TencentARC/Pixal3D)...")

    client = Client("TencentARC/Pixal3D", token=hf_token)

    if verbose:
        print("[*] Step 1/3: Pixal3D Preprocessing image...")

    preprocessed = client.predict(
        image=handle_file(image_path),
        api_name="/preprocess"
    )

    if verbose:
        print(f"    - Preprocessed: {preprocessed}")
        print(f"[*] Step 2/3: Pixal3D Generating 3D representation (res={resolution}, seed={seed})...")

    gen_result = client.predict(
        image=handle_file(preprocessed),
        seed=int(seed),
        resolution=int(resolution),
        api_name="/generate_3d"
    )

    state_path = gen_result.get("state_path") if isinstance(gen_result, dict) else gen_result
    if verbose:
        print(f"    - 3D state generated: {state_path}")
        print(f"[*] Step 3/3: Extracting GLB mesh (decimation={decimation_target}, tex={texture_size})...")

    glb_path = client.predict(
        state_path=state_path,
        decimation_target=int(decimation_target),
        texture_size=int(texture_size),
        session_id="",
        api_name="/extract_glb_api"
    )

    if verbose:
        print(f"    - Pixal3D GLB created: {glb_path}")

    return glb_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print_banner()
    check_cuda_status()

    parser = argparse.ArgumentParser(
        description="Generate .GLB 3D models from 2D images using open-source Image-to-3D AI backends."
    )
    parser.add_argument(
        "-i", "--input",
        required=True,
        help="Path to input 2D image (JPG, PNG, WebP)"
    )
    parser.add_argument(
        "-o", "--output",
        default="src/assets/models/human_body_male.glb",
        help="Output .glb filepath (default: src/assets/models/human_body_male.glb)"
    )
    parser.add_argument(
        "-b", "--backend",
        choices=["pixal3d", "triposr", "unique3d", "trellis", "auto"],
        default="auto",
        help="Image-to-3D backend to use (default: auto -> tries pixal3d, triposr, trellis, unique3d)"
    )
    parser.add_argument(
        "--target-height",
        type=float,
        default=1.82,
        help="Target height in meters (default: 1.82 for human model; set 0 to keep original)"
    )
    parser.add_argument(
        "--no-ground-align",
        action="store_true",
        help="Do not align bottom of model to y=0 floor"
    )
    parser.add_argument(
        "--no-remove-bg",
        action="store_true",
        help="Skip background removal preprocessing"
    )
    parser.add_argument(
        "--resolution",
        type=int,
        default=256,
        help="Marching cubes resolution for TripoSR (default: 256) or Pixal3D (512/1024)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=-1,
        help="Random seed (-1 for random)"
    )
    parser.add_argument(
        "--hf-token",
        default=None,
        help="Optional Hugging Face Access Token for priority queue"
    )

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"[!] Error: Input image file does not exist: {input_path}")
        sys.exit(1)

    print(f"[*] Input Image     : {input_path}")
    print(f"[*] Target GLB Path : {Path(args.output).resolve()}")
    print(f"[*] Chosen Backend  : {args.backend}")

    start_time = time.time()
    raw_3d_file = None

    # Determine backend sequence
    backends_to_try = [args.backend] if args.backend != "auto" else ["triposr", "pixal3d", "trellis", "unique3d"]

    for b in backends_to_try:
        try:
            if b == "pixal3d":
                raw_3d_file = generate_with_pixal3d(
                    str(input_path),
                    seed=42 if args.seed == -1 else args.seed,
                    resolution=512 if args.resolution < 512 else args.resolution,
                    hf_token=args.hf_token
                )
            elif b == "triposr":
                raw_3d_file = generate_with_triposr(
                    str(input_path),
                    remove_background=not args.no_remove_bg,
                    resolution=args.resolution,
                    hf_token=args.hf_token
                )
            elif b == "unique3d":
                raw_3d_file = generate_with_unique3d(
                    str(input_path),
                    seed=args.seed,
                    hf_token=args.hf_token
                )
            elif b == "trellis":
                raw_3d_file = generate_with_trellis(
                    str(input_path),
                    seed=0 if args.seed == -1 else args.seed,
                    hf_token=args.hf_token
                )
            if raw_3d_file:
                print(f"[+] Generation succeeded with backend: {b}")
                break
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[!] Warning: Backend '{b}' failed with error: {e}")
            if b == backends_to_try[-1]:
                print("[!] All attempted backends failed.")
                sys.exit(1)
            print("[*] Falling back to next backend...")

    # Post-process into standardized .glb
    final_glb = post_process_mesh(
        raw_mesh_path=raw_3d_file,
        output_glb_path=args.output,
        target_height=args.target_height,
        ground_align=not args.no_ground_align,
        center_xz=True,
        verbose=True
    )

    elapsed = time.time() - start_time
    print(f"\n[OK] All finished in {elapsed:.1f}s! GLB is ready: {final_glb}")


if __name__ == "__main__":
    main()
