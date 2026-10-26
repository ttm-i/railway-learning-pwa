import type { DemoDataset } from './types'

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, '')

export function searchNetwork(dataset: DemoDataset, rawQuery: string) {
  const query = normalize(rawQuery)
  if (!query) return { stations: [], lines: [] }

  return {
    stations: dataset.stations.filter((station) => normalize(station.canonicalName).includes(query)),
    lines: dataset.lines.filter((line) => normalize(line.name).includes(query))
  }
}
