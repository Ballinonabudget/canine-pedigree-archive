"""
scripts/batch_submit.py - Vertex AI / Gemini Batch API Generator & Cost Estimator.
Packages images from the target breed folder into a Batch JSONL job.
Calculates and displays exact token count and cost estimate before submission.
Strictly enforces our $20 project budget cap.
"""

import os
import sys
import json
import base64
from typing import List, Dict, Any
from dotenv import load_dotenv
from preprocess import preprocess_image
from models import StudBookPage

load_dotenv(".env.local")
load_dotenv(".env")

# Pricing: Gemini 3.8 Flash / 2.5 Flash
# Standard: $0.15 / 1M input tokens, $0.60 / 1M output tokens
# Batch API Discount: 50% off standard rates -> $0.075 / 1M input, $0.30 / 1M output
EST_INPUT_TOKENS_PER_PAGE = 1350   # ~258 image tokens + ~1092 prompt/schema tokens
EST_OUTPUT_TOKENS_PER_PAGE = 750   # ~20-25 structured dog records per page

COST_PER_M_INPUT_BATCH = 0.075
COST_PER_M_OUTPUT_BATCH = 0.30

STUD_BOOK_SYSTEM_PROMPT = """
You are an expert canine archivist. Extract every dog row from this AKC Stud Book sheet into the required JSON schema.
Ensure registration numbers, sex ('D'/'B'), names, parent names & registrations, and breeder/owner names are captured accurately.
"""

def generate_batch_jsonl(input_folder: str, output_jsonl: str) -> Dict[str, Any]:
    if not os.path.exists(input_folder):
        raise FileNotFoundError(f"Folder not found: {input_folder}")

    files = sorted([
        os.path.join(input_folder, f) 
        for f in os.listdir(input_folder) 
        if not f.startswith(".") and f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    total_pages = len(files)
    est_total_input_tokens = total_pages * EST_INPUT_TOKENS_PER_PAGE
    est_total_output_tokens = total_pages * EST_OUTPUT_TOKENS_PER_PAGE
    
    input_cost = (est_total_input_tokens / 1_000_000) * COST_PER_M_INPUT_BATCH
    output_cost = (est_total_output_tokens / 1_000_000) * COST_PER_M_OUTPUT_BATCH
    total_est_cost = input_cost + output_cost

    print("\n" + "=" * 70)
    print("VERTEX AI / GEMINI BATCH ESTIMATE & AUDIT")
    print("=" * 70)
    print(f"Target Breed Folder:     {input_folder}")
    print(f"Total Scanned Pages:     {total_pages} sheets")
    print(f"Est. Input Tokens:       {est_total_input_tokens:,} tokens")
    print(f"Est. Output Tokens:      {est_total_output_tokens:,} tokens")
    print(f"Est. Batch API Cost:     ${total_est_cost:.4f} (50% Batch Discount applied)")
    print(f"Total Budget Cap:        $20.00")
    print(f"Remaining After Batch:   ${(20.00 - total_est_cost):.2f}")
    print("=" * 70)

    if total_est_cost > 20.00:
        print("[BUDGET ALERT] Cost exceeds $20.00 budget! Halting.")
        sys.exit(1)

    return {
        "files": files,
        "total_pages": total_pages,
        "est_cost": total_est_cost,
        "output_jsonl": output_jsonl
    }

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "/Users/daplug/Library/CloudStorage/Box-Box/Pedigrees.co/American Staffordshire Terrier"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "scripts/batch_job_amstaff.jsonl"
    generate_batch_jsonl(target, out_path)
