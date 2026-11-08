import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { RouteBoundary } from '../components/RouteBoundary'
import type { ExhibitId } from '../content/types'
import { GalleryPage } from '../pages/GalleryPage'
import { buildExploreHash, parseExploreHash } from './routes'

interface ExplorerRouteProps {
  exhibitId: ExhibitId
  forceStatic: boolean
  onExit: () => void
}

type ExplorerPageLoader = () => Promise<{
  default: ComponentType<ExplorerRouteProps>
}>

interface ExplorerAttempt {
  key: number
  Page: LazyExoticComponent<ComponentType<ExplorerRouteProps>>
}

interface AppProps {
  loadExplorerPage?: ExplorerPageLoader
}

const defaultExplorerPageLoader: ExplorerPageLoader = () =>
  import('../pages/ExplorerPage').then((module) => ({
    default: module.ExplorerPage,
  }))

function createExplorerAttempt(
  loadExplorerPage: ExplorerPageLoader,
  key = 0,
): ExplorerAttempt {
  return {
    key,
    Page: lazy(loadExplorerPage),
  }
}

function forcesStaticExplorer(hash: string) {
  const queryStart = hash.indexOf('?')

  if (queryStart === -1) {
    return false
  }

  return new URLSearchParams(hash.slice(queryStart + 1)).get('no-webgl') === '1'
}

function useRouteHeadingFocus(routeKey: string) {
  useEffect(() => {
    let observer: MutationObserver | null = null

    const focusHeading = () => {
      const heading = document.querySelector('h1')

      if (!(heading instanceof HTMLHeadingElement)) {
        return false
      }

      if (!heading.hasAttribute('tabindex')) {
        heading.tabIndex = -1
      }

      heading.focus({ preventScroll: true })
      return true
    }

    if (!focusHeading()) {
      observer = new MutationObserver(() => {
        if (focusHeading()) {
          observer?.disconnect()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => observer?.disconnect()
  }, [routeKey])
}

export function App({
  loadExplorerPage = defaultExplorerPageLoader,
}: AppProps = {}) {
  const [hash, setHash] = useState(() => window.location.hash)
  const [explorerAttempt, setExplorerAttempt] = useState(() =>
    createExplorerAttempt(loadExplorerPage),
  )

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const activeExhibit = parseExploreHash(hash)
  const routeName = activeExhibit ? 'explorer' : 'gallery'
  const routeFocusKey =
    routeName === 'explorer'
      ? `${routeName}:${activeExhibit}:${explorerAttempt.key}`
      : routeName

  useRouteHeadingFocus(routeFocusKey)

  if (activeExhibit) {
    const ExplorerPage = explorerAttempt.Page
    const exitExplorer = () => {
      window.location.hash = '#/'
    }

    return (
      <RouteBoundary
        key={`${activeExhibit}:${explorerAttempt.key}`}
        onExit={exitExplorer}
        onRetry={() => {
          setExplorerAttempt((attempt) =>
            createExplorerAttempt(loadExplorerPage, attempt.key + 1),
          )
        }}
      >
        <Suspense
          fallback={
            <main className="route-loading" aria-live="polite">
              正在打开结构探索室…
            </main>
          }
        >
          <ExplorerPage
            exhibitId={activeExhibit}
            forceStatic={forcesStaticExplorer(hash)}
            onExit={exitExplorer}
          />
        </Suspense>
      </RouteBoundary>
    )
  }

  return (
    <GalleryPage
      onExplore={(id) => {
        const nextHash = buildExploreHash(id)

        if (nextHash) {
          window.location.hash = nextHash
        }
      }}
    />
  )
}
