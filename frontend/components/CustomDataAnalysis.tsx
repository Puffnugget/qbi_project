'use client'

import React, { useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'

interface AnalysisResult {
  recommended_lines: string[]
  panel_size: number
  coverage_score: number
  per_layer_coverage: Record<string, number>
  total_input_lines: number
  status: string
}

interface ProteinExpressionResult {
  protein: string
  high_expression: { cell_line: string; expression: number }[]
  low_expression: { cell_line: string; expression: number }[]
  available_proteins: string[]
}

export function CustomDataAnalysis() {
  const [activeTab, setActiveTab] = useState<'panel' | 'protein'>('panel')

  // Panel selection state
  const [rnaFile, setRnaFile] = useState<File | null>(null)
  const [proteinFile, setProteinFile] = useState<File | null>(null)
  const [drugFile, setDrugFile] = useState<File | null>(null)
  const [panelSize, setPanelSize] = useState(8)
  const [rnaWeight, setRnaWeight] = useState(1.0)
  const [proteinWeight, setProteinWeight] = useState(1.0)
  const [drugWeight, setDrugWeight] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Protein expression state
  const [proteinQuery, setProteinQuery] = useState<string>('')
  const [proteinLoading, setProteinLoading] = useState(false)
  const [proteinResult, setProteinResult] = useState<ProteinExpressionResult | null>(null)
  const [proteinError, setProteinError] = useState<string | null>(null)

  const handleFileChange = (file: File | null, setter: (f: File | null) => void) => {
    if (file && !['text/csv', 'application/json'].includes(file.type)) {
      setError('Files must be CSV or JSON format')
      return
    }
    setter(file)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!rnaFile && !proteinFile && !drugFile) {
      setError('Please upload at least one data file')
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    if (rnaFile) formData.append('rna', rnaFile)
    if (proteinFile) formData.append('protein', proteinFile)
    if (drugFile) formData.append('drug', drugFile)
    formData.append('panel_size', panelSize.toString())
    formData.append('rna_weight', rnaWeight.toString())
    formData.append('protein_weight', proteinWeight.toString())
    formData.append('drug_weight', drugWeight.toString())

    try {
      const response = await fetch('http://localhost:8000/analyze-custom-data', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Analysis failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleProteinSearch = async () => {
    if (!proteinQuery.trim()) {
      setProteinError('Please enter a protein name')
      return
    }

    setProteinLoading(true)
    setProteinError(null)

    try {
      const response = await fetch(
        `http://localhost:8000/protein-expression?protein=${encodeURIComponent(proteinQuery)}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Search failed')
      }

      const data = await response.json()
      setProteinResult(data)
    } catch (err) {
      setProteinError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setProteinLoading(false)
    }
  }

  if (result && activeTab === 'panel') {
    return <ResultsPanel result={result} onReset={() => setResult(null)} />
  }

  if (proteinResult && activeTab === 'protein') {
    return <ProteinExpressionResults result={proteinResult} onReset={() => setProteinResult(null)} />
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-fg">Analyze Your Data</h2>
        <p className="mt-1 text-sm text-fg-muted">
          {activeTab === 'panel'
            ? 'Upload your multi-omics datasets to find an optimal cell line panel'
            : 'Search for protein expression levels across the NCI-60 cell line panel'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('panel')}
          className={`pb-3 px-1 font-medium transition ${
            activeTab === 'panel'
              ? 'text-accent-bright border-b-2 border-accent-bright'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          Panel Selection
        </button>
        <button
          onClick={() => setActiveTab('protein')}
          className={`pb-3 px-1 font-medium transition ${
            activeTab === 'protein'
              ? 'text-accent-bright border-b-2 border-accent-bright'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          Protein Expression
        </button>
      </div>

      {/* Panel Selection Tab */}
      {activeTab === 'panel' && (
        <>
      {/* Upload Card */}
      <Card className="space-y-4">
        <CardHeader>
          <p className="label-caps">Upload omics data</p>
        </CardHeader>
        <div className="space-y-3 px-6 pb-6">
          <FileUpload
            label="RNA-seq data"
            file={rnaFile}
            onChange={(f) => handleFileChange(f, setRnaFile)}
            required={!proteinFile && !drugFile}
          />
          <FileUpload
            label="Proteomics data"
            file={proteinFile}
            onChange={(f) => handleFileChange(f, setProteinFile)}
            required={!rnaFile && !drugFile}
          />
          <FileUpload
            label="Drug sensitivity data"
            file={drugFile}
            onChange={(f) => handleFileChange(f, setDrugFile)}
            required={!rnaFile && !proteinFile}
          />
        </div>
      </Card>

      {/* Settings Card */}
      <Card className="space-y-4">
        <CardHeader>
          <p className="label-caps">Analysis settings</p>
        </CardHeader>
        <div className="space-y-6 px-6 pb-6">
          {/* Panel Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-fg">Panel size</label>
              <span className="text-sm font-mono text-accent-bright">{panelSize}</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              value={panelSize}
              onChange={(e) => setPanelSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Layer Weights */}
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">Layer weights</p>
            <WeightSlider
              label="RNA"
              value={rnaWeight}
              onChange={setRnaWeight}
              disabled={!rnaFile}
            />
            <WeightSlider
              label="Protein"
              value={proteinWeight}
              onChange={setProteinWeight}
              disabled={!proteinFile}
            />
            <WeightSlider
              label="Drug"
              value={drugWeight}
              onChange={setDrugWeight}
              disabled={!drugFile}
            />
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={loading || (!rnaFile && !proteinFile && !drugFile)}
        className="btn-primary w-full"
      >
        {loading ? 'Analyzing...' : 'Analyze my data'}
      </button>
        </>
      )}

      {/* Protein Expression Tab */}
      {activeTab === 'protein' && (
        <>
      {/* Protein Search Card */}
      <Card className="space-y-4">
        <CardHeader>
          <p className="label-caps">Search protein expression</p>
        </CardHeader>
        <div className="space-y-4 px-6 pb-6">
          <div>
            <label className="block text-sm font-medium text-fg mb-2">
              Protein name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={proteinQuery}
                onChange={(e) => setProteinQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProteinSearch()}
                placeholder="e.g., EGFR, TP53, BRCA1, MYC, KRAS"
                className="flex-1 px-3 py-2 rounded border border-border bg-surface text-fg placeholder:text-fg-muted"
              />
              <button
                onClick={handleProteinSearch}
                disabled={proteinLoading || !proteinQuery.trim()}
                className="btn-primary px-4"
              >
                {proteinLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Error */}
      {proteinError && (
        <div className="card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {proteinError}
        </div>
      )}
        </>
      )}
    </div>
  )
}

function FileUpload({
  label,
  file,
  onChange,
  required,
}: {
  label: string
  file: File | null
  onChange: (f: File | null) => void
  required: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger ml-1">*</span> : <span className="text-fg-subtle text-xs ml-1">(optional)</span>}
      </label>
      <div className="relative mt-2 cursor-pointer">
        <input
          type="file"
          accept=".csv,.json"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div
          className={`rounded border-2 border-dashed px-4 py-3 text-center transition ${
            file
              ? 'border-success bg-success/5'
              : 'border-border hover:border-border-strong'
          }`}
        >
          <p className="text-sm font-medium text-fg">
            {file ? file.name : 'Click to upload or drag and drop'}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {file ? 'Ready to analyze' : 'CSV or JSON'}
          </p>
        </div>
      </div>
    </div>
  )
}

function WeightSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between">
        <label className="text-sm text-fg">{label}</label>
        <span className="text-sm font-mono text-accent-bright">{value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="mt-1 w-full"
      />
    </div>
  )
}

function ResultsPanel({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-fg">Analysis complete</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Your optimal cell line panel has been selected
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Input lines" value={result.total_input_lines} />
        <MetricCard label="Panel size" value={result.panel_size} />
        <MetricCard
          label="Coverage"
          value={`${(result.coverage_score * 100).toFixed(0)}%`}
        />
        <MetricCard
          label="Diversity"
          value={
            result.coverage_score > 0.5
              ? 'Excellent'
              : result.coverage_score > 0.3
                ? 'Good'
                : 'Moderate'
          }
        />
      </div>

      {/* Recommended Lines */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="label-caps">Recommended cell lines</p>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 px-6 pb-6">
          {result.recommended_lines.map((line, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-border bg-surface-elevated p-3"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-surface-elevated">
                {i + 1}
              </span>
              <span className="font-mono text-sm text-fg">{line}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Per-Layer Coverage */}
      {Object.keys(result.per_layer_coverage).length > 0 && (
        <Card className="space-y-3">
          <CardHeader>
            <p className="label-caps">Per-layer coverage</p>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            {Object.entries(result.per_layer_coverage).map(([layer, coverage]) => (
              <div key={layer}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-fg capitalize">{layer}</span>
                  <span className="text-xs font-mono text-accent-bright">
                    {(coverage * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                  <div
                    className="h-full bg-accent-teal transition-all"
                    style={{ width: `${coverage * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onReset} className="btn-ghost flex-1">
          Analyze another
        </button>
        <button className="btn-primary flex-1">Download CSV</button>
      </div>
    </div>
  )
}

function ProteinExpressionResults({
  result,
  onReset,
}: {
  result: ProteinExpressionResult
  onReset: () => void
}) {
  const [sortOrder, setSortOrder] = useState<'high' | 'low'>('high')

  const displayData = sortOrder === 'high' ? result.high_expression : result.low_expression

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-fg">
          Expression of {result.protein}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Cell lines sorted by protein expression level
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setSortOrder('high')}
          className={`pb-3 px-1 font-medium transition ${
            sortOrder === 'high'
              ? 'text-accent-bright border-b-2 border-accent-bright'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          High Expression
        </button>
        <button
          onClick={() => setSortOrder('low')}
          className={`pb-3 px-1 font-medium transition ${
            sortOrder === 'low'
              ? 'text-accent-bright border-b-2 border-accent-bright'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          Low Expression
        </button>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="label-caps">
            {sortOrder === 'high' ? 'High' : 'Low'} expression cell lines
          </p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-surface-elevated/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-fg-muted">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-fg-muted">
                  Cell Line
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-fg-muted">
                  Expression Level
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-surface-elevated/30">
                  <td className="px-6 py-3 text-sm text-fg-muted">{i + 1}</td>
                  <td className="px-6 py-3 text-sm font-medium text-fg">{item.cell_line}</td>
                  <td className="px-6 py-3 text-sm text-right text-accent-bright font-mono">
                    {item.expression.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onReset} className="btn-ghost flex-1">
          Search another protein
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card space-y-1 p-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-2xl font-semibold text-accent-bright">{value}</p>
    </div>
  )
}
