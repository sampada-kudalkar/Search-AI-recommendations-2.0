import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import ScoreRing from '../dashboard/ScoreRing'
import { nsaThemesConfig } from '../../data/nsaThemesConfig'
import { getLocationsForRec } from '../../data/locationsData'
import type { RecCategory } from '../../types'

const BASE = import.meta.env.BASE_URL

// ── Category → affected metric (mirrors RecommendationCard) ──────────────────
const CATEGORY_METRIC: Partial<Record<RecCategory, string>> = {
  'Content':             'Citation share',
  'Website content':     'Citation share',
  'FAQ':                 'Citation share',
  'Social':              'Citation share',
  'Local SEO':           'Visibility',
  'Technical SEO':       'Visibility',
  'Website improvement': 'Visibility',
  'Conversion':          'Visibility',
  'Trust & Reputation':  'Sentiment',
  'Reviews':             'Sentiment',
}

function buildImpactMessage(rec: { category: RecCategory; themeId: string; shortAction?: string }): string {
  const metric     = CATEGORY_METRIC[rec.category] ?? 'Search AI score'
  const themeLabel = nsaThemesConfig[rec.themeId]?.label
  const action     = rec.shortAction ?? 'Completing this'
  return themeLabel
    ? `${action} could move your ${metric} for ${themeLabel}`
    : `${action} could improve your ${metric}`
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
    <div className="flex flex-col gap-1 py-3">
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

// ── Info banner (used at top of right panel and bottom of Why it works tab) ───
function InfoBanner({ text, cta, onCta }: { text: string; cta: string; onCta?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#f5f0ff] mx-6">
      <div className="flex items-center gap-2 min-w-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
          <path
            d="M12 3 L13.8 8.5 L20 8.5 L14.9 12 L16.7 17.5 L12 14 L7.3 17.5 L9.1 12 L4 8.5 L10.2 8.5 Z"
            fill="#7c3aed" opacity="0.75"
          />
        </svg>
        <span className="text-[13px] text-[#555] leading-[20px] truncate">{text}</span>
      </div>
      <button
        onClick={onCta}
        className="text-[13px] text-[#1976d2] whitespace-nowrap hover:underline flex-shrink-0 font-medium"
      >
        {cta}
      </button>
    </div>
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
    <div className="flex flex-1 min-h-0 overflow-hidden pl-6">

      {/* ══════════════════════════════════════════════════════════
          LEFT CARD
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 border border-[#eaeaea] bg-white self-start max-h-full overflow-hidden rounded-[8px]"
        style={{ width: '30vw' }}
      >
        {/* ── Main container — unified wrapper for all card content ── */}
        <div className="flex flex-col flex-1 overflow-y-auto min-h-0">

        {/* Chips */}
        <div className="flex items-center gap-2 flex-wrap px-5 pt-5 pb-3">
          <span className="inline-flex items-center px-2 py-1 rounded text-[12px] leading-[18px] tracking-[-0.24px] bg-white border border-[#cccccc] text-[#212121] font-normal">
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
        <p className="px-5 pb-3 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px] font-normal">
          {rec.title}
        </p>

        {/* Action icon buttons */}
        <div className="flex items-center gap-2 px-5 pb-3">
          {/* Assign */}
          <button
            title="Assign"
            className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          {/* Notify */}
          <button
            title="Notify"
            className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </button>
          {/* Download */}
          <button
            title="Download"
            className="w-7 h-7 flex items-center justify-center border border-[#eaeaea] rounded hover:bg-[#f5f5f5] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {acceptedDate && (
            <span className="ml-auto text-[11px] text-[#888] whitespace-nowrap">Accepted {acceptedDate}</span>
          )}
        </div>

        {/* Score nudge */}
        <div className="mx-5 mb-4 flex items-center gap-2 bg-[#f9f7fd] px-2 py-2 rounded">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#303030" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-[12px] text-[#555] leading-[18px] tracking-[-0.24px]">
            {buildImpactMessage(rec)}
          </span>
        </div>

        {/* ── ACCORDION: Basic details ─────────────────────────── */}
        <Accordion title="Basic details" open={openAccordion === 'basic'} onToggle={() => toggleAccordion('basic')}>
          <div className="flex flex-col -mb-3">
            <InfoRow label="Type">{rec.category}</InfoRow>
            {rec.expectedImpact && (
              <InfoRow label="Impact">
                <span className="text-[13px] text-[#555] leading-[20px]">{rec.expectedImpact}</span>
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
                    className="text-[13px] text-[#1976d2] cursor-pointer hover:underline"
                    onMouseEnter={handleLocEnter}
                    onMouseLeave={() => setShowLocHover(false)}
                  >
                    +{extraLocations} more
                  </span>
                )}
              </div>
            </InfoRow>
            <InfoRow label="Created on">{createdDate}</InfoRow>
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

        {/* Top info banner */}
        <InfoBanner
          text="Need help with implementation? Opt in for managed services and our team will make the updates for you on your website"
          cta="Contact support"
        />

        {/* Tab bar */}
        <div className="flex border-b border-[#eaeaea] mx-6 flex-shrink-0 bg-white">
          {(['Why it works', 'References', 'Intelligence'] as const).map((tab, i) => (
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
                <svg
                  width="14" height="14" viewBox="0 0 24 24"
                  fill={activeTab === i ? '#1976d2' : '#888'}
                  className="flex-shrink-0"
                >
                  <path d="M12 3 L13.8 8.5 L20 8.5 L14.9 12 L16.7 17.5 L12 14 L7.3 17.5 L9.1 12 L4 8.5 L10.2 8.5 Z" />
                </svg>
              )}
              {tab}
            </button>
          ))}
        </div>

        {/* ─────── TAB CONTENT ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-white">

          {/* ── TAB 0: Why it works ─────────────────────────────── */}
          {activeTab === 0 && (
            <div className="px-6 py-5 flex flex-col gap-1">

              {/* Section A: Why it works */}
              <div className="p-5 border border-[#eaeaea] rounded-lg">
                <p className="text-[14px] font-normal text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                  Why it works
                </p>
                <ul className="flex flex-col gap-2.5">
                  {rec.whyItWorks.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#555] flex-shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Section B: What to do next */}
              <div className="my-5 border border-[#eaeaea] rounded-lg">
                <div className="flex items-start justify-between mb-1 py-4 px-5">
                  <div>
                    <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px]">
                      What to do next
                    </p>
                    <p className="text-[13px] text-[#888] leading-[20px] mt-0.5">
                      Step by step guide on what you need to do next
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-1">
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
                <div className="mt-4">
                  {rec.checklist.map((step, idx) => {
                    const isLast = idx === rec.checklist.length - 1
                    return (
                      <div key={step.id} className="flex gap-3 items-stretch mb-5 px-5">
                        {/* Left: number + connector line */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-5 h-5 border border-[#eaeaea] rounded-full flex items-center justify-center text-[11px] text-[#555] leading-none flex-shrink-0 bg-white">
                            {idx + 1}
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-[#eaeaea] mt-1" />}
                        </div>
                        {/* Right: content */}
                        <div className={`flex flex-col gap-1 flex-1 min-w-0 ${!isLast ? 'pb-5' : ''}`}>
                          <p className="text-[14px] text-[#212121] leading-[22px] tracking-[-0.28px]">
                            {step.label}
                          </p>
                          <p className="text-[13px] text-[#555] leading-[20px]">{step.description}</p>
                          {isLast && (
                            <div className="mt-2">
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
              </div>

              {/* Bottom implement banner */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#f5f0ff] rounded-lg border border-[#e4d9f9]">
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
                <button className="text-[13px] text-[#1976d2] whitespace-nowrap hover:underline flex-shrink-0 font-medium">
                  Implement for me
                </button>
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
            <div className="px-6 py-5 flex flex-col gap-7">

              {/* Score rings */}
              <div>
                <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px] mb-4">
                  Current scores
                </p>
                <div className="flex items-start gap-8 flex-wrap">
                  <ScoreRing score={metrics.visibility}    size={96} strokeWidth={8} label="Visibility"      />
                  <ScoreRing score={metrics.citationShare} size={96} strokeWidth={8} label="Citation share"  />
                  <ScoreRing score={metrics.sentiment}     size={96} strokeWidth={8} label="Sentiment"       />
                  <ScoreRing score={metrics.searchAiScore} size={96} strokeWidth={8} label="Search AI Score" />
                </div>
              </div>

              {/* Key insights */}
              {rec.keyInsights && rec.keyInsights.length > 0 && (
                <div>
                  <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    Key insights
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#555] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#1976d2] flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SWOT drivers */}
              {rec.swotDrivers && rec.swotDrivers.length > 0 && (
                <div>
                  <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    What's driving this
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.swotDrivers.map((driver, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#555] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#377e2c] flex-shrink-0" />
                        {driver}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Competitor insights */}
              {rec.competitorsInsight && rec.competitorsInsight.length > 0 && (
                <div>
                  <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    Competitor insights
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {rec.competitorsInsight.map((ci, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#555] leading-[22px] tracking-[-0.28px]">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#c65c04] flex-shrink-0" />
                        {ci}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related prompts */}
              {themeConfig && (
                <div>
                  <p className="text-[14px] font-medium text-[#212121] leading-[22px] tracking-[-0.28px] mb-3">
                    Related prompts — {themeConfig.label}
                  </p>
                  <div className="flex flex-col gap-2">
                    {themeConfig.prompts.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-2.5 bg-[#f5f0ff] rounded-lg border border-[#e4d9f9]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#7c3aed" className="flex-shrink-0 mt-0.5" opacity="0.7">
                          <path d="M12 3 L13.8 8.5 L20 8.5 L14.9 12 L16.7 17.5 L12 14 L7.3 17.5 L9.1 12 L4 8.5 L10.2 8.5 Z" />
                        </svg>
                        <span className="text-[13px] text-[#555] leading-[20px] italic">"{p}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LLM coverage gap */}
              {rec.llmCoverageGap.summary && (
                <div className="bg-[#fafafa] border border-[#eaeaea] rounded-lg p-4">
                  <p className="text-[13px] font-medium text-[#212121] leading-[20px] mb-1.5">
                    LLM coverage gap
                  </p>
                  <p className="text-[13px] text-[#555] leading-[20px]">
                    {rec.llmCoverageGap.summary}
                  </p>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
