export async function getHealthSnapshot(): Promise<{ building: { count: number } } & Record<string, unknown>> {
  return {
    building: { count: 1 }
  }
}
