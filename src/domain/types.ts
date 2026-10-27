export type StableId = `demo:${string}`

export interface Operator {
  stableId: StableId
  displayName: string
}

export interface Line {
  stableId: StableId
  operatorId: StableId
  name: string
  color: string
  stationIds: StableId[]
}

export interface Station {
  stableId: StableId
  canonicalName: string
  aliases?: string[]
  x: number
  y: number
}

export interface RailEdge {
  stableId: StableId
  from: StableId
  to: StableId
  kind: 'rail'
  lineId: StableId
  confirmationStatus: 'confirmed'
}

export interface DemoDataset {
  version: string
  publicationDate: string
  fictional: true
  notice: string
  operators: Operator[]
  lines: Line[]
  stations: Station[]
  edges: RailEdge[]
}

export interface RouteMetrics {
  transfers: number
  railSegments: number
  revisits: number
  walks: number
}
