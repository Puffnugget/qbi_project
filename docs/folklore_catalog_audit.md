# Folklore catalog audit

- **Cell lines:** 60
- **Drugs:** 150
- **Drugs with any missing values:** 111

**Rule:** Exclude drugs with <55/60 observed responses from demo_drugs.json

## Sparse drugs (top 20)

```json
[
  {
    "drug": "NSC_638850_7_Hydroxystaurosporine",
    "missing": 5,
    "n_cell_lines": 55
  },
  {
    "drug": "NSC_138783_Bendamustine",
    "missing": 5,
    "n_cell_lines": 55
  },
  {
    "drug": "NSC_791966_CFI_400945",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_767896_LY_2940680",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_777571_BIX_01294",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_781556_JNJ_42756493",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_762419_CT_32228",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_754771_Itraconazole",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_719627_Celecoxib",
    "missing": 3,
    "n_cell_lines": 57
  },
  {
    "drug": "NSC_791328_ARQ_092",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_791967_TAK_659_isomer_1",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_771644_ARQ_621",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_767745_Pelitrexol",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_792956_AZD_0156",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_777445_GSK_1070916",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_768068_Cobimetinib_isomer_1",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_772254_ARRY_520_Isomer_A",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_791648_PF_2771",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_760442_Daporinad",
    "missing": 2,
    "n_cell_lines": 58
  },
  {
    "drug": "NSC_791163_RG_7602",
    "missing": 2,
    "n_cell_lines": 58
  }
]
```

## Cell lines with missing entries

```json
[
  {
    "cell_line": "BR:MDA-MB-231",
    "missing": 1
  },
  {
    "cell_line": "BR:BT-549",
    "missing": 1
  },
  {
    "cell_line": "BR:T-47D",
    "missing": 1
  },
  {
    "cell_line": "CO:HCC-2998",
    "missing": 1
  },
  {
    "cell_line": "LE:CCRF-CEM",
    "missing": 1
  },
  {
    "cell_line": "LE:HL-60(TB)",
    "missing": 2
  },
  {
    "cell_line": "LE:K-562",
    "missing": 4
  },
  {
    "cell_line": "LE:RPMI-8226",
    "missing": 1
  },
  {
    "cell_line": "LE:SR",
    "missing": 5
  },
  {
    "cell_line": "ME:M14",
    "missing": 1
  },
  {
    "cell_line": "ME:SK-MEL-5",
    "missing": 1
  },
  {
    "cell_line": "ME:UACC-257",
    "missing": 1
  },
  {
    "cell_line": "ME:UACC-62",
    "missing": 1
  },
  {
    "cell_line": "ME:MDA-N",
    "missing": 107
  },
  {
    "cell_line": "LC:EKVX",
    "missing": 9
  },
  {
    "cell_line": "LC:HOP-92",
    "missing": 1
  },
  {
    "cell_line": "LC:NCI-H226",
    "missing": 2
  },
  {
    "cell_line": "LC:NCI-H322M",
    "missing": 3
  },
  {
    "cell_line": "LC:NCI-H522",
    "missing": 1
  },
  {
    "cell_line": "PR:DU-145",
    "missing": 1
  },
  {
    "cell_line": "RE:CAKI-1",
    "missing": 6
  }
]
```

## Drop candidates

```json
[]
```
