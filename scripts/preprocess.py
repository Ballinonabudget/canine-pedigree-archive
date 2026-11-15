"""
scripts/preprocess.py - Intelligent Auto-Rotation Preprocessor for Canine Scans.

Detects text line orientation using Tesseract OSD (Orientation and Script Detection)
and EXIF orientation tags. Handles 90 deg CW, 90 deg CCW, 180 deg upside-down, and 0 deg upright
without relying solely on aspect ratio (since some sheets are genuine landscape spreads).
"""

import os
import sys
from typing import Tuple, Optional
from PIL import Image
import pytesseract

def get_rotation_angle(img: Image.Image) -> int:
    """
    Determines the rotation angle (in degrees clockwise or counter-clockwise)
    needed to make text horizontally upright.
    Returns: angle (0, 90, 180, 270) to rotate using im.rotate(angle, expand=True).
    """
    # 1. Check EXIF orientation tag first if present
    exif = img.getexif()
    if exif:
        orientation = exif.get(0x0112, 1)
        if orientation == 3:
            return 180
        elif orientation == 6:
            return 270
        elif orientation == 8:
            return 90

    # 2. Use Tesseract OSD for accurate font baseline/orientation detection
    try:
        # Resize image for quick OSD analysis if it is massive
        w, h = img.size
        sample_img = img
        if max(w, h) > 2000:
            scale = 2000 / max(w, h)
            sample_img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.BILINEAR)

        osd = pytesseract.image_to_osd(sample_img, output_type=pytesseract.Output.DICT)
        rotate_needed = osd.get("rotate", 0)
        conf = osd.get("orientation_conf", 0.0)

        # If confidence is reasonably good, use Tesseract's recommendation
        if conf >= 1.0 and rotate_needed in (90, 180, 270):
            # Tesseract 'rotate' is clockwise degrees to make upright
            # im.rotate(deg) in PIL rotates counter-clockwise, so 360 - rotate_needed
            pil_angle = (360 - rotate_needed) % 360
            return pil_angle

    except Exception as e:
        # If OSD fails (e.g. on pure drawings with no text), fallback to 0
        pass

    return 0


def preprocess_image(input_path: str, output_path: Optional[str] = None, max_dim: int = 2400) -> Tuple[Image.Image, int]:
    """
    Loads an image, rotates it upright if needed, resizes if overly huge,
    and returns (upright_pil_image, applied_rotation_degrees).
    If output_path is provided, saves the result.
    """
    img = Image.open(input_path)
    # Convert RGBA or CMYK to RGB
    if img.mode != "RGB":
        img = img.convert("RGB")

    rot_angle = get_rotation_angle(img)
    if rot_angle != 0:
        img = img.rotate(rot_angle, expand=True)

    # Scale down if beyond max_dim while preserving aspect ratio for fast Gemini ingestion
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        img.save(output_path, quality=92)

    return img, rot_angle


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python preprocess.py <image_path> [output_path]")
        sys.exit(1)

    in_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else None
    upright_im, angle = preprocess_image(in_file, out_file)
    print(f"[PREPROCESS] {os.path.basename(in_file)} -> Applied PIL rotate: {angle}° | Upright dimensions: {upright_im.size}")
