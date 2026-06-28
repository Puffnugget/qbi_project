'use client'

import React, { useState, useCallback } from 'react'

interface FilterState {
  adherence: string | null
  doublingTimeMax: number | null
  bslLevel: number | null
  cancerType: string | null
  gender: string | null
  rnaWeight: number
  protWeight: number
  methylWeight: number
  histoneWeight: number
  drugWeight: number
}

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void
  onReset: () => void
}

export function FilterControls({ onFilterChange, onReset }: FilterControlsProps) {
  const [filters, setFilters] = useState<FilterState>({
    adherence: null,
    doublingTimeMax: null,
    bslLevel: null,
    cancerType: null,
    gender: null,
    rnaWeight: 1.0,
    protWeight: 1.0,
    methylWeight: 1.0,
    histoneWeight: 1.0,
    drugWeight: 1.0,
  })

  const [expanded, setExpanded] = useState({
    filters: false,
    weights: false,
  })

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
      const newFilters = { ...filters, [key]: value }
      setFilters(newFilters)
      onFilterChange(newFilters)
    },
    [filters, onFilterChange]
  )

  const handleReset = useCallback(() => {
    const defaultFilters: FilterState = {
      adherence: null,
      doublingTimeMax: null,
      bslLevel: null,
      cancerType: null,
      gender: null,
      rnaWeight: 1.0,
      protWeight: 1.0,
      methylWeight: 1.0,
      histoneWeight: 1.0,
      drugWeight: 1.0,
    }
    setFilters(defaultFilters)
    onReset()
  }, [onReset])

  return (
    <div className="space-y-4 bg-slate-800 p-4 rounded-lg">
      {/* FILTER SECTION */}
      <div>
        <button
          onClick={() => setExpanded({ ...expanded, filters: !expanded.filters })}
          className="w-full flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white"
        >
          <span>🔍 FILTERS</span>
          <span>{expanded.filters ? '▼' : '▶'}</span>
        </button>

        {expanded.filters && (
          <div className="mt-3 space-y-3">
            {/* Adherence */}
            <div>
              <label className="text-xs text-slate-400">Adherence Type</label>
              <select
                value={filters.adherence || ''}
                onChange={(e) => handleFilterChange('adherence', e.target.value || null)}
                className="w-full mt-1 px-2 py-1 bg-slate-700 text-slate-100 text-xs rounded border border-slate-600"
              >
                <option value="">All types</option>
                <option value="adherent">Adherent only</option>
                <option value="suspension">Suspension only</option>
              </select>
            </div>

            {/* Doubling Time */}
            <div>
              <label className="text-xs text-slate-400">
                Max Doubling Time: {filters.doublingTimeMax ? `${filters.doublingTimeMax}h` : 'Any'}
              </label>
              <input
                type="range"
                min="12"
                max="96"
                step="6"
                value={filters.doublingTimeMax || 96}
                onChange={(e) =>
                  handleFilterChange('doublingTimeMax', e.target.value === '96' ? null : parseInt(e.target.value))
                }
                className="w-full mt-1"
              />
              <div className="text-xs text-slate-400 mt-1">Fast (12h) ◄─────► Slow (96h)</div>
            </div>

            {/* BSL Level */}
            <div>
              <label className="text-xs text-slate-400">Biosafety Level</label>
              <select
                value={filters.bslLevel || ''}
                onChange={(e) => handleFilterChange('bslLevel', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full mt-1 px-2 py-1 bg-slate-700 text-slate-100 text-xs rounded border border-slate-600"
              >
                <option value="">All levels</option>
                <option value="1">BSL-1 (Safe)</option>
                <option value="2">BSL-2 (Moderate)</option>
              </select>
            </div>

            {/* Cancer Type */}
            <div>
              <label className="text-xs text-slate-400">Cancer Type</label>
              <select
                value={filters.cancerType || ''}
                onChange={(e) => handleFilterChange('cancerType', e.target.value || null)}
                className="w-full mt-1 px-2 py-1 bg-slate-700 text-slate-100 text-xs rounded border border-slate-600"
              >
                <option value="">All types</option>
                <option value="Breast">Breast</option>
                <option value="CNS">CNS</option>
                <option value="Colon">Colon</option>
                <option value="Leukemia">Leukemia</option>
                <option value="Lung">Lung</option>
                <option value="Melanoma">Melanoma</option>
                <option value="Ovarian">Ovarian</option>
                <option value="Prostate">Prostate</option>
                <option value="Renal">Renal</option>
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="text-xs text-slate-400">Gender</label>
              <select
                value={filters.gender || ''}
                onChange={(e) => handleFilterChange('gender', e.target.value || null)}
                className="w-full mt-1 px-2 py-1 bg-slate-700 text-slate-100 text-xs rounded border border-slate-600"
              >
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* LAYER WEIGHTS SECTION */}
      <div>
        <button
          onClick={() => setExpanded({ ...expanded, weights: !expanded.weights })}
          className="w-full flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white"
        >
          <span>⚖️ LAYER WEIGHTS</span>
          <span>{expanded.weights ? '▼' : '▶'}</span>
        </button>

        {expanded.weights && (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-slate-400 mb-3">
              Adjust how much each omics layer influences panel selection
            </div>

            {/* RNA */}
            <div>
              <div className="flex justify-between">
                <label className="text-xs text-slate-300">RNA</label>
                <span className="text-xs text-slate-400">{filters.rnaWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={filters.rnaWeight}
                onChange={(e) => handleFilterChange('rnaWeight', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Proteomics */}
            <div>
              <div className="flex justify-between">
                <label className="text-xs text-slate-300">Proteomics</label>
                <span className="text-xs text-slate-400">{filters.protWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={filters.protWeight}
                onChange={(e) => handleFilterChange('protWeight', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Methylation */}
            <div>
              <div className="flex justify-between">
                <label className="text-xs text-slate-300">Methylation</label>
                <span className="text-xs text-slate-400">{filters.methylWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={filters.methylWeight}
                onChange={(e) => handleFilterChange('methylWeight', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Histone */}
            <div>
              <div className="flex justify-between">
                <label className="text-xs text-slate-300">Histone Marks</label>
                <span className="text-xs text-slate-400">{filters.histoneWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={filters.histoneWeight}
                onChange={(e) => handleFilterChange('histoneWeight', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Drug */}
            <div>
              <div className="flex justify-between">
                <label className="text-xs text-slate-300">Drug Sensitivity</label>
                <span className="text-xs text-slate-400">{filters.drugWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={filters.drugWeight}
                onChange={(e) => handleFilterChange('drugWeight', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* RESET BUTTON */}
      <button
        onClick={handleReset}
        className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded transition"
      >
        🔄 Reset to Defaults
      </button>
    </div>
  )
}
