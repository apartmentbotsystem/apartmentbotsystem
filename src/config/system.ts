export function getSpikeThresholds(): { waterSpikeRatio: number; electricSpikeRatio: number; totalSpikeRatio: number } {
  return {
    waterSpikeRatio: 3,
    electricSpikeRatio: 3,
    totalSpikeRatio: 2
  }
}
