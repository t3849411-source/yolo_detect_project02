import type { DetectionResponse, HealthResponse } from './types'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001').replace(/\/$/, '')

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? `요청에 실패했습니다. (${response.status})`
  } catch {
    return `요청에 실패했습니다. (${response.status})`
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<HealthResponse>
}

export async function detectDrone(
  file: File,
  confidence: number,
  iou: number,
  signal?: AbortSignal,
): Promise<DetectionResponse> {
  const form = new FormData()
  form.append('file', file)
  const params = new URLSearchParams({
    confidence: confidence.toString(),
    iou: iou.toString(),
  })
  const response = await fetch(`${API_BASE_URL}/api/v1/detect?${params}`, {
    method: 'POST',
    body: form,
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<DetectionResponse>
}
