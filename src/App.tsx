import { useBootstrap } from './hooks/useBootstrap'
import { useCandlesLoader, useLivePriceLoader, useReplayClock } from './hooks/useDataLoaders'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TopBar } from './components/TopBar'
import { LeftPanel } from './components/LeftPanel'
import { ChartPanel } from './components/ChartPanel'
import { RightPanel } from './components/RightPanel'
import { Blotter } from './components/Blotter'

export function App() {
  useBootstrap()
  useCandlesLoader()
  useLivePriceLoader()
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
    </div>
  )
}
