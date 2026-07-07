import { useRef } from 'react'
import { useMarket } from '../state/useMarket'
import { useSim } from '../state/useSim'
import { useOrder } from '../state/useOrder'
import { useUi, type MobileTab } from '../state/useUi'
import { useEquity, useCurrentPrice } from '../hooks/useDerived'
import { formatPriceUsd, formatUsd, formatPct, signClass } from '../lib/format'
import { TokenIcon } from '../components/TokenIcon'
import { ChartPanel } from '../components/ChartPanel'
import { RightPanel } from '../components/RightPanel'
import { LeftPanel } from '../components/LeftPanel'
import { Dashboard } from '../components/Dashboard'
import { FlexCard } from '../components/FlexCard'
import { MobileSearch } from './MobileSearch'
import { MobilePositions } from './MobilePositions'
import { IconSearch, IconLineChart, IconChevron } from '../components/icons'
import type { Side } from '../types'
import type { JSX } from 'react'

function MobileTopBar() {
  const pair = useMarket((s) => s.activePair)
  const price = useCurrentPrice()
  const { equity, totalPnl, startingBalance } = useEquity()
  const pnlPct = startingBalance ? (totalPnl / startingBalance) * 100 : 0

  return (
    <header className="mtopbar">
      <span className="mark" />
      <button className="tokbtn" onClick={() => useUi.getState().openSearch()} aria-label="Change token">
        {pair ? (
          <>
            <TokenIcon src={pair.imageUrl} symbol={pair.baseToken.symbol} tokenKey={`${pair.chainId}:${pair.pairAddress}`} size={26} cls="ic" />
            <span className="tmeta">
              <span className="tsym">
                {pair.baseToken.symbol} <IconChevron size={12} />
              </span>
              <span className="tprice num">
                {formatPriceUsd(price)}
                {pair.priceChange24h != null && (
                  <span className={`pill ${signClass(pair.priceChange24h)}`}>{formatPct(pair.priceChange24h)}</span>
                )}
              </span>
            </span>
          </>
        ) : (
          <span className="tmeta">
            <span className="tsym">Pick a token</span>
          </span>
        )}
      </button>
      <div className="equity">
        <div className="lab">EQUITY</div>
        <div className="v num">
          {formatUsd(equity)} <span className={signClass(totalPnl)} style={{ fontSize: 10 }}>{formatPct(pnlPct)}</span>
        </div>
      </div>
      <button className="iconbtn" title="Performance analytics" onClick={() => useUi.getState().openAnalytics()}>
        <IconLineChart size={16} />
      </button>
      <button className="iconbtn" title="Search tokens" onClick={() => useUi.getState().openSearch()}>
        <IconSearch size={16} />
      </button>
    </header>
  )
}

const TABS: { id: MobileTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'chart',
    label: 'TRADE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-6 4 3 6-8 3 4" />
      </svg>
    ),
  },
  {
    id: 'watch',
    label: 'WATCHLIST',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'positions',
    label: 'POSITIONS',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
]

function MobileTabBar() {
  const tab = useUi((s) => s.mobileTab)
  const posCount = useSim((s) => Object.keys(s.accounts[s.mode].positions).length)

  return (
    <nav className="mtabbar">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => useUi.getState().setMobileTab(t.id)}>
          {t.icon}
          {t.label}
          {t.id === 'positions' && posCount > 0 && <span className="badge num">{posCount}</span>}
        </button>
      ))}
    </nav>
  )
}

/**
 * Chart + trading in ONE scrollable view: the chart fills the first screenful,
 * the order ticket and position details sit right below it. The BUY/SELL bar
 * sets the side and scrolls you straight to the ticket.
 */
function MobileTradeView() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  const scrollToTicket = () => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const pick = (side: Side) => {
    useOrder.getState().setSide(side)
    scrollToTicket()
  }

  return (
    <>
      <div className="mchartscroll" ref={scrollRef}>
        <div className="mchartblock">
          <ChartPanel />
        </div>
        <button className="tradehint" onClick={scrollToTicket}>
          <IconChevron size={14} /> TRADE
        </button>
        <div ref={ticketRef} className="mticket">
          <RightPanel />
        </div>
      </div>
      <div className="mactionbar">
        <button className="abtn buy" onClick={() => pick('buy')}>
          BUY
        </button>
        <button className="abtn sell" onClick={() => pick('sell')}>
          SELL
        </button>
      </div>
    </>
  )
}

/**
 * Phone shell: chart-first single column with a bottom tab bar, trading right
 * below the chart in the same scroll, full-screen search, positions with flex
 * cards. All tabs stay mounted so the chart never re-initializes on switches.
 */
export function MobileApp() {
  const tab = useUi((s) => s.mobileTab)

  return (
    <div className="mapp">
      <MobileTopBar />
      <div className="mviews">
        <div className={`mview ${tab === 'chart' ? 'on' : ''}`}>
          <MobileTradeView />
        </div>
        <div className={`mview ${tab === 'watch' ? 'on' : ''}`}>
          <LeftPanel />
        </div>
        <div className={`mview ${tab === 'positions' ? 'on' : ''}`}>
          <MobilePositions />
        </div>
      </div>
      <MobileTabBar />
      <MobileSearch />
      <FlexCard />
      <Dashboard />
    </div>
  )
}
