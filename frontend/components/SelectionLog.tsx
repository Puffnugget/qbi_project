"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { CANCER_COLORS } from "@/lib/constants";
import type { CharacterizationEntry, PanelEntry } from "@/lib/types";

interface SelectionLogProps {
  entries?: PanelEntry[];
  characterization?: Record<string, CharacterizationEntry>;
}

function downloadCsv(
  entries: PanelEntry[],
  characterization: Record<string, CharacterizationEntry>,
) {
  const header = "cell_line,cancer_type,step,why_selected,top_genes\n";
  const rows = entries.map((e) => {
    const c = characterization[e.cell_line];
    const genes = (c?.top_genes ?? []).join("|");
    const why = (c?.why_selected ?? "").replace(/,/g, ";");
    return `${e.cell_line},${e.cancer_type},${e.step},"${why}","${genes}"`;
  });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "panel_selection.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SelectionLog({
  entries = [],
  characterization = {},
}: SelectionLogProps) {
  if (entries.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center text-sm text-fg-muted">
        No panel selected yet
      </div>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <p className="label-caps">Selection log</p>
        <button
          type="button"
          onClick={() => downloadCsv(entries, characterization)}
          className="btn-ghost px-2 py-1 text-xs"
        >
          Download CSV
        </button>
      </CardHeader>
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs text-fg-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Cell line</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Step</th>
              <th className="px-4 py-2 font-medium">Top genes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const c = characterization[e.cell_line];
              const color = CANCER_COLORS[e.cancer_type] ?? "#888";
              return (
                <tr
                  key={`${e.cell_line}-${e.step}`}
                  className="border-t border-border/60 text-fg-muted"
                >
                  <td className="px-4 py-2 font-mono text-xs text-fg">
                    {e.cell_line}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {e.cancer_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.step}</td>
                  <td className="px-4 py-2 text-xs text-fg-subtle">
                    {(c?.top_genes ?? []).slice(0, 3).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
