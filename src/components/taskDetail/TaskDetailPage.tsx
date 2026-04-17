import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { nsaThemesConfig } from '../../data/nsaThemesConfig'
import { getLocationsForRec } from '../../data/locationsData'
import type { ChecklistStep } from '../../types'

const BASE = import.meta.env.BASE_URL

// ── Styled dark tooltip wrapper ───────────────────────────────────────────────
function StyledTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#212121] text-white text-[11px] leading-[16px] rounded-full whitespace-nowrap pointer-events-none z-50 shadow-sm">
          {label}
        </div>
      )}
    </div>
  )
}

// ── Reusable accordion (controlled) ──────────────────────────────────────────
function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-[#eaeaea]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#fafafa] transition-colors"
      >
        <span className="text-[13px] text-[#212121] font-normal leading-[20px]">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  )
}

// ── Sidebar metadata row ──────────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 pt-3 pb-2">
      <span className="text-[11px] text-[#888] leading-[14px] tracking-[0.44px] uppercase font-normal">
        {label}
      </span>
      <div className="text-[13px] text-[#212121] leading-[20px] font-normal">{children}</div>
    </div>
  )
}

// ── Pin icon for location popover ─────────────────────────────────────────────
function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}


// ── Platform favicon helpers ──────────────────────────────────────────────────
const PLATFORM_DOMAIN_MAP: Record<string, string> = {
  'gemini':     'gemini.google.com',
  'chatGPT':    'chatgpt.com',
  'perplexity': 'perplexity.ai',
}

function getFaviconUrl(platform: string): string {
  const domain = PLATFORM_DOMAIN_MAP[platform]
    ?? (platform.includes('.') ? platform : null)
  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : ''
}

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  'SWOT':             'bg-[#e8f4fd] text-[#1976d2]',
  'Multiple sources': 'bg-[#f3f4f6] text-[#555]',
}

function PlatformIcon({ platform }: { platform: string }) {
  const faviconUrl = getFaviconUrl(platform)
  if (faviconUrl) {
    return (
      <img
        src={faviconUrl}
        alt={platform}
        className="w-4 h-4 rounded-sm flex-shrink-0"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  const colorClass = PLATFORM_BADGE_COLORS[platform] ?? 'bg-[#f3f4f6] text-[#555]'
  return (
    <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${colorClass}`}>
      {platform.charAt(0).toUpperCase()}
    </span>
  )
}

// ── Platform colors for citation badges ───────────────────────────────────────
const LLM_PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  ChatGPT:    { bg: '#10a37f', text: '#fff' },
  Gemini:     { bg: '#4285F4', text: '#fff' },
  Perplexity: { bg: '#6B21A8', text: '#fff' },
  Claude:     { bg: '#C77B3A', text: '#fff' },
}

// ── Competitor list layout ────────────────────────────────────────────────────
const RING_COLORS = ['#6366f1', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6']
const YOU_COLOR   = '#0f7195'

function CompetitorIntelligenceLayout({
  competitors,
  youCitations,
  youName,
  llmSummary,
  expandedCompetitor,
  setExpandedCompetitor,
}: {
  competitors: { name: string; pageUrl?: string; totalCitations: number; citationRank: number; citedBy: string[]; llmSnippet: string; platformSnippets?: { platform: string; prompt: string; snippet: string }[] }[]
  youCitations: number
  youName: string
  llmSummary: string
  expandedCompetitor: number | null
  setExpandedCompetitor: (i: number | null) => void
}) {
  const sorted = [...competitors].sort((a, b) => a.citationRank - b.citationRank)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {sorted.map((comp, i) => {
          const color = RING_COLORS[i % RING_COLORS.length]
          const isExpanded = expandedCompetitor === i
          return (
            <div key={comp.name} className="border-b border-[#eaeaea] last:border-b-0 py-3">
              {/* Row: avatar + meta */}
              <div className="flex gap-3 items-start">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                >
                  {comp.name.charAt(0)}
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-normal text-[#212121] leading-[20px]">{comp.name}</span>
                    <span className="text-[#ccc]">·</span>
                    <span className="text-[12px] text-[#555] leading-[18px]">Cited {comp.totalCitations} times</span>
                    <span className="text-[#ccc]">·</span>
                    <span className="text-[12px] text-[#555] leading-[18px]">Citation rank #{comp.citationRank}</span>
                  </div>
                  {/* Snippet + inline View citations button */}
                  <div className="flex items-center gap-1 mt-1 min-w-0">
                    <p className="text-[12px] text-[#555] leading-[18px] truncate flex-1 min-w-0">
                      {comp.llmSnippet}
                    </p>
                    <button
                      onClick={() => setExpandedCompetitor(isExpanded ? null : i)}
                      className="text-[12px] font-medium text-[#212121] hover:underline flex-shrink-0 cursor-pointer"
                    >
                      {isExpanded ? 'Hide citations' : 'View citations'}
                    </button>
                  </div>

                  {/* Expanded: page link + per-platform snippets + your position */}
                  {isExpanded && (
                    <div className="mt-3 flex flex-col gap-3">
                      {/* External page link if available */}
                      {comp.pageUrl && (
                        <a
                          href={comp.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-[#1976d2] hover:underline self-start"
                        >
                          View their page
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}

                      {/* Competitor AI snippets */}
                      {comp.platformSnippets && comp.platformSnippets.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-[#888] uppercase tracking-[0.4px] font-medium leading-[14px]">
                            What AI says about them
                          </p>
                          {comp.platformSnippets.map((ps, j) => {
                            const pclr = LLM_PLATFORM_COLORS[ps.platform]
                            return (
                              <div key={j} className="bg-[#fafafa] border border-[#eaeaea] rounded-lg px-3 py-2.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                    style={pclr ? { backgroundColor: pclr.bg, color: pclr.text } : { backgroundColor: '#f3f4f6', color: '#555' }}
                                  >
                                    {ps.platform}
                                  </span>
                                  <span className="text-[11px] text-[#888] leading-[16px] truncate italic">"{ps.prompt}"</span>
                                </div>
                                <p className="text-[12px] text-[#212121] leading-[18px]">"{ps.snippet}"</p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Your position */}
                      {llmSummary && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[11px] text-[#888] uppercase tracking-[0.4px] font-medium leading-[14px]">
                            Where you appear
                          </p>
                          <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: YOU_COLOR }}
                              >
                                {youName.charAt(0)}
                              </div>
                              <span className="text-[11px] font-medium leading-[16px]" style={{ color: YOU_COLOR }}>{youName}</span>
                            </div>
                            <p className="text-[12px] text-[#555] leading-[18px]">{llmSummary}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* "You" row */}
        <div className="pt-3 pb-1">
          <div className="flex gap-3 items-start">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 mt-0.5"
              style={{ backgroundColor: YOU_COLOR }}
            >
              {youName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium leading-[20px]" style={{ color: YOU_COLOR }}>{youName}</span>
                <span className="text-[#ccc]">·</span>
                <span className="text-[12px] text-[#555] leading-[18px]">Cited {youCitations} times</span>
              </div>
              <p className="text-[12px] text-[#555] leading-[18px] mt-1">{llmSummary}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Rich content box rendered below each step's description ──────────────────
function StepRichBox({ step }: { step: ChecklistStep }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(value: string, key: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (step.stepType === 'link' && step.links && step.links.length > 0) {
    return (
      <div className="mt-2 border border-[#eaeaea] rounded-lg overflow-hidden">
        {step.links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[#eaeaea] last:border-b-0 hover:bg-[#fafafa] transition-colors group"
          >
            <span className="text-[13px] text-[#1976d2] leading-[20px] group-hover:underline">
              {link.label}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-60 group-hover:opacity-100">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        ))}
      </div>
    )
  }

  if (step.stepType === 'nap' && step.napData) {
    const { name, address, phone } = step.napData
    const rows: { key: string; label: string; value: string }[] = [
      { key: 'name',    label: 'Business name', value: name },
      { key: 'address', label: 'Address',        value: address },
      { key: 'phone',   label: 'Phone',          value: phone },
    ]
    return (
      <div className="mt-2 border border-[#eaeaea] rounded-lg overflow-hidden">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-3 px-3 py-2.5 border-b border-[#eaeaea] last:border-b-0 bg-white">
            <span className="text-[11px] text-[#888] leading-[16px] w-24 flex-shrink-0 uppercase tracking-[0.3px]">
              {row.label}
            </span>
            <span className="text-[13px] text-[#212121] leading-[20px] flex-1 min-w-0">
              {row.value}
            </span>
            <button
              onClick={() => copyToClipboard(row.value, row.key)}
              title="Copy"
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-[#f0f0f0] transition-colors"
            >
              {copied === row.key ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#377e2c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    )
  }

  if (step.stepType === 'keyword' && step.keywords && step.keywords.length > 0) {
    return (
      <div className="mt-2 border border-[#eaeaea] rounded-lg px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {step.keywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 bg-white text-[#212121] border border-[#eaeaea] rounded px-2 py-1 text-[12px] leading-[18px] cursor-pointer hover:bg-[#f5f5f5] transition-colors"
              onClick={() => copyToClipboard(kw, `kw-${i}`)}
              title="Click to copy"
            >
              {kw}
              {copied === `kw-${i}` ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#377e2c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[#888] mt-2 leading-[16px]">Click any phrase to copy it</p>
      </div>
    )
  }

  if (step.targetPage && (step.stepType === 'task' || !step.stepType)) {
    return (
      <div className="mt-2 border border-[#eaeaea] rounded-lg px-3 py-2.5 flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span className="text-[12px] text-[#555] leading-[18px] truncate">{step.targetPage}</span>
      </div>
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { recommendations, completeRec, metrics, activeDetailTab, setDetailTab } = useAppStore()

  const rec       = recommendations.find(r => r.id === id)
  const activeTab = activeDetailTab[id!] ?? 0
  const setTab    = (i: number) => setDetailTab(id!, i)

  if (!rec) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[#555]">
        <p className="text-[16px]">Recommendation not found</p>
        <button
          onClick={() => navigate('/recommendations')}
          className="text-[#1976d2] text-[14px] hover:underline"
        >
          ← Back to recommendations
        </button>
      </div>
    )
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const themeConfig    = nsaThemesConfig[rec.themeId]
  const locationCount  = rec.locations ?? 1
  const locations      = getLocationsForRec(rec.id, locationCount)
  const firstLocation  = locations[0] ?? 'Dubbo, NSW 2830'
  const extraLocations = locationCount - 1

  const acceptedDate = rec.acceptedAt
    ? new Date(rec.acceptedAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  const createdDate = new Date(rec.createdAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const [expandedCompetitor, setExpandedCompetitor] = useState<number | null>(null)

  // ── Accordion group (only one open at a time) ─────────────────────────────
  const [openAccordion, setOpenAccordion] = useState<string>('basic')
  const toggleAccordion = (key: string) =>
    setOpenAccordion(current => (current === key ? '' : key))

  // ── Location hover popover (portal — bypasses sidebar overflow clipping) ──
  const [showLocHover, setShowLocHover]     = useState(false)
  const [locPopoverPos, setLocPopoverPos]   = useState({ top: 0, left: 0 })
  const locMoreRef                          = useRef<HTMLSpanElement>(null)

  const handleLocEnter = () => {
    if (locMoreRef.current) {
      const rect = locMoreRef.current.getBoundingClientRect()
      setLocPopoverPos({ top: rect.bottom + 6, left: rect.left })
    }
    setShowLocHover(true)
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden pl-6 pb-2">

      {/* ══════════════════════════════════════════════════════════
          LEFT CARD
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 border border-[#eaeaea] bg-white overflow-hidden rounded-[8px]"
        style={{ width: '30%' }}
      >
        {/* ── Main container — unified wrapper for all card content ── */}
        <div className="flex flex-col flex-1 overflow-y-auto min-h-0">

        {/* Chips */}
        <div className="flex items-center gap-2 flex-wrap px-5 pt-5 pb-3">
          {(rec.status === 'accepted' || rec.status === 'in_progress') && (
            <span className="inline-flex items-center px-2 py-1 rounded text-[12px] leading-[18px] tracking-[-0.24px] font-normal" style={{ backgroundColor: '#fef3d6', color: '#c69204' }}>
              Accepted
            </span>
          )}
          <span className="inline-flex items-center px-2 py-1 rounded text-[12px] leading-[18px] tracking-[-0.24px] bg-[#eaeaea] text-[#555] font-normal">
            {rec.category}
          </span>
          {rec.effort === 'Quick win' && (
            <span className="inline-flex items-center gap-1 text-[12px] leading-[18px] font-normal text-[#555]">
              <img src={`${BASE}assets/electric_bolt.svg`} alt="" className="w-3.5 h-3.5 flex-shrink-0" />
              Quick wins
            </span>
          )}
          {rec.effort === 'Bigger lift' && (
            <span className="inline-flex items-center gap-1 text-[12px] leading-[18px] font-normal text-[#c65c04]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.74V17H8v-2.26A7 7 0 0 1 12 2z" />
              </svg>
              Bigger lift
            </span>
          )}
        </div>

        {/* Title */}
        <p className="px-5 pb-1 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px] font-normal">
          {rec.title}
        </p>

        {/* Description */}
        <p className="px-5 pb-4 text-[12px] text-[#555] leading-[20px] font-normal">
          {rec.description}
        </p>

        {/* Action icon buttons */}
        <div className="flex items-center gap-2 px-5 pb-3">
          {/* Notify */}
          <StyledTooltip label="Notify">
            <button className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </button>
          </StyledTooltip>
          {/* Download */}
          <StyledTooltip label="Download">
            <button className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </StyledTooltip>
        </div>

        {/* ── ACCORDION: Basic details ─────────────────────────── */}
        <Accordion title="Basic details" open={openAccordion === 'basic'} onToggle={() => toggleAccordion('basic')}>
          <div className="flex flex-col -mb-3">
            <InfoRow label="Type">{rec.category}</InfoRow>
            {rec.expectedImpact && (
              <InfoRow label="Impact">
                <span className="text-[12px] font-medium text-[#212121] leading-[20px]">{rec.expectedImpact}</span>
              </InfoRow>
            )}
            {themeConfig && (
              <InfoRow label="Related theme">{themeConfig.label}</InfoRow>
            )}
            <InfoRow label="Locations">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[13px] text-[#212121]">{firstLocation}</span>
                {extraLocations > 0 && (
                  <span
                    ref={locMoreRef}
                    className="text-[12px] font-medium text-[#212121] cursor-pointer hover:underline"
                    onMouseEnter={handleLocEnter}
                    onMouseLeave={() => setShowLocHover(false)}
                  >
                    +{extraLocations} more
                  </span>
                )}
              </div>
            </InfoRow>
            <InfoRow label="Created on">{createdDate}</InfoRow>
            {(rec.status === 'accepted' || rec.status === 'in_progress' || rec.status === 'completed') && acceptedDate && (
              <InfoRow label="Accepted on">{acceptedDate}</InfoRow>
            )}
            {(rec.status === 'accepted' || rec.status === 'in_progress' || rec.status === 'completed') && rec.acceptedBy && (
              <InfoRow label="Accepted by">{rec.acceptedBy}</InfoRow>
            )}
            {(rec.status === 'accepted' || rec.status === 'in_progress' || rec.status === 'completed') && (
              <InfoRow label="Assigned to">{rec.assignedTo ?? '-'}</InfoRow>
            )}
          </div>
        </Accordion>

        {/* Location hover popover — rendered via portal to escape overflow clipping */}
        {showLocHover && createPortal(
          <div
            className="fixed z-[9999] bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#eaeaea] w-56 py-2"
            style={{ top: locPopoverPos.top, left: locPopoverPos.left }}
            onMouseEnter={() => setShowLocHover(true)}
            onMouseLeave={() => setShowLocHover(false)}
          >
            <p className="px-3 pt-1 pb-2 text-[11px] text-[#888] font-medium tracking-[0.4px] uppercase">
              Locations covered
            </p>
            <ul className="max-h-52 overflow-y-auto">
              {locations.map(loc => (
                <li key={loc} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f5f5]">
                  <PinIcon />
                  <span className="text-[13px] text-[#212121] leading-[18px]">{loc}</span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}

        {/* ── ACCORDION: Current score ─────────────────────────── */}
        <Accordion title="Current score" open={openAccordion === 'score'} onToggle={() => toggleAccordion('score')}>
          <div className="flex flex-col -mb-3">
            {[
              { label: 'Search AI score', value: `${metrics.searchAiScore}%` },
              { label: 'Citation score',  value: `${metrics.citationShare}%` },
              { label: 'Visibility score', value: `${metrics.visibility}%` },
              { label: 'Brand ranking',    value: `${metrics.rank}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3 last:mb-3">
                <span className="text-[13px] text-[#212121] leading-[20px] font-normal">{label}</span>
                <span className="text-[13px] text-[#212121] leading-[20px] font-normal">{value}</span>
              </div>
            ))}
          </div>
        </Accordion>

        {/* ── ACCORDION: Related prompts ───────────────────────── */}
        <Accordion title="Related prompts" open={openAccordion === 'prompts'} onToggle={() => toggleAccordion('prompts')}>
          <div className="flex flex-col gap-2.5 pt-1">
            {(themeConfig?.prompts ?? []).map((p, i) => (
              <p key={i} className="text-[13px] text-[#555] leading-[20px] italic">
                "{p}"
              </p>
            ))}
          </div>
        </Accordion>

        {/* spacer so last accordion isn't flush with bottom */}
        <div className="flex-shrink-0 h-4" />

        </div>{/* end main container */}
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">


        {/* Tab bar */}
        <div className="flex border-b border-[#eaeaea] mx-6 flex-shrink-0 bg-white">
          {(['Implementation', 'References', 'Intelligence'] as const).map((tab, i) => (
            <button
              key={tab}
              onClick={() => setTab(i)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[14px] border-b-2 transition-colors whitespace-nowrap ${
                activeTab === i
                  ? 'text-[#1976d2] border-[#1976d2]'
                  : 'text-[#555] border-transparent hover:text-[#212121]'
              }`}
            >
              {tab === 'Intelligence' && (
                <svg width="21" height="20" viewBox="0 0 21 20" fill="none" className="flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.8995 2.38574C17.871 2.36333 17.8538 2.33493 17.8479 2.30054C17.8425 2.26979 17.8492 2.24035 17.868 2.2122C18.0002 1.98555 18.0971 1.80384 18.1586 1.66706C18.2222 1.53188 18.2459 1.41168 18.2299 1.30647C18.2175 1.20082 18.1641 1.08444 18.0698 0.957318C17.9755 0.830197 17.8388 0.664795 17.6598 0.461114C17.6064 0.399237 17.6022 0.339706 17.6472 0.28252C17.6697 0.253928 17.6973 0.237644 17.7301 0.23367C17.7629 0.229696 17.7941 0.236071 17.8237 0.252796C18.0558 0.38908 18.2431 0.490148 18.3856 0.555999C18.5297 0.619808 18.6546 0.645309 18.7602 0.632503C18.8694 0.619256 18.9841 0.56563 19.1042 0.471628C19.2259 0.375583 19.3819 0.233806 19.5723 0.046297C19.6302 -0.0106125 19.6897 -0.015056 19.7508 0.0329664C19.8118 0.0809887 19.8197 0.140078 19.7743 0.210235C19.6401 0.435279 19.5412 0.615391 19.4776 0.750571C19.4161 0.887353 19.3934 1.00835 19.4094 1.11355C19.4275 1.22036 19.4837 1.33733 19.578 1.46445C19.6739 1.58953 19.8104 1.75311 19.9874 1.95519C20.0408 2.01707 20.045 2.0766 20 2.13378C19.955 2.19097 19.8921 2.19768 19.8112 2.1539C19.578 2.0233 19.3903 1.9269 19.2482 1.86469C19.1061 1.80248 18.9813 1.77698 18.8736 1.78819C18.768 1.80099 18.6552 1.8544 18.5351 1.9484C18.417 2.04401 18.2644 2.18352 18.0773 2.36694C18.0198 2.4275 17.9605 2.43376 17.8995 2.38574Z" fill={activeTab === i ? '#1976d2' : '#6834B7'}/>
                  <path d="M15.698 7.63491C15.6248 7.63491 15.562 7.61129 15.5097 7.56405C15.4627 7.52206 15.4365 7.46695 15.4313 7.39872C15.3581 6.87385 15.2849 6.46445 15.2117 6.17052C15.1437 5.87659 15.0313 5.65615 14.8745 5.50918C14.7229 5.35697 14.4928 5.23887 14.1843 5.15489C13.8759 5.07091 13.4524 4.97906 12.9138 4.87934C12.7518 4.84784 12.6707 4.75862 12.6707 4.61165C12.6707 4.53817 12.6942 4.47781 12.7413 4.43057C12.7884 4.38333 12.8459 4.35447 12.9138 4.34397C13.4524 4.27049 13.8759 4.19701 14.1843 4.12352C14.4928 4.04479 14.7229 3.92932 14.8745 3.77711C15.0313 3.61965 15.1464 3.39133 15.2196 3.09215C15.2928 2.78773 15.3633 2.36783 15.4313 1.83246C15.4522 1.66975 15.5411 1.5884 15.698 1.5884C15.8548 1.5884 15.9411 1.67238 15.9568 1.84034C16.0247 2.36521 16.0927 2.77461 16.1607 3.06853C16.2339 3.36246 16.3489 3.58291 16.5057 3.72987C16.6678 3.87683 16.9031 3.99231 17.2116 4.07628C17.5201 4.15501 17.9409 4.24424 18.4742 4.34397C18.6363 4.37546 18.7174 4.46469 18.7174 4.61165C18.7174 4.75862 18.6259 4.84784 18.4429 4.87934C17.9096 4.96332 17.4913 5.04467 17.1881 5.1234C16.8848 5.20213 16.6548 5.3176 16.4979 5.46982C16.3463 5.62203 16.2339 5.84772 16.1607 6.1469C16.0927 6.44608 16.0247 6.8581 15.9568 7.38297C15.9411 7.55093 15.8548 7.63491 15.698 7.63491Z" fill={activeTab === i ? '#1976d2' : '#6834B7'}/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.15055 14.8252L5.72433 13.0763H8.71339L9.28059 14.8252H11.1035L8.00455 6.53094H6.4152L3.33333 14.8252H5.15055ZM6.16354 11.7376L7.22747 8.4948L8.27921 11.7376H6.16354Z" fill={activeTab === i ? '#1976d2' : '#6834B7'}/>
                  <path d="M13.6898 14.8252V6.53094H11.9865V14.8252H13.6898Z" fill={activeTab === i ? '#1976d2' : '#6834B7'}/>
                </svg>
              )}
              {tab}
            </button>
          ))}
        </div>

        {/* ─────── TAB CONTENT ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-white">

          {/* ── TAB 0: Implementation ────────────────────────────── */}
          {activeTab === 0 && (
            <div className="px-6 pb-5 flex flex-col">

              {/* Section B: What to do next */}
              <div className="my-5 rounded-lg">
                <div className="flex items-start justify-between mb-1 pt-4 pb-2 px-5">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px]">
                    What to do next
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      title="Export"
                      className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </button>
                    <button
                      title="More"
                      className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors"
                    >
                      <img src={`${BASE}assets/more_vert.svg`} alt="More" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stepper */}
                <div className="mt-2 pb-2">
                  {rec.checklist.map((step, idx) => {
                    const isLast = idx === rec.checklist.length - 1
                    return (
                      <div key={step.id} className="flex gap-3 items-stretch px-5">
                        {/* Left: number circle + connector line */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-5 h-5 border border-[#eaeaea] rounded-full flex items-center justify-center text-[11px] text-[#555] leading-none flex-shrink-0 bg-white mt-0.5">
                            {idx + 1}
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-[#eaeaea] mt-1" />}
                        </div>
                        {/* Right: label, description, rich box */}
                        <div className={`flex flex-col flex-1 min-w-0 pt-0.5 ${!isLast ? 'pb-5' : 'pb-1'}`}>
                          <p className="text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                            {step.label}
                          </p>
                          <p className="text-[13px] text-[#555] leading-[20px] mt-0.5">{step.description}</p>
                          <StepRichBox step={step} />
                          {isLast && rec.status !== 'pending' && (
                            <div className="mt-3">
                              <button
                                onClick={() => completeRec(rec.id)}
                                disabled={rec.status === 'completed'}
                                className={`h-8 px-4 text-[13px] rounded transition-colors ${
                                  rec.status === 'completed'
                                    ? 'bg-[#f0faf0] text-[#377e2c] border border-[#377e2c]/30 cursor-default'
                                    : 'bg-[#1976d2] text-white hover:bg-[#1565c0] cursor-pointer'
                                }`}
                              >
                                {rec.status === 'completed' ? '✓ Completed' : 'Mark as complete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Implement for me banner — inside the card, below the stepper */}
                <div className="flex items-center justify-between gap-3 mx-5 mb-4 mt-1 px-4 py-3 bg-[#f5f0ff] rounded-lg border border-[#e4d9f9]">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-[13px] text-[#555] leading-[20px] truncate">
                      Need help with implementation? Opt in for managed services and our team will make the updates for you on your website
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 1: References ───────────────────────────────── */}
          {activeTab === 1 && (
            <div className="px-6 py-5 flex flex-col gap-1">
              {rec.sources.length === 0 ? (
                <p className="text-[14px] text-[#888] leading-[22px]">
                  No references available for this recommendation.
                </p>
              ) : (
                <div className="border border-[#eaeaea] rounded-lg overflow-hidden">
                  {rec.sources.map((s, i) => (
                    <div
                      key={i}
                      className="px-5 py-4 border-b border-[#eaeaea] last:border-b-0"
                    >
                      {/* Row 1: platform icon + name | referenced count */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={s.platform} />
                          <span className="text-[13px] text-[#555] leading-[20px] font-normal">
                            {s.platform}
                          </span>
                        </div>
                        {s.referencedInAnswers > 0 && (
                          <div className="flex items-center gap-1">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            <span className="text-[12px] text-[#888] leading-[18px]">
                              Referenced in {s.referencedInAnswers} answers
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Row 2: blue link title */}
                      {s.url && s.url !== '#' ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[13px] text-[#1976d2] leading-[20px] hover:underline mb-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {s.competitorName}
                        </a>
                      ) : (
                        <p className="text-[13px] text-[#1976d2] leading-[20px] mb-1">
                          {s.competitorName}
                        </p>
                      )}

                      {/* Row 3: snippet */}
                      <p className="text-[13px] text-[#555] leading-[20px]">
                        {s.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Intelligence ─────────────────────────────── */}
          {activeTab === 2 && (
            <div className="px-6 py-5 flex flex-col gap-5">

              {/* ── Why it works ────────────────────────────────── */}
              {rec.whyItWorks.length > 0 && (
                <div className="p-5 border border-[#eaeaea] rounded-lg">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    Why it works
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.whyItWorks.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[8px] w-[5px] h-[5px] rounded-full bg-[#555] flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── A: Competitive Intelligence Card — hidden when no competitors ── */}
              {rec.competitors.length > 0 && (
                <div className="p-5 border border-[#eaeaea] rounded-lg">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-1">
                    How are your competitors getting cited for{' '}
                    <span className="font-medium">{themeConfig?.label ?? rec.category}</span>
                  </p>
                  <p className="text-[12px] text-[#555] leading-[18px] mb-4">
                    {themeConfig?.prompts[0]
                      ? `When someone asks an AI "${themeConfig.prompts[0]}" — these businesses are showing up instead of you:`
                      : 'These businesses are being cited by AI platforms more often than you for this topic:'}
                  </p>
                  <CompetitorIntelligenceLayout
                    competitors={rec.competitors}
                    youCitations={rec.youCitations ?? metrics.youCitations}
                    youName="Raine & Horne Dubbo"
                    llmSummary={rec.llmCoverageGap.summary}
                    expandedCompetitor={expandedCompetitor}
                    setExpandedCompetitor={setExpandedCompetitor}
                  />
                </div>
              )}

              {/* ── A2: What competitors are doing better ────────── */}
              {rec.competitorsInsight && rec.competitorsInsight.length > 0 && (
                <div className="p-5 border border-[#eaeaea] rounded-lg">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    What competitors are doing better
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.competitorsInsight.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[8px] w-[5px] h-[5px] rounded-full bg-[#555] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── B: Key Insights box ─────────────────────────── */}
              {rec.keyInsights && rec.keyInsights.length > 0 && (
                <div className="p-5 border border-[#eaeaea] rounded-lg">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    Key insights
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[8px] w-[5px] h-[5px] rounded-full bg-[#555] flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── C: What's driving this box ──────────────────── */}
              {rec.swotDrivers && rec.swotDrivers.length > 0 && (
                <div className="p-5 border border-[#eaeaea] rounded-lg">
                  <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    What's driving this
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.swotDrivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[8px] w-[5px] h-[5px] rounded-full bg-[#555] flex-shrink-0" />
                        {driver}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
