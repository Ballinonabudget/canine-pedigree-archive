"""
scripts/models.py - Pydantic structured output schemas for AKC Stud Book tables and historical articles.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class DogRecord(BaseModel):
    reg_number: str = Field(
        ..., 
        description="Official AKC registration number stripped of spaces/dates (e.g. 'RA486186', 'W377099', 'R888957'). Unique identifier."
    )
    name: str = Field(..., description="Full registered name of the dog (e.g. 'BEARCAT', 'CH TRYARR SPACE CAPTAIN').")
    titles: Optional[str] = Field(None, description="Prefix titles like 'CH', 'GR CH', 'MACH', 'CD' if present in the text.")
    sex: str = Field("U", description="'D' for Dog/Male, 'B' for Bitch/Female, 'U' if undetermined.")
    birth_date: Optional[str] = Field(None, description="Birth date or whelp date formatted as M-D-YY (e.g. '9-30-78', '4-4-48').")
    color_code: Optional[str] = Field(None, description="Color code or description (e.g. 'FN', 'BLK BRDL & WH', 'Blk & br').")
    breed: str = Field(..., description="Standardized breed name (e.g. 'American Staffordshire Terrier', 'Rottweiler', 'Doberman Pinscher').")
    sire_name: Optional[str] = Field(None, description="Sire (Father) registered name.")
    sire_reg: Optional[str] = Field(None, description="Sire (Father) AKC registration number if present.")
    dam_name: Optional[str] = Field(None, description="Dam (Mother) registered name.")
    dam_reg: Optional[str] = Field(None, description="Dam (Mother) AKC registration number if present.")
    breeders: List[str] = Field(default_factory=list, description="List of breeder names.")
    owners: List[str] = Field(default_factory=list, description="List of owner names.")

class StudBookPage(BaseModel):
    breed: str = Field(..., description="Primary breed documented on this page.")
    date_header: Optional[str] = Field(None, description="Issue date or section date (e.g. 'April 21', 'January 1952').")
    dogs: List[DogRecord] = Field(default_factory=list, description="List of all puppy/dog entries in the table.")

class HistoricalArticleRecord(BaseModel):
    title: str = Field(..., description="Headline or title of the periodical article or document.")
    breed: str = Field(..., description="Target breed discussed.")
    publication_era: Optional[str] = Field(None, description="Estimated year or publication issue (e.g. 'July 1936', '4th Qtr 2000').")
    summary_rewrite: str = Field(
        ..., 
        description="Comprehensive, non-copyright-infringing journalistic summary synthesizing key historical points, kennels, and breeding lines."
    )
    mentioned_dogs: List[str] = Field(default_factory=list, description="Array of registered dog names or registration numbers mentioned.")
    source_image_url: Optional[str] = Field(None, description="Reference scan filename or relative path.")
