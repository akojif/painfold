/// <reference lib="webworker" />
import { handleDetectRequest, type DetectRequest, type DetectResponse } from '../../core/detect/worker-protocol'

addEventListener('message', (event: MessageEvent<DetectRequest>) => {
  handleDetectRequest(event.data, (response: DetectResponse) => postMessage(response))
})
