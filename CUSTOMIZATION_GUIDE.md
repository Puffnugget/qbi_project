# Customization & Filtering Guide

## Overview

The project now supports **dynamic filtering** and **per-layer weighting** for panel selection. Users can:

1. **Filter by cell line properties:** adherence type, doubling time, biosafety level, cancer type, gender
2. **Adjust layer weights:** emphasize RNA, Proteomics, Methylation, Histone marks, or Drug sensitivity

## Backend Components

### 1. Cell Line Properties (`processed_data/cell_line_properties.csv`)

Contains metadata for all 60 NCI-60 lines:
- `cell_line`: unique identifier (e.g., "BR:MCF7")
- `cancer_type`: tissue of origin
- `adherence`: "adherent" or "suspension"
- `doubling_time_hours`: cell doubling time
- `bsl_level`: biosafety level (1 or 2)
- `gender`: Male or Female
- `notes`: clinical/biological notes

### 2. Customization Engine (`src/customization.py`)

**Main function:**
```python
run_customized_selection(
    adherence="adherent",          # Filter by adherence type
    doubling_time_max=48,          # Max doubling time in hours
    bsl_level=1,                   # Biosafety level ≤ this
    cancer_type="Breast",          # Specific cancer type
    gender="Female",               # Gender filter
    layer_weights={                # Custom layer weighting
        "rna": 2.0,                # RNA 2x more important
        "prot": 1.0,
        "methyl": 0.5,             # Methylation half as important
        "histone": 1.0,
        "drug": 1.0,
    },
    max_k=15,                      # Max panel size
)
```

**Returns:**
```json
{
  "panels": {
    "2": [...],
    "3": [...],
    "8": [
      {
        "cell_line": "BR:MCF7",
        "cancer_type": "Breast",
        "step": 1
      },
      ...
    ]
  },
  "total_lines": 60,
  "filtered_lines": 38,
  "filters_applied": {...},
  "layer_weights": {...}
}
```

### 3. FastAPI Endpoints

**Get filter options:**
```bash
GET /filter-options
```

Response:
```json
{
  "adherence": ["adherent", "suspension"],
  "doubling_time": {"min": 12, "max": 96, "step": 6},
  "bsl_level": [1, 2],
  "cancer_types": ["Breast", "CNS", ...],
  "gender": ["Male", "Female"]
}
```

**Get customized panel:**
```bash
GET /custom-panel?size=8&adherence=adherent&doubling_time_max=48&rna_weight=2.0&drug_weight=0.5
```

Query parameters:
- `size`: panel size (2-20)
- `adherence`: "adherent" or "suspension"
- `doubling_time_max`: max doubling time in hours
- `bsl_level`: 1 or 2
- `cancer_type`: specific cancer type
- `gender`: "Male" or "Female"
- `rna_weight`, `prot_weight`, `methyl_weight`, `histone_weight`, `drug_weight`: layer weights (0.1-5.0)

Response:
```json
{
  "size": 8,
  "panel": [...],
  "filtered_lines": 38,
  "filters": {...},
  "layer_weights": {...}
}
```

## Frontend Integration

### 1. Add FilterControls Component

The `FilterControls.tsx` component provides the UI for filters and layer weights.

**Usage in your main page (e.g., `frontend/app/page.tsx`):**

```tsx
import { FilterControls } from '@/components/FilterControls'
import { useState } from 'react'

export default function Page() {
  const [filters, setFilters] = useState(null)

  const handleFilterChange = async (filterState) => {
    setFilters(filterState)
    
    // Call API to get customized panel
    const params = new URLSearchParams()
    params.append('size', panelSize)
    if (filterState.adherence) params.append('adherence', filterState.adherence)
    if (filterState.doublingTimeMax) params.append('doubling_time_max', filterState.doublingTimeMax)
    if (filterState.bslLevel) params.append('bsl_level', filterState.bslLevel)
    if (filterState.cancerType) params.append('cancer_type', filterState.cancerType)
    if (filterState.gender) params.append('gender', filterState.gender)
    
    params.append('rna_weight', filterState.rnaWeight)
    params.append('prot_weight', filterState.protWeight)
    params.append('methyl_weight', filterState.methylWeight)
    params.append('histone_weight', filterState.histoneWeight)
    params.append('drug_weight', filterState.drugWeight)
    
    const response = await fetch(`http://localhost:8000/custom-panel?${params}`)
    const data = await response.json()
    
    // Update 3D scene, coverage curve, etc. with new panel
    updateVisualization(data)
  }

  return (
    <div className="flex">
      <div className="w-1/4">
        <FilterControls 
          onFilterChange={handleFilterChange}
          onReset={() => {
            setFilters(null)
            // Reload default panel
            loadDefaultPanel()
          }}
        />
      </div>
      
      <div className="w-3/4">
        {/* 3D Scene, coverage curve, etc. */}
      </div>
    </div>
  )
}
```

### 2. Update Sidebar Layout

Add the FilterControls component to your existing Sidebar. Update the structure to:

```
┌─────────────────────────────────────┐
│  🎚️ Panel Size Slider              │
│  [====●=====]                       │
├─────────────────────────────────────┤
│  🔍 FILTERS                         │
│  ├─ Adherence Type: [All ▼]         │
│  ├─ Max Doubling Time: [24h ─● 96h] │
│  ├─ Biosafety Level: [All ▼]        │
│  ├─ Cancer Type: [All ▼]            │
│  └─ Gender: [All ▼]                 │
├─────────────────────────────────────┤
│  ⚖️ LAYER WEIGHTS                   │
│  ├─ RNA: [0.5 ─────●─────] 5.0x    │
│  ├─ Proteomics: [0.5 ──●──] 1.0x   │
│  ├─ Methylation: [0.5 ──●──] 0.5x  │
│  ├─ Histone: [0.5 ───●───] 1.0x    │
│  └─ Drug: [0.5 ────●────] 1.0x     │
├─────────────────────────────────────┤
│  🔄 Reset to Defaults               │
└─────────────────────────────────────┘
```

## Usage Examples

### Example 1: "I need fast-growing, adherent cell lines"

```
Adherence: adherent
Max Doubling Time: 24 hours
Result: 21 lines (from 60)
Panel size: 8 → BR:MCF7, HCT-116, LC:EKVX, ...
```

### Example 2: "I only care about breast cancer"

```
Cancer Type: Breast
Result: 4 lines available
Panel size: 4 → BR:MCF7, BR:MDA-MB-231, BR:HS 578T, BR:BT-549
```

### Example 3: "RNA-seq is my bottleneck"

```
Layer Weights:
  RNA: 0.5x (deprioritize)
  Drug: 2.0x (prioritize drug diversity)
Result: Panel emphasizes drug sensitivity diversity over RNA diversity
```

### Example 4: "I can't work with BSL-2 lines"

```
Biosafety Level: 1
Result: 48 lines (removed BSL-2: HOP-92, LXF-289)
```

### Example 5: "I need a diverse female panel"

```
Gender: Female
Cancer Type: All
Result: 41 lines
Panel size: 8 → [diverse across female lines]
```

## Running the Backend

### Start FastAPI server:
```bash
cd /Users/natashaprabhu/qbi_project
uvicorn api.main:app --reload --port 8000
```

### Test endpoints:
```bash
# Get filter options
curl http://localhost:8000/filter-options

# Get customized panel (adherent + fast-growing)
curl "http://localhost:8000/custom-panel?size=8&adherence=adherent&doubling_time_max=48"

# Get breast cancer panel with RNA emphasis
curl "http://localhost:8000/custom-panel?size=8&cancer_type=Breast&rna_weight=2.0"
```

## Running the Frontend

### Start Next.js dev server:
```bash
cd /Users/natashaprabhu/qbi_project/frontend
npm run dev
```

Open http://localhost:3000

## Implementation Checklist

- [ ] Backend: Cell line properties CSV created ✅
- [ ] Backend: Customization engine (`src/customization.py`) created ✅
- [ ] Backend: FastAPI endpoints added to `api/main.py` ✅
- [ ] Frontend: FilterControls component created ✅
- [ ] Frontend: Integrate FilterControls into Sidebar
- [ ] Frontend: Wire filter changes to API calls
- [ ] Frontend: Update 3D scene when filters change
- [ ] Frontend: Update coverage/validation curves when filters change
- [ ] Frontend: Update selection log when filters change
- [ ] Testing: Test each filter independently
- [ ] Testing: Test layer weight combinations
- [ ] Testing: Verify panel changes reflect new weights
- [ ] Demo: Show filter + weight customization in final demo

## Troubleshooting

**Q: No lines returned after filtering**
A: The filter combination was too restrictive. For example, if you filter for "Prostate + Female", there are no matches (only 2 prostate lines, both male).

**Q: Layer weights don't seem to affect selection**
A: Weights work by scaling variance. If RNA naturally dominates variance (26k genes), a 0.5x weight still leaves it important. Try 0.1x for extreme emphasis.

**Q: Why can't I filter by specific genes/pathways?**
A: Filters are at the cell line level (properties), not feature level. To prioritize specific pathways, adjust layer weights.

## Advanced: Adding New Filters

To add a new cell line property (e.g., "mutation_status"):

1. **Add column to `cell_line_properties.csv`**
2. **Update `apply_filters()` in `customization.py`**
3. **Add to FastAPI endpoint in `api/main.py`**
4. **Add UI dropdown to `FilterControls.tsx`**

Example: Add "TP53 Status" filter

```python
# In customization.py
if tp53_status:  # "WT", "Mutant", or "Deleted"
    for idx in fused.index:
        props_row = properties[properties["cell_line"] == idx]
        if props_row.empty or props_row.iloc[0]["tp53_status"] != tp53_status:
            mask[idx] = False
```

---

## Performance Notes

- **Customization is computed on-the-fly** (not precomputed)
- **Time: ~100-500ms per customization** (greedy selection on filtered subset)
- **Limit to queries during frontend interaction** (not in real-time sliders)
- **Cache results** if you want to show live updates as weights change

## Future Enhancements

1. **Save custom panels** — Let users bookmark favorite configurations
2. **Batch export** — Download 5+ custom panels at once as CSV/JSON
3. **Comparison matrix** — Side-by-side comparison of 2-3 custom panels
4. **Prediction by filter** — "Which filter improves drug prediction most?"
5. **Interactive filter suggestions** — "Try adding BSL-1 to reduce from 50→20 lines"
