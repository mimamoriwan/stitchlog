# cross-stitch-conversion

クロスステッチ変換エンジンのドメイン知識スキル
Stitchlog 専用 — v0.1（要エキスパートバリデーション）

---

## Overview

This skill encodes the domain knowledge required to generate high-quality cross-stitch patterns
from photographs. Load it whenever implementing or modifying the conversion pipeline in Stitchlog.

**Core insight**: Photo-to-pattern conversion is NOT a color approximation problem.
It is a **translation problem** between two representational systems:

```
Source: continuous photographic image (millions of pixels, infinite gradients)
Target: discrete multi-layer stitch composition (4 layer types, finite thread colors)
```

Existing tools fail because they collapse this into one operation:
  `photo → color clustering → grid fill → done`

The correct approach is a **4-stage multi-layer composition**:
  `photo → element detection → stitch type routing → layer composition → output`

---

## When to Load This Skill

Load this skill when working on ANY of the following:

- `packages/conversion-engine/` (any file)
- API routes involving pattern generation (`POST /api/patterns/generate`)
- TypeScript types for `PatternData`, `StitchLayer`, `ConversionResult`
- PDF rendering of patterns (must preserve all 4 layers)
- Testing conversion quality against reference images
- Writing prompts that instruct an LLM to critique or improve pattern output

Do NOT load for: UI components, authentication, payments, database migrations,
notification logic, or any code unrelated to the conversion pipeline.

---

## Part 1: The Four-Layer Architecture

Every generated pattern MUST be structured as four independent layers.
Each layer is rendered at a different stage and has its own data structure.

```
Rendering order (bottom to top):
  Layer 0 — Cross Stitch Grid   : fills, backgrounds, large areas
  Layer 1 — Quarter/Half Stitch : diagonal boundaries, smooth curves
  Layer 2 — Back Stitch         : outlines, thin lines, whiskers, fine details
  Layer 3 — French Knots        : single points, eye highlights (rendered last, on top)
```

**Rule**: Every region of the source photo is assigned to EXACTLY ONE layer as its
primary representation. Layers can coexist at the same (x,y) position
(e.g. a French knot on top of a cross stitch cell), but each layer handles its own visual job.

---

## Part 2: Stitch Type Reference

### 2.1 Full Cross Stitch（クロスステッチ）

- **Pattern symbol**: X
- **Represents**: solid colored areas, backgrounds, large shapes, fur masses
- **Data unit**: `{ x, y, colorCode }` (grid cell)
- **Minimum meaningful area**: 2×2 cells. Single isolated cells are valid but
  painful to stitch — prefer French knot for isolated single-cell features
- **Thread strands**: 2 of 6 (standard for 14ct Aida)
- **Key rule**: If a same-color region spans ≥ 3 cells in any dimension → full cross stitch

### 2.2 Back Stitch（バックステッチ）

- **Pattern symbol**: line (can be diagonal)
- **Represents**: thin lines, outlines, whiskers, fine fur lines, eyebrows,
  leaf veins, text strokes, narrow anatomy (claws, beak edges)
- **Data unit**: `{ fromX, fromY, toX, toY, colorCode, plyCount }`
- **Diagonal capability**: Unlike cross stitch, back stitch can go diagonally
  (NE, NW, SE, SW), enabling true line representation at any angle
- **Thread strands**: 1 ply for fine lines (whiskers), 2 ply for bold outlines
- **CRITICAL RULE**: ANY feature < 2 cells wide with length > 5 cells → ALWAYS back stitch.
  NEVER attempt to represent thin lines by filling grid cells. They will disappear.
- **This is the most commonly missed rule in existing tools.**

### 2.3 French Knot（フレンチノット）

- **Pattern symbol**: filled dot (●)
- **Represents**: isolated points, eye highlights (catchlights), small accent dots,
  flower stamens, seed patterns, single-pixel bright spots
- **Data unit**: `{ x, y, colorCode, wraps }` (wraps: 1–3)
- **Thread strands**: 1–2 ply, 2–3 wraps typical
- **Key rule**: Any feature with area < 4 sq pixels at working resolution,
  roughly circular/dot-like → French knot
- **CRITICAL APPLICATION**: Eye catchlight highlight. This single French knot
  is what makes an animal portrait feel "alive." Never omit it.

### 2.4 Quarter/Half Cross Stitch（クォーター/ハーフステッチ）

- **Pattern symbol**: diagonal line or quarter-fill marker (◣ ◢ ◤ ◥)
- **Represents**: smooth diagonal boundaries between two colors, curved edges
- **Data unit**: `{ x, y, quadrant: 'NE'|'NW'|'SE'|'SW', colorCode }`
- **Thread strands**: 2 of 6 (same as full cross stitch)
- **When to apply**: At the boundary between two high-contrast color areas
  that form a diagonal or curved edge, to avoid the "pixel staircase" artifact
- **Threshold**: Apply only where ΔE(CIE76) > 25 between adjacent colors AND
  the boundary runs diagonal/curved for ≥ 4 consecutive cells
- **WARNING**: Overuse creates excessive complexity. Apply selectively.
  Oval faces, round bodies, curved tails are the primary use cases.

### 2.5 Long-Arm Cross Stitch（ロングアームクロスステッチ）

- **Represents**: Background texture, grass, water, fabric grain
- **Status**: DEFER to Phase 2. Do not implement in Phase 1 conversion engine.

---

## Part 3: Visual Element Detection → Stitch Routing Rules

Apply these rules in PRIORITY ORDER. Once a feature is routed, it leaves the detection pool.

### PRIORITY 1 — Thin Line → Back Stitch (highest priority)

```
IF feature.width < 3px (at working resolution)
AND feature.length > 5px
AND feature.shape == 'line' or 'curve' (not blob)
THEN route to backStitch layer
     record: fromX, fromY, toX, toY, colorCode, plyCount
     DO NOT represent in grid
```

Detection technique: morphological thinning → skeletonized connected components.
Features that survive skeletonization to 1px width with length > 5px are thin lines.

Examples: whiskers, eyebrows, fine fur strands, claws, beak edges, leaf veins

### PRIORITY 2 — Small Point → French Knot

```
IF feature.area < 4 sq_pixels (at working resolution)
AND feature.shape == 'roughly circular'
AND feature.contrast_with_neighbors > 20% luminance delta
THEN route to frenchKnots layer
     record: x, y, colorCode, wraps=2
```

Detection technique: blob detection (LoG or DoH filter) with size threshold.

Examples: eye catchlights, nose texture dots, dew drops, small flower stamens

### PRIORITY 3 — Diagonal/Curved Boundary → Quarter Stitch

```
IF boundary_between_two_regions satisfies:
   ΔE(CIE76) between regions > 25
   AND boundary_angle is diagonal (30°–60° or 120°–150° from horizontal)
   AND boundary_length > 4 cells
THEN apply quarterStitch to boundary cells
     quadrant determined by boundary direction
```

Detection technique: Canny edge detection, then classify edge angle.

### PRIORITY 4 — Everything Else → Full Cross Stitch Grid

After thin lines, points, and edge boundaries are routed:
- Remaining pixel regions → full cross stitch grid
- Apply k-means color clustering to reach target color count
- Each grid cell is assigned the dominant color of the corresponding pixel region
- Apply brand color mapping (see Part 6)

---

## Part 4: Subject-Specific Knowledge

### 4.1 Dogs and Cats (HIGHEST PRIORITY — core use case for Stitchlog launch)

#### Whiskers
- ALWAYS back stitch. No exceptions.
- Typical: 3–5 whiskers per side, originating from whisker pads on muzzle
- Color: usually off-white or light cream (#F5F0E8 range) against darker face background
- Thread: 1 ply DMC blanc or DMC 3865 (warm near-white)
- Stitch path: from muzzle edge outward, slight curve upward
- Also include "ghost whiskers" — lighter streak patterns in fur that suggest whisker roots
  These are fine back stitches 1/3 the length of the primary whiskers
- **[⚠ VALIDATE]**: Exact color recommendation — does the wife prefer blanc or 3865 for dark-faced dogs?

#### Eyes — Multi-layer structure (4 components)
```
Component 1 — Iris:
  3–4 concentric rings of cross stitch cells, color gradient from outer to inner
  Outer ring: slightly darker (pupil dilation creates dark ring)
  Inner rings: breed/individual color

Component 2 — Pupil:
  Central dark area (black or very dark brown)
  Full cross stitch, DMC 310 or 3799

Component 3 — Catchlight (CRITICAL):
  White French knot, 2 wraps
  Position: 10 o'clock or 2 o'clock within the pupil (never centered)
  Color: DMC blanc or DMC B5200 (bright white)
  THIS SINGLE KNOT determines whether the portrait feels alive.

Component 4 — Eyelid crease:
  Dark back stitch arc above the eye
  1 ply, DMC 3799 or 310
  Creates the "lid" impression that gives depth
```
- **[⚠ VALIDATE]**: Does the wife prefer DMC B5200 or blanc for the catchlight?
  Is 10 o'clock / 2 o'clock the right position, or does it vary by photo angle?

#### Nose
- Surface: 2–3 shades of the nose color (pink/brown/black gradient)
- Cross stitch for the main area
- Nostril impression: 2 small curved back stitch arcs (1–2 cells each)
- Highlight on nose tip (if visible in photo): 1 French knot
- **[⚠ VALIDATE]**: Is back stitch for nostrils the standard approach, or is there a better technique?

#### Fur Texture by Coat Type
```
Short coat (Shiba Inu, Lab, Beagle):
  Cross stitch is sufficient
  3–5 adjacent color tones to suggest shading
  No additional back stitch fur lines needed

Medium coat (Golden Retriever, Corgi):
  Cross stitch base
  Add sparse back stitch "fur direction" lines on chest, tail, leg feathers
  2–3 ply for thicker fur lines

Long coat (Poodle, Shih Tzu, Persian cat):
  Cross stitch base with aggressive color gradient
  Dense back stitch fur lines following the actual hair flow direction
  1 ply, following the wave/curl direction visible in the photo
  Include highlight streaks along the parting line (lighter back stitch)

Tabby/calico patterns:
  Preserve the color patch boundaries with back stitch
  Simplify within each patch to 2–3 tones
  Dark stripe lines: back stitch over the cross stitch field
```
- **[⚠ VALIDATE]**: Is this coat-type classification accurate? Are there important breeds missing?

#### Ears
- Inner ear: lighter color (often pink/cream), small cross stitch area
- Ear tip fine hairs (for breeds like German Shepherd, cat ears): 2–3 short back stitch
  strokes at the very tip, pointing outward
- Ear outline: dark back stitch defining the outer edge — CRITICAL for silhouette
- Ear fold shadow: 1–2 tones darker cross stitch in the fold area

#### Common Failure Modes (DO NOT reproduce these)
1. Representing whiskers as colored grid cells — they disappear at stitch scale
2. Placing the eye catchlight dead center — it looks unnatural
3. Reducing fur to fewer than 3 tones — loses breed character
4. Omitting the dark outline around the face — the subject "floats" on the background
5. Using DMC 310 (pure black) as the only dark — 3799 (dark brown-black) looks more natural for animals

### 4.2 Birds

- Feather barbs in large flight feathers: half stitch to suggest directionality
  **[⚠ VALIDATE]**: Is half stitch standard for this, or do stitchers use another technique?
- Eye: same 4-component structure as cats/dogs (iris, pupil, catchlight, lid crease)
  Scale to a smaller grid area depending on the bird's size in frame
- Beak: back stitch outline is critical (sharp edges define the beak cleanly)
  Cross stitch the beak surface if it's > 3 cells wide, otherwise all back stitch
- Wing pattern: preserve the most distinctive feather pattern, simplify the rest

### 4.3 Human Faces

- Hair mass areas: cross stitch with 3–5 tones
- Individual visible strands: back stitch
- Eyelashes: back stitch (1 ply)
- Eyebrows: back stitch over cross stitch brow area
- Lip outline: back stitch over cross stitch lip area
- Freckles: French knot (if > 3 visible), else cross stitch
- Skin: minimum 4 tones — highlight / midtone / shadow / deep shadow
  The highlight on forehead/nose bridge is non-negotiable for realism

### 4.4 Flowers / Plants (common motif category)

- Petal edges: back stitch (defines shape more than fill color)
- Stamen cluster: French knot group (3–8 knots)
- Leaf veins (main central vein): back stitch
- Secondary leaf veins: omit unless piece is > 120 stitches wide
- Stems: back stitch if < 2 cells wide, cross stitch if wider

---

## Part 5: Photo "Translation" Principles

Cross-stitch is interpretation, not reproduction.
The engine must make **editorial decisions**, not pixel-perfect mappings.

### 5.1 What to PRESERVE (non-negotiable)
- Subject silhouette and primary outline
- Characteristic features: what makes this individual recognizable
  (the particular tilt of these ears, that distinctive marking, this dog's exact nose)
- Light/dark contrast relationships (even if exact colors change)
- The single most important detail: eye catchlight, signature fur color, distinctive spot

### 5.2 What to SIMPLIFY
- Complex gradients → 2–4 discrete steps
- Background detail → 1–3 tones unless explicitly requested as "detailed background"
- Indistinct textures → nearest solid color
- Micro-texture below 2-pixel threshold → replace with solid or promote to back stitch

### 5.3 What to ELIMINATE
- Film grain and digital noise (apply light Gaussian blur to source before processing)
- Lens flare artifacts
- Motion blur
- Shadow detail in areas below 12% luminance (lossless to stitch quality)
- Background objects behind the main subject that are out of focus

### 5.4 Color Count Guidelines

| Finished size (stitches) | Max colors | Notes |
|--------------------------|-----------|-------|
| Up to 50 × 50            | 8         | Strict. Background counts. |
| 51 – 80 × 80             | 12        | Standard pet portrait size |
| 81 – 120 × 120           | 18        | Medium pieces |
| 121 – 200 × 200          | 25        | Large pieces |
| 200+ × 200+              | 30        | Expert difficulty only |

**Color selection algorithm**:
```
1. Apply k-means clustering at (target_count × 1.5) to the source image
2. Merge any two cluster colors where ΔE(CIE76) < 8
   (these are perceptually identical in thread form)
3. Verify: background has ≥ 1 dedicated color
4. Verify: eye catchlight is represented (add 1 extra white if needed,
   even if it exceeds target_count by 1)
5. Map each final cluster centroid to nearest available thread color
   using ΔE comparison against the selected brand's color library
```

**[⚠ VALIDATE]**: Is ΔE < 8 the right merge threshold? Does the wife
consider colors with ΔE 6–8 distinguishable when they're wound on a bobbin?

### 5.5 Resolution and Stitch Count

Working resolution: 1 pixel = 1 grid cell.

| Aida cloth count | Stitches per cm | Stitches per inch | Default? |
|-----------------|-----------------|-------------------|---------|
| 14ct (standard) | 5.5             | 14                | ✓ YES   |
| 18ct (fine)     | 7               | 18                | Advanced option |
| 28ct evenweave  | 11              | 28                | Expert only |

**Recommended finished dimensions for common use cases**:
```
Profile picture / avatar:   8cm × 8cm  = 44 × 44 stitches  (≈ 1–2 hours)
Standard pet portrait:     15cm × 15cm = 82 × 82 stitches  (≈ 8–15 hours)
Statement piece:           25cm × 25cm = 137×137 stitches  (≈ 30–60 hours)
```

**[⚠ VALIDATE]**: Are these time estimates accurate for an average intermediate stitcher?
The wife's estimate is the ground truth here.

---

## Part 6: Thread Color Mapping

### 6.1 Priority Brands (Phase 1 launch)

| Brand    | Origin  | Colors | Strengths                              | Notes                         |
|----------|---------|--------|----------------------------------------|-------------------------------|
| DMC      | France  | ~500   | Global standard, widest range          | Primary reference system      |
| Olympus  | Japan   | ~200   | Pastels, traditional Japanese hues     | Priority for Japanese market  |
| Cosmo    | Japan   | ~500   | Vibrant colors, excellent earth tones  | Strong for animal fur browns  |
| Anchor   | UK      | ~450   | Common alternative to DMC              | Not all DMC colors have equiv |

### 6.2 Color Library Data Structure

```typescript
interface ThreadColor {
  brand: 'DMC' | 'Olympus' | 'Cosmo' | 'Anchor';
  code: string;           // e.g. "310", "blanc", "B5200"
  name: string;           // e.g. "Black", "White", "Bright White"
  hex: string;            // e.g. "#000000"
  labL: number;           // CIE Lab L* for ΔE calculation
  labA: number;           // CIE Lab a*
  labB: number;           // CIE Lab b*
  equivalents: {          // Cross-brand equivalents (approximate)
    DMC?: string;
    Olympus?: string;
    Cosmo?: string;
    Anchor?: string;
  };
  tags: string[];         // e.g. ['neutral', 'dark', 'animal-fur', 'skin']
}
```

### 6.3 Color Matching Algorithm

```
For each cluster centroid color (RGB):
1. Convert to CIE Lab
2. Calculate ΔE(CIE76) against every color in the selected brand's library
3. Select the color with minimum ΔE
4. If minimum ΔE > 15, flag as "no close match" in conversionNotes
   (user should be warned the actual thread may look different)
```

### 6.4 Brand-Specific Notes

**DMC**
- DMC blanc vs DMC B5200: blanc is warm white (use for eye catchlights on warm-toned animals),
  B5200 is cold bright white (use for snow, white fur, very bright highlights)
- DMC 310 (black): use sparingly for outlines; pair with DMC 3799 (very dark brown-black)
  for more natural-looking animal portraits — pure black reads as "harsh"
- DMC 3865 (winter white): ideal for light-colored fur and near-white whiskers
- **[⚠ VALIDATE]**: The wife's preferred DMC colors for specific animal features

**Olympus**
- Pastels photograph lighter than they appear on the skein — when matching pastels for
  backgrounds, select 1 stop darker than the centroid color suggests
- **[⚠ VALIDATE]**: Is this observation correct from the wife's experience?

**Cosmo**
- Earth tones (700s–800s series): superior to DMC equivalents for realistic dog/cat fur
  in browns, tans, and warm grays
- **[⚠ VALIDATE]**: Specific Cosmo color recommendations for common fur colors

### 6.5 Skein Quantity Estimation

```
Stitches per skein (standard 14ct, 2-strand):
  Cross stitch: ~3,000 stitches per skein
  Back stitch:  ~4,000 stitches per skein (less thread per linear cm than cross)
  French knot:  ~500 knots per skein (uses more thread per point)

Formula:
  skeinCount = ceil(stitchCount / STITCHES_PER_SKEIN)
  Minimum: 1 skein per color regardless of count
  Practical rounding: round up to nearest 0.5 skein, then ceiling to whole number
```

**[⚠ VALIDATE]**: Are these estimates correct? The "3,000 cross stitches per skein"
figure is based on 8m skein, 2 strands from 6, ~0.75cm thread per stitch.
The wife's empirical experience is the calibration source here.

---

## Part 7: Output Data Structure

```typescript
interface PatternData {
  metadata: {
    id: string;
    sourceImageUrl: string;
    threadBrand: 'DMC' | 'Olympus' | 'Cosmo' | 'Anchor';
    aidaCount: 14 | 18 | 28;
    widthStitches: number;
    heightStitches: number;
    widthCm: number;                      // widthStitches / aidaCount * 2.54
    heightCm: number;
    colorCount: number;
    difficultyRating: 1 | 2 | 3 | 4 | 5; // 1=beginner, 5=expert
    estimatedHoursMin: number;
    estimatedHoursMax: number;
    generatedAt: string;                  // ISO 8601
    conversionNotes: string[];            // warnings, "no close match" flags, etc.
  };

  colorPalette: Array<{
    colorCode: string;       // e.g. "DMC-310"
    colorName: string;       // e.g. "Black"
    hexValue: string;
    labValues: { L: number; a: number; b: number };
    crossStitchCount: number;
    backStitchLength: number;  // total linear cells of back stitch in this color
    frenchKnotCount: number;
    quarterStitchCount: number;
    skeinCount: number;        // total skeins needed (all stitch types combined)
    isBackground: boolean;
    isCatchlight: boolean;     // flag: this color is used for eye highlight
  }>;

  layers: {
    crossStitch: Array<{
      x: number;               // column, 0 = left
      y: number;               // row, 0 = top
      colorCode: string;
    }>;

    quarterStitch: Array<{
      x: number;
      y: number;
      quadrant: 'NE' | 'NW' | 'SE' | 'SW';
      colorCode: string;
      // A single cell can appear twice with different quadrants
    }>;

    backStitch: Array<{
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      colorCode: string;
      plyCount: 1 | 2;
      // Coordinates use 0.5 increments to represent diagonal paths
      // e.g. fromX=2, fromY=3, toX=3, toY=2 = diagonal NE stitch
      // e.g. fromX=2.5, fromY=3 = horizontal through middle of cell
    }>;

    frenchKnots: Array<{
      x: number;               // cell coordinate, can use 0.5 increments
      y: number;
      colorCode: string;
      wraps: 1 | 2 | 3;
      isCatchlight: boolean;
    }>;
  };
}
```

**Coordinate rules**:
- Integer (x, y): the center of a grid cell
- Half-integer (e.g. x=2.5): the shared edge between two cells — valid for back stitch endpoints
- All coordinates ≥ 0, x < widthStitches, y < heightStitches
- Cross stitch and French knot CAN share the same integer coordinate (knot renders on top)
- Back stitch can pass through a cell that also has a cross stitch (independent layers)

---

## Part 8: Quality Validation Checklist

Run before marking any conversion as `status: 'pass'`.

### Structural checks (automated)
- [ ] All features < 2 cells wide with length > 5 cells → in backStitch layer (not crossStitch)
- [ ] At least 1 French knot exists at an eye position (if the subject has visible eyes)
- [ ] colorCount ≤ target_count + 1 (the +1 allows for the catchlight addition)
- [ ] No isolated single-cell cross stitches surrounded by empty space on all 4 sides
      ("confetti stitches") — promote to French knot or merge with adjacent color
- [ ] All coordinates within bounds: 0 ≤ x < widthStitches, 0 ≤ y < heightStitches
- [ ] No duplicate layer entries at same coordinates and same colorCode
- [ ] All colorCodes exist in the selected brand's library

### Visual checks (require rendered preview)
- [ ] Subject silhouette legible at full stitch scale (zoom out to 50%)
- [ ] Primary characteristic feature is preserved and recognizable
- [ ] Background doesn't visually compete with the subject
- [ ] Whiskers (if present) are visible as distinct back stitch lines

### Quality tiers
```
'pass':         All structural checks pass; visual checks reviewed by human
'needs_review': Generated with known issues listed in metadata.conversionNotes
'fail':         Structural validation failure — throw ConversionError, do not deliver
```

---

## Part 9: Technical Implementation Notes

### Image pre-processing pipeline (before stitch routing)
```
1. Resize to working resolution (target_stitches × 4 pixels per stitch for subpixel accuracy)
2. Gaussian blur σ=0.5 (removes noise without destroying fine features)
3. Color space: convert to CIE Lab for all distance calculations
4. Subject/background separation: if the photo has a clear subject, apply
   Grabcut or similar to identify subject region (affects background color reduction)
```

### Thin line detection
```
Recommended: OpenCV morphological thinning on grayscale edge map
1. Convert to grayscale
2. Apply Canny edge detector (low=50, high=150 as starting defaults)
3. Morphological skeleton / Zhang-Suen thinning
4. Extract connected components; filter to those with length > 5px and max_width < 3px
5. Vectorize the skeleton into line segments (Ramer–Douglas–Peucker simplification)
→ Each segment becomes a back stitch entry
```

### French knot detection
```
1. Apply LoG (Laplacian of Gaussian) blob detector, σ range = [1, 3]
2. Detect blobs with area < 4 sq_pixels and circularity > 0.6
3. High-contrast blobs (luminance delta > 20%) against local background → French knot
→ Each blob center becomes a French knot entry
```

### Color clustering
```
Recommended: scikit-learn KMeans or equivalent
1. Apply clustering to all remaining pixels (after thin lines and blobs are removed)
2. Run at k = target_count × 1.5, then merge close colors (ΔE < 8)
3. The "remaining pixels" pool excludes the pixels already assigned to back stitch
   and French knot layers (they have their own independent color assignment)
```

---

## Appendix A: Validation Tracking

Items marked [⚠ VALIDATE] require sign-off from the domain expert (the wife,
30+ years of cross-stitch experience) before this section can be considered
authoritative. Validation method: implement the rule, generate a test pattern,
have the expert stitch it or critique the output.

| ID  | Rule requiring validation                       | Section | Status      |
|-----|------------------------------------------------|---------|-------------|
| V01 | DMC blanc vs 3865 for dark-faced dog whiskers  | 4.1     | Pending     |
| V02 | DMC B5200 vs blanc for eye catchlight          | 4.1     | Pending     |
| V03 | Back stitch for nostrils (vs other technique)  | 4.1     | Pending     |
| V04 | Coat-type classification completeness          | 4.1     | Pending     |
| V05 | Half stitch for bird feather barbs             | 4.2     | Pending     |
| V06 | ΔE < 8 as color merge threshold                | 5.4     | Pending     |
| V07 | Time estimates for each finished size          | 5.5     | Pending     |
| V08 | Olympus pastel "1 stop darker" rule            | 6.4     | Pending     |
| V09 | Cosmo earth tone superiority for fur           | 6.4     | Pending     |
| V10 | 3,000 cross stitches per skein estimate        | 6.5     | Pending     |

---

## Appendix B: Reference — Why Existing Tools Fail

For context when explaining the technical advantage to stakeholders.

| Existing tool approach | What goes wrong |
|------------------------|----------------|
| Color cluster → grid fill (all features) | Whiskers, eyebrows, fine details disappear |
| Single-layer output | No back stitch layer → cannot represent any thin line |
| No French knot layer | Eye highlights must be faked as colored cells — look wrong |
| No quarter stitch | All boundaries are hard pixel staircases |
| DMC-only color mapping | Japanese stitchers (Olympus/Cosmo users) get poor color matches |

Stitchlog's approach: route each visual feature to the appropriate stitch type
before any color assignment happens. The "intelligence" is in the routing layer,
not in better pixel clustering.
