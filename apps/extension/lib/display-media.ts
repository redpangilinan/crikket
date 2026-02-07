interface TabCaptureConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: "tab"
    chromeMediaSourceId: string
  }
}

export const requestTabCaptureStream = async (
  tabId: number
): Promise<MediaStream> => {
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  })

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as TabCaptureConstraints,
  })

  return stream
}
