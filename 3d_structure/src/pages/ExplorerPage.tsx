import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { CameraControls } from '../components/CameraControls'
import { ExplorerInspector } from '../components/ExplorerInspector'
import { FirearmCycleControls } from '../components/FirearmCycleControls'
import { JourneyBar } from '../components/JourneyBar'
import { KnowledgePanel } from '../components/KnowledgePanel'
import { LearningGuide } from '../components/LearningGuide'
import { PartNavigator } from '../components/PartNavigator'
import { SceneBoundary } from '../components/SceneBoundary'
import { TankDiagram } from '../components/TankDiagram'
import { getExhibit } from '../content/exhibits'
import {
  firearmExhibitIds,
  type ExhibitId,
  type ExhibitPartId,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  createInitialState,
  experienceReducer,
} from '../experience/state'
import {
  advanceFirearmCycle,
  createInitialFirearmCycleState,
  nextFirearmCyclePhase,
  pauseFirearmCycle,
  playFirearmCycle,
  previousFirearmCyclePhase,
  resetFirearmCycle,
} from '../experience/firearmCycleState'
import { loadProgress, saveProgress } from '../experience/storage'
import { FIREARM_CYCLE_PHASE_DURATION_MS } from '../scene/firearmCycle'
import { isPrinciplePlaybackActive } from '../scene/principleRules'
import { getExhibitSceneLoader } from '../scene/sceneLoaders'
import { canUseWebGL } from '../scene/sceneSupport'
import type { CameraCommand, CameraCommandType } from '../scene/cameraControls'
import type { ExhibitSceneLoader, ExhibitSceneProps } from '../scene/types'
import type { TankSceneProps } from '../scene/TankScene'
import '../styles/explorer.css'

/** Kept unchanged so existing M4 scene-loader injection stays source-compatible. */
export type TankSceneLoader = () => Promise<{
  default: ComponentType<TankSceneProps>
}>

interface LazySceneAttemptProps extends ExhibitSceneProps {
  loader: ExhibitSceneLoader
}

function LazySceneAttempt({ loader, ...sceneProps }: LazySceneAttemptProps) {
  const TankScene = useMemo(() => lazy(loader), [loader])

  return (
    <Suspense
      fallback={
        <div
          className="explorer-scene-loading"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          正在组装三维结构…
        </div>
      }
    >
      <TankScene {...sceneProps} />
    </Suspense>
  )
}

export interface ExplorerPageProps {
  exhibitId?: ExhibitId
  onExit: () => void
  forceStatic?: boolean
  supportsWebGL?: () => boolean
  sceneLoader?: TankSceneLoader | ExhibitSceneLoader
}

const modes: readonly {
  id: ExploreMode
  label: string
  description: string
}[] = [
  {
    id: 'explode',
    label: '拆解模式',
    description: '把结构分层展开，看看零件怎样组合。',
  },
  {
    id: 'xray',
    label: '透视模式',
    description: '外壳会变淡，帮助你看清内部空间。',
  },
  {
    id: 'principle',
    label: '原理模式',
    description: '高亮线索会带你追踪能量怎样流动。',
  },
]

function prefersReducedMotion() {
  return getReducedMotionQuery()?.matches ?? false
}

function getReducedMotionQuery(): MediaQueryList | null {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return null
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)')
  } catch {
    return null
  }
}

const COMPACT_INSPECTOR_QUERY = '(max-width: 40rem)'

function getCompactInspectorQuery(): MediaQueryList | null {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return null
    }

    return window.matchMedia(COMPACT_INSPECTOR_QUERY)
  } catch {
    return null
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function scrollToExplorerSection(id: string) {
  const section = document.getElementById(id)

  if (!section) {
    return
  }

  if (typeof section.scrollIntoView === 'function') {
    section.scrollIntoView({ block: 'start' })
  }

  section.focus({ preventScroll: true })
}

export function ExplorerPage({
  exhibitId = 'm4',
  onExit,
  forceStatic = false,
  supportsWebGL = canUseWebGL,
  sceneLoader,
}: ExplorerPageProps) {
  const cycleDescriptionId = useId()
  const exhibit = getExhibit(exhibitId)
  const firearmExhibitId = firearmExhibitIds.find(
    (candidate) => candidate === exhibitId,
  )
  const { parts, steps } = exhibit
  const resolvedSceneLoader =
    (sceneLoader as ExhibitSceneLoader | undefined) ??
    getExhibitSceneLoader(exhibitId)
  const [resetToken, setResetToken] = useState(0)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>()
  const cameraCommandTokenRef = useRef(0)
  const [cameraFocusPartId, setCameraFocusPartId] =
    useState<ExhibitPartId | null>(null)
  const [guided, setGuided] = useState(true)
  const [inspectorExpanded, setInspectorExpanded] = useState(
    () => !(getCompactInspectorQuery()?.matches ?? false),
  )
  const [pendingExplorerSection, setPendingExplorerSection] = useState<
    string | null
  >(null)
  const [demoPlaying, setDemoPlaying] = useState(false)
  const [cycleState, setCycleState] = useState(() =>
    exhibit.cycleKind ? createInitialFirearmCycleState() : undefined,
  )
  const cycleTimerRef = useRef<number | null>(null)
  const cycleTimerStartedAtRef = useRef<number | null>(null)
  const cycleTimerRemainingMsRef = useRef(
    FIREARM_CYCLE_PHASE_DURATION_MS,
  )
  const previousExhibitIdRef = useRef(exhibitId)
  const [state, dispatch] = useReducer(
    experienceReducer,
    undefined,
    () => createInitialState(prefersReducedMotion(), loadProgress(exhibitId)),
  )
  const activeStep = steps[state.stepIndex]
  const activeMode = modes.find((mode) => mode.id === state.mode) ?? modes[0]
  const selectedPart =
    parts.find((part) => part.id === state.selectedPartId) ?? null
  const webGLAvailable = useMemo(
    () =>
      forceStatic || !resolvedSceneLoader ? false : supportsWebGL(),
    [forceStatic, resolvedSceneLoader, supportsWebGL],
  )
  const staticVisual = !webGLAvailable
  const hasFirearmCycle = Boolean(exhibit.cycleKind)
  const principlePlaying = hasFirearmCycle
    ? state.mode === 'principle' && cycleState?.status === 'playing'
    : isPrinciplePlaybackActive(
        state.mode,
        state.autoplay,
        state.reducedMotion,
      )
  const principleStatus = state.reducedMotion
    ? '已减少动态：原理动画保持静止。'
    : state.autoplay
      ? '正在播放原理动画。'
      : '原理动画已暂停。'

  const cancelCycleTimerOnly = useCallback(() => {
    if (cycleTimerRef.current === null) return
    window.clearTimeout(cycleTimerRef.current)
    cycleTimerRef.current = null
    cycleTimerStartedAtRef.current = null
  }, [])

  const clearCycleTimer = useCallback(
    (preserveRemaining = false) => {
      if (
        preserveRemaining &&
        cycleTimerStartedAtRef.current !== null
      ) {
        const elapsed = Math.max(
          0,
          Date.now() - cycleTimerStartedAtRef.current,
        )
        cycleTimerRemainingMsRef.current = Math.max(
          0,
          cycleTimerRemainingMsRef.current - elapsed,
        )
      } else if (!preserveRemaining) {
        cycleTimerRemainingMsRef.current =
          FIREARM_CYCLE_PHASE_DURATION_MS
      }

      cancelCycleTimerOnly()
    },
    [cancelCycleTimerOnly],
  )

  const handleSelectPart = useCallback((partId: ExhibitPartId) => {
    setCameraFocusPartId(partId)
    setInspectorExpanded(true)
    dispatch({ type: 'select-part', partId })
  }, [])

  const handleSceneReady = useCallback(() => {
    dispatch({ type: 'scene-status', status: 'ready' })
  }, [])

  const handleSceneError = useCallback(() => {
    dispatch({ type: 'scene-status', status: 'error' })
  }, [])

  const handleSceneRetry = useCallback(() => {
    dispatch({ type: 'scene-status', status: 'loading' })
  }, [])

  const handleReset = useCallback(() => {
    clearCycleTimer()
    setDemoPlaying(false)
    setCameraCommand(undefined)
    setCameraFocusPartId(null)
    setInspectorExpanded(false)
    setPendingExplorerSection(null)
    setCycleState((current) =>
      current ? resetFirearmCycle(current) : current,
    )
    dispatch({ type: 'reset' })
    setResetToken((token) => token + 1)
  }, [clearCycleTimer])

  const issueCameraCommand = useCallback((type: CameraCommandType) => {
    cameraCommandTokenRef.current += 1
    setCameraCommand({
      token: cameraCommandTokenRef.current,
      type,
    })
  }, [])

  const handleGuidedChange = useCallback((nextGuided: boolean) => {
    setGuided(nextGuided)

    if (!nextGuided) {
      setDemoPlaying(false)
    }
  }, [])

  const handleInspectorNavigation = useCallback((sectionId: string) => {
    setInspectorExpanded(true)
    setPendingExplorerSection(sectionId)
  }, [])

  const handleToggleDemo = useCallback(() => {
    if (state.reducedMotion || state.stepIndex >= steps.length - 1) {
      return
    }

    setDemoPlaying((playing) => !playing)
  }, [state.reducedMotion, state.stepIndex, steps.length])

  const handleStepChange = useCallback(
    (stepIndex: number) => {
      if (stepIndex !== state.stepIndex) {
        clearCycleTimer()
        setCameraFocusPartId(null)
        setCycleState((current) =>
          current ? resetFirearmCycle(current) : current,
        )
      }

      dispatch({ type: 'go-to-step', stepIndex })
    },
    [clearCycleTimer, state.stepIndex],
  )

  const handleModeChange = useCallback(
    (mode: ExploreMode) => {
      if (state.mode === 'principle' && mode !== 'principle') {
        clearCycleTimer()
        setCycleState((current) =>
          current ? resetFirearmCycle(current) : current,
        )
      }

      dispatch({ type: 'set-mode', mode })
    },
    [clearCycleTimer, state.mode],
  )

  const handleCyclePlay = useCallback(() => {
    if (state.reducedMotion) return
    setCycleState((current) =>
      current ? playFirearmCycle(current) : current,
    )
  }, [state.reducedMotion])

  const handleCyclePause = useCallback(() => {
    clearCycleTimer(true)
    setCycleState((current) =>
      current ? pauseFirearmCycle(current) : current,
    )
  }, [clearCycleTimer])

  const handleCyclePrevious = useCallback(() => {
    clearCycleTimer()
    setCycleState((current) =>
      current ? previousFirearmCyclePhase(current) : current,
    )
  }, [clearCycleTimer])

  const handleCycleNext = useCallback(() => {
    clearCycleTimer()
    setCycleState((current) =>
      current ? nextFirearmCyclePhase(current) : current,
    )
  }, [clearCycleTimer])

  const handleCycleReset = useCallback(() => {
    clearCycleTimer()
    setCycleState((current) =>
      current ? resetFirearmCycle(current) : current,
    )
  }, [clearCycleTimer])

  useEffect(() => {
    saveProgress(state.stepIndex, exhibitId)
  }, [exhibitId, state.stepIndex])

  useEffect(() => {
    if (!pendingExplorerSection || !inspectorExpanded) return

    scrollToExplorerSection(pendingExplorerSection)
    setPendingExplorerSection(null)
  }, [inspectorExpanded, pendingExplorerSection])

  useEffect(() => {
    const mediaQuery = getReducedMotionQuery()

    if (!mediaQuery) {
      return
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        clearCycleTimer(true)
        setDemoPlaying(false)
        setCycleState((current) =>
          current ? pauseFirearmCycle(current) : current,
        )
      }

      dispatch({
        type: 'set-reduced-motion',
        reducedMotion: event.matches,
      })
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener?.(handleChange)
    return () => mediaQuery.removeListener?.(handleChange)
  }, [clearCycleTimer])

  useEffect(() => {
    const mediaQuery = getCompactInspectorQuery()

    // Real MediaQueryList instances expose the queried media string. The
    // guard also keeps partial test/browser shims from hijacking this state.
    if (!mediaQuery || mediaQuery.media !== COMPACT_INSPECTOR_QUERY) {
      return
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setInspectorExpanded(!event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener?.(handleChange)
    return () => mediaQuery.removeListener?.(handleChange)
  }, [])

  useEffect(() => {
    if (previousExhibitIdRef.current === exhibitId) return

    clearCycleTimer()
    previousExhibitIdRef.current = exhibitId
    setCycleState((current) =>
      exhibit.cycleKind
        ? createInitialFirearmCycleState((current?.revision ?? -1) + 1)
        : undefined,
    )
  }, [clearCycleTimer, exhibit.cycleKind, exhibitId])

  useEffect(() => {
    if (
      !exhibit.cycleKind ||
      state.mode !== 'principle' ||
      state.reducedMotion ||
      cycleState?.status !== 'playing'
    ) {
      return
    }

    cycleTimerStartedAtRef.current = Date.now()
    cycleTimerRef.current = window.setTimeout(() => {
      cycleTimerRef.current = null
      cycleTimerStartedAtRef.current = null
      cycleTimerRemainingMsRef.current =
        FIREARM_CYCLE_PHASE_DURATION_MS
      setCycleState((current) =>
        current ? advanceFirearmCycle(current) : current,
      )
    }, cycleTimerRemainingMsRef.current)

    return cancelCycleTimerOnly
  }, [
    cancelCycleTimerOnly,
    clearCycleTimer,
    cycleState?.phaseIndex,
    cycleState?.revision,
    cycleState?.status,
    exhibit.cycleKind,
    exhibitId,
    state.mode,
    state.reducedMotion,
  ])

  useEffect(() => {
    if (!demoPlaying) {
      return
    }

    if (state.reducedMotion || state.stepIndex >= steps.length - 1) {
      setDemoPlaying(false)
      return
    }

    const timer = window.setTimeout(() => {
      clearCycleTimer()
      setCameraFocusPartId(null)
      setCycleState((current) =>
        current ? resetFirearmCycle(current) : current,
      )
      dispatch({ type: 'next-step' })
    }, 1_600)

    return () => window.clearTimeout(timer)
  }, [
    clearCycleTimer,
    demoPlaying,
    state.reducedMotion,
    state.stepIndex,
    steps.length,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.shiftKey && event.key.toLowerCase() === 'r')
      ) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          if (state.stepIndex > 0) {
            clearCycleTimer()
            setCameraFocusPartId(null)
            setCycleState((current) =>
              current ? resetFirearmCycle(current) : current,
            )
          }
          dispatch({ type: 'previous-step' })
          break
        case 'ArrowRight':
          event.preventDefault()
          if (state.stepIndex < steps.length - 1) {
            clearCycleTimer()
            setCameraFocusPartId(null)
            setCycleState((current) =>
              current ? resetFirearmCycle(current) : current,
            )
          }
          dispatch({ type: 'next-step' })
          break
        case 'Escape':
          event.preventDefault()
          onExit()
          break
        case 'r':
        case 'R':
          event.preventDefault()
          handleReset()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearCycleTimer, handleReset, onExit, state.stepIndex, steps.length])

  const announcement = selectedPart
    ? `第 ${state.stepIndex + 1} 步，${activeStep.label}，${activeMode.label}。已选择${selectedPart.label}。`
    : `第 ${state.stepIndex + 1} 步，${activeStep.label}，${activeMode.label}。尚未选择零件。`

  return (
    <div className="explorer-page">
      <nav className="explorer-rail" aria-label="探索室导航">
        <span className="explorer-rail__seal" aria-hidden="true">
          构
        </span>
        <button type="button" onClick={onExit} aria-label="返回藏品大厅">
          <span aria-hidden="true">←</span>
          <small>大厅</small>
        </button>
        <button
          type="button"
          aria-current="page"
          aria-label="前往结构舞台"
          onClick={() => scrollToExplorerSection('structure-stage')}
        >
          <span aria-hidden="true">01</span>
          <small>舞台</small>
        </button>
        <button
          type="button"
          aria-label="前往结构零件"
          onClick={() => handleInspectorNavigation('explorer-parts')}
        >
          <span aria-hidden="true">
            {String(parts.length).padStart(2, '0')}
          </span>
          <small>零件</small>
        </button>
        <button
          type="button"
          aria-label="前往结构知识卡"
          onClick={() => handleInspectorNavigation('knowledge-panel')}
        >
          <span aria-hidden="true">?</span>
          <small>知识</small>
        </button>
      </nav>

      <header className="explorer-topbar">
        <p className="explorer-breadcrumb">
          <span>藏品大厅</span>
          <span aria-hidden="true">/</span>
          <strong>{exhibit.title}</strong>
          <small>{exhibit.subtitle}</small>
        </p>
        <button
          type="button"
          className="explorer-reset ui-button ui-button--secondary"
          aria-label="复原模型"
          onClick={handleReset}
        >
          <span aria-hidden="true">↺</span>
          复原模型
        </button>
      </header>

      <main
        className={`explorer-workspace explorer-workspace--inspector-${
          inspectorExpanded ? 'expanded' : 'collapsed'
        }`}
      >
        <section
          className="explorer-stage"
          id="structure-stage"
          aria-label={`${exhibit.title}结构舞台`}
          data-mode={state.mode}
          data-playing={principlePlaying}
          data-cycle-state={hasFirearmCycle ? cycleState?.status : undefined}
          data-cycle-phase={
            hasFirearmCycle ? cycleState?.phaseIndex : undefined
          }
          data-scene-status={staticVisual ? 'static' : state.sceneStatus}
          tabIndex={-1}
        >
          <LearningGuide
            activeStep={activeStep}
            guided={guided}
            demoPlaying={demoPlaying}
            reducedMotion={state.reducedMotion}
            atLastStep={state.stepIndex >= steps.length - 1}
            onGuidedChange={handleGuidedChange}
            onToggleDemo={handleToggleDemo}
            modeControls={
              <>
                <p className="explorer-mode-status" role="status">
                  <strong>{activeMode.label}</strong>
                  <span>{activeMode.description}</span>
                  {hasFirearmCycle && (
                    <span className="explorer-mode-status__safety">
                      惰性示意弹 / 非拆装顺序
                    </span>
                  )}
                  {state.mode === 'principle' && !hasFirearmCycle && (
                    <span>{principleStatus}</span>
                  )}
                </p>

                {state.mode === 'principle' && (
                  exhibit.cycleKind ? (
                    cycleState ? (
                      <FirearmCycleControls
                        cycleDescriptionId={cycleDescriptionId}
                        cycleState={cycleState}
                        reducedMotion={state.reducedMotion}
                        onPlay={handleCyclePlay}
                        onPause={handleCyclePause}
                        onPrevious={handleCyclePrevious}
                        onNext={handleCycleNext}
                        onReset={handleCycleReset}
                      />
                    ) : null
                  ) : (
                    <div className="explorer-principle-controls">
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        aria-pressed={state.autoplay}
                        disabled={state.reducedMotion}
                        onClick={() => dispatch({ type: 'toggle-autoplay' })}
                      >
                        {state.autoplay ? '暂停原理' : '播放原理'}
                      </button>
                    </div>
                  )
                )}
              </>
            }
          />

          <div className="explorer-modes" role="group" aria-label="结构显示模式">
            {modes.map((mode) => (
              <button
                type="button"
                key={mode.id}
                aria-pressed={state.mode === mode.id}
                onClick={() => handleModeChange(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div
            className={`explorer-stage__visual${
              staticVisual
                ? ' explorer-stage__visual--forced-static'
                : ' explorer-stage__visual--canvas'
            }`}
          >
            {staticVisual && (
              <p className="explorer-static-status" role="status">
                已切换到静态学习模式
              </p>
            )}
            {staticVisual || !resolvedSceneLoader ? (
              <TankDiagram
                variant={exhibit.diagramVariant}
                firearmExhibitId={firearmExhibitId}
                label={
                  exhibit.cycleKind
                    ? `${exhibit.title} 静态结构示意`
                    : undefined
                }
                firearmPhase={
                  exhibit.cycleKind
                    ? (cycleState?.phaseIndex as 0 | 1 | 2 | 3 | 4 | 5)
                    : undefined
                }
                firearmGuideStep={
                  exhibit.cycleKind
                    ? (state.stepIndex as 0 | 1 | 2 | 3 | 4 | 5)
                    : undefined
                }
              />
            ) : (
              <SceneBoundary
                onExit={onExit}
                onError={handleSceneError}
                onRetry={handleSceneRetry}
                diagramVariant={exhibit.diagramVariant}
                diagramLabel={`${exhibit.title} 静态结构示意`}
                firearmExhibitId={firearmExhibitId}
                firearmGuideStep={
                  exhibit.cycleKind
                    ? (state.stepIndex as 0 | 1 | 2 | 3 | 4 | 5)
                    : undefined
                }
                firearmPhase={
                  exhibit.cycleKind
                    ? (cycleState?.phaseIndex as 0 | 1 | 2 | 3 | 4 | 5)
                    : undefined
                }
              >
                <LazySceneAttempt
                  loader={resolvedSceneLoader}
                  exhibitId={exhibitId}
                  stepIndex={state.stepIndex}
                  mode={state.mode}
                  selectedPartId={state.selectedPartId}
                  focusPartId={cameraFocusPartId}
                  autoplay={exhibit.cycleKind ? false : state.autoplay}
                  reducedMotion={state.reducedMotion}
                  resetToken={resetToken}
                  cameraCommand={cameraCommand}
                  onSelect={handleSelectPart}
                  onReady={handleSceneReady}
                  cycleState={exhibit.cycleKind ? cycleState : undefined}
                  cycleDescriptionId={
                    exhibit.cycleKind && state.mode === 'principle'
                      ? cycleDescriptionId
                      : undefined
                  }
                />
              </SceneBoundary>
            )}
            {!staticVisual && (
              <CameraControls
                selectedPartId={state.selectedPartId}
                onCommand={issueCameraCommand}
              />
            )}
          </div>
        </section>

        <ExplorerInspector
          expanded={inspectorExpanded}
          onExpandedChange={setInspectorExpanded}
        >
          <PartNavigator
            parts={parts}
            selected={state.selectedPartId}
            onSelect={handleSelectPart}
          />
          <KnowledgePanel
            selected={selectedPart}
            safetyNotice={
              hasFirearmCycle ? exhibit.reconstructionNote : undefined
            }
          />
        </ExplorerInspector>
      </main>

      <JourneyBar
        steps={steps}
        current={state.stepIndex}
        onChange={handleStepChange}
      />

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  )
}
