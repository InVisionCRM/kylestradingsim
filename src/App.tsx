import { useBootstrap } from './hooks/useBootstrap'
import { useCandlesLoader, useLivePriceLoader, useReplayClock, usePositionPricesLoader } from './hooks/useDataLoaders'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TopBar } from './components/TopBar'
import { LeftPanel } from './components/LeftPanel'
import { ChartPanel } from './components/ChartPanel'
import { RightPanel } from './components/RightPanel'
import { Blotter } from './components/Blotter'
import { Dashboard } from './components/Dashboard'

export function App() {
  useBootstrap()
  useCandlesLoader()
  useLivePriceLoader()
  usePositionPricesLoader()
  useReplayClock()
  useKeyboardShortcuts()

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
    </div>
  )
}
