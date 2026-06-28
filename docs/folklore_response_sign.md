# Folklore drug-response sign

Confirmed: lower matrix values = stronger growth inhibition (sensitive). Simulator thresholds sensitive<=-1.0, resistant>=0.0 match the encoded self-check in src/folklore/simulator.py.

Matrix value range: -5.990 to 6.180

## Spot checks

```json
[
  {
    "drug": "Paclitaxel",
    "BR:MCF7": 0.6,
    "note": "Expect moderate/positive on some lines; tubulin agent"
  },
  {
    "drug": "Methotrexate",
    "median": 0.44,
    "pct_below_sensitive": 0.2
  },
  {
    "drug": "Erlotinib",
    "LC:A549/ATCC": -0.14,
    "LC:NCI-H460": 0.12,
    "note": "EGFR inhibitor; lung lines often lower (more sensitive)"
  }
]
```
