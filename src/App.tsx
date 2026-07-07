import { useBootstrap } from './hooks/useBootstrap'
import { useCandlesLoader, useLivePriceLoader, useReplayClock, usePositionPricesLoader, useTradeTapeLoader } from './hooks/useDataLoaders'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useOrderEngine } from './hooks/useOrderEngine'
import { useWalletTrades } from './hooks/useWalletTrades'
import { useIsMobile } from './hooks/useIsMobile'
import { TopBar } from './components/TopBar'
import { LeftPanel } from './components/LeftPanel'
import { ChartPanel } from './components/ChartPanel'
import { RightPanel } from './components/RightPanel'
import { Blotter } from './components/Blotter'
import { Dashboard } from './components/Dashboard'
import { FlexCard } from './components/FlexCard'
import { MobileApp } from './mobile/MobileApp'

export function App() {
  useBootstrap()
  useCandlesLoader()
  useLivePriceLoader()
  usePositionPricesLoader()
  useTradeTapeLoader()
  useReplayClock()
  useKeyboardShortcuts()
  useOrderEngine()
  useWalletTrades()

  const isMobile = useIsMobile()
  if (isMobile) return <MobileApp />

  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <LeftPanel />
        <ChartPanel />
        <RightPanel />
      </div>
      <Blotter />
      <Dashboard />
      <FlexCard />
    </div>
  )
}
