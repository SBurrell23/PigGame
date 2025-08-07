// This file provides programmatically generated test sounds
// Use this until you add real MP3 files

export const generateTestBeep = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.frequency.value = 800 // 800 Hz beep
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

// You can replace this with actual MP3 files later
export const soundPlaceholders = {
  'test-beep.mp3': generateTestBeep,
  // Add more placeholder generators as needed
}
