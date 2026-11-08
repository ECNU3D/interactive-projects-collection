import {
  BufferGeometry,
  InstancedBufferGeometry,
  InstancedMesh,
  Line,
  Mesh,
  type Material,
  type Object3D,
} from 'three'

export interface SceneBudgetLimits {
  drawCalls: number
  triangles: number
}

export interface SceneBudgetReport {
  baseDrawCalls: number
  renderedTriangles: number
  instancedDetails: number
  visibleRenderObjects: number
  withinBudget: boolean
}

function geometryElementCount(geometry: BufferGeometry) {
  return geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
}

function boundedDrawCount(
  geometry: BufferGeometry,
  start: number,
  count: number,
) {
  const total = geometryElementCount(geometry)
  const drawStart = Math.max(start, geometry.drawRange.start)
  const requestedEnd = Number.isFinite(count) ? start + count : total
  const drawRangeEnd = Number.isFinite(geometry.drawRange.count)
    ? geometry.drawRange.start + geometry.drawRange.count
    : total
  const drawEnd = Math.min(requestedEnd, drawRangeEnd, total)
  return Math.max(0, drawEnd - drawStart)
}

function visibleGeometryBatches(
  geometry: BufferGeometry,
  material: Material | Material[],
) {
  if (!Array.isArray(material)) {
    if (!material.visible) return []
    return [boundedDrawCount(geometry, 0, Number.POSITIVE_INFINITY)]
  }

  return geometry.groups.flatMap((group) => {
    const groupMaterial = material[group.materialIndex ?? 0]
    if (!groupMaterial?.visible) return []
    return [boundedDrawCount(geometry, group.start, group.count)]
  })
}

function instancedAttributeCapacity(
  attribute: BufferGeometry['attributes'][string],
) {
  const direct = attribute as typeof attribute & {
    isInstancedBufferAttribute?: boolean
    meshPerAttribute?: number
  }
  if (direct.isInstancedBufferAttribute) {
    return direct.count * (direct.meshPerAttribute ?? 1)
  }

  const interleaved = attribute as typeof attribute & {
    data?: {
      count: number
      isInstancedInterleavedBuffer?: boolean
      meshPerAttribute?: number
    }
  }
  if (interleaved.data?.isInstancedInterleavedBuffer) {
    return interleaved.data.count * (interleaved.data.meshPerAttribute ?? 1)
  }

  return null
}

function geometryInstanceCount(geometry: BufferGeometry) {
  if (!(geometry instanceof InstancedBufferGeometry)) return 1

  const capacities = Object.values(geometry.attributes)
    .map(instancedAttributeCapacity)
    .filter((capacity): capacity is number => capacity !== null)
  const rendererCapacity = (
    geometry as InstancedBufferGeometry & { _maxInstanceCount?: number }
  )._maxInstanceCount
  if (typeof rendererCapacity === 'number' && Number.isFinite(rendererCapacity)) {
    capacities.push(rendererCapacity)
  }
  const available = capacities.length
    ? Math.max(0, Math.floor(Math.min(...capacities)))
    : 0
  const requested = Number.isFinite(geometry.instanceCount)
    ? Math.max(0, Math.floor(geometry.instanceCount))
    : available

  return capacities.length ? Math.min(requested, available) : requested
}

function renderInstanceCount(object: Mesh | Line) {
  if (object instanceof InstancedMesh) {
    return Number.isFinite(object.count)
      ? Math.max(0, Math.floor(object.count))
      : 0
  }
  return geometryInstanceCount(object.geometry)
}

/** Counts only visible render submissions from the real Three scene graph. */
export function getSceneBudgetReport(
  root: Object3D,
  limits: SceneBudgetLimits,
): SceneBudgetReport {
  const report = {
    baseDrawCalls: 0,
    renderedTriangles: 0,
    instancedDetails: 0,
    visibleRenderObjects: 0,
  }

  const visit = (object: Object3D, ancestorsVisible: boolean) => {
    const visible = ancestorsVisible && object.visible
    if (!visible) return

    if (object instanceof Mesh || object instanceof Line) {
      const instanceCount = renderInstanceCount(object)
      const batches = visibleGeometryBatches(object.geometry, object.material)
        .filter((count) => count > 0)

      if (instanceCount > 0 && batches.length > 0) {
        report.baseDrawCalls += batches.length
        report.visibleRenderObjects += 1
        if (object instanceof Mesh) {
          report.renderedTriangles += batches.reduce(
            (total, count) => total + Math.floor(count / 3) * instanceCount,
            0,
          )
        }
        if (
          object instanceof InstancedMesh ||
          object.geometry instanceof InstancedBufferGeometry
        ) {
          report.instancedDetails += instanceCount
        }
      }
    }

    object.children.forEach((child) => visit(child, visible))
  }

  visit(root, true)
  return {
    ...report,
    withinBudget:
      report.baseDrawCalls <= limits.drawCalls &&
      report.renderedTriangles <= limits.triangles,
  }
}
