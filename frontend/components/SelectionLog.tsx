"use client";

import { CANCER_COLORS } from "@/lib/constants";
import type { CharacterizationEntry, PanelEntry } from "@/lib/types";

interface SelectionLogProps {
  entries?: PanelEntry[];
  characterization?: Record<string, CharacterizationEntry>;
}

function downloadCsv(entries: PanelEntry[], characterization: Record<string, CharacterizationEntry>) {
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
      <div className="flex h-48 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a18] text-sm text-zinc-500">
        No panel selected yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0a18]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Selection log
        </p>
        <button
          type="button"
          onClick={() => downloadCsv(entries, characterization)}
          className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          Download CSV
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#0a0a18] text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-normal">Cell line</th>
              <th className="px-4 py-2 font-normal">Type</th>
              <th className="px-4 py-2 font-normal">Step</th>
              <th className="px-4 py-2 font-normal">Top genes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const c = characterization[e.cell_line];
              const color = CANCER_COLORS[e.cancer_type] ?? "#888";
              return (
                <tr
                  key={`${e.cell_line}-${e.step}`}
                  className="border-t border-white/5 text-zinc-300"
                >
                  <td className="px-4 py-2 font-mono text-xs">{e.cell_line}</td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ backgroundColor: `${color}33`, color }}
                    >
                      {e.cancer_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.step}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {(c?.top_genes ?? []).slice(0, 3).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
