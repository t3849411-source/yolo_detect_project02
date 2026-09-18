export type BoundingBox = {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  height: number
}

export type Detection = {
  class_id: number
  class_name: string
  confidence: number
  bbox: BoundingBox
  bbox_normalized: BoundingBox
}

export type DetectionResponse = {
  request_id: string
  model: string
  device: string
  image: {
    filename: string
    content_type: string
    width: number
    height: number
    size_bytes: number
  }
  detection_count: number
  detections: Detection[]
  timing: {
    decode_ms: number
    inference_ms: number
    total_ms: number
  }
}

export type HealthResponse = {
  status: string
  model: string
  model_sha256: string
  device: string
  classes: Record<string, string>
}
