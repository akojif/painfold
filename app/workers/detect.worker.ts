/// <reference lib="webworker" />
import { handleDetectRequest, handleNamesRequest, type DetectRequest, type DetectResponse } from '../../core/detect/worker-protocol'
import { nameModel } from './name-model'

addEventListener('message', (event: MessageEvent<DetectRequest>) => {
  const send = (response: DetectResponse) => postMessage(response)
  const request = event.data
  if (request.kind === 'names') void handleNamesRequest(request, send, nameModel(request.ortPath))
  else handleDetectRequest(request, send)
})
