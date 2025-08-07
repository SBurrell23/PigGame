<template>
  <div class="sound-controller relative">
    <!-- Sound Icon Button -->
    <button
      @click="toggleDropdown"
      :class="[
        'p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
        isOpen ? 'bg-gray-700 dark:bg-gray-600' : 'bg-gray-100 dark:bg-gray-700'
      ]"
      :title="isMuted || masterVolume === 0 ? 'Unmute sounds' : 'Adjust volume'"
    >
      <!-- Dynamic Sound Icon -->
      <div class="w-6 h-6 flex items-center justify-center">
        <span v-if="isMuted || masterVolume === 0" class="text-xl">🔇</span>
        <span v-else-if="masterVolume < 0.3" class="text-xl">🔈</span>
        <span v-else-if="masterVolume < 0.7" class="text-xl">🔉</span>
        <span v-else class="text-xl">🔊</span>
      </div>
    </button>

    <!-- Volume Dropdown -->
    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-4 z-50 min-w-[200px] transition-colors duration-300"
      @click.stop
    >
      <div class="space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-center">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-300">Master Volume</h3>
        </div>

        <!-- Volume Slider -->
        <div class="space-y-2">
          <div class="flex items-center space-x-3">
            <span class="text-xs text-gray-500 dark:text-gray-400">🔈</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="masterVolume * 100"
              @input="updateVolume"
              :disabled="isMuted"
              class="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
              :class="volumeSliderClass"
            />
            <span class="text-xs text-gray-500 dark:text-gray-400">🔊</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 text-center transition-colors duration-300">
            {{ isMuted ? 'Muted' : Math.round(masterVolume * 100) + '%' }}
          </div>
        </div>

        <!-- Mute Button -->
        <button
          @click="toggleMute"
          class="w-full px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
        >
          {{ isMuted ? '🔇 Unmute' : '🔇 Mute' }}
        </button>

        <!-- Test Sound Button (Hidden for clean UI) -->
        <button
          v-if="false"
          @click="testSound"
          :disabled="isMuted"
          class="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          🎵 Test Sound
        </button>

        <!-- Sound Library Status (Hidden for clean UI) -->
        <div v-if="false" class="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-600 pt-2 transition-colors duration-300">
          <div>Loaded: {{ loadedSounds }} sounds</div>
          <div v-if="loadingErrors.length > 0" class="text-red-500 dark:text-red-400">
            Failed: {{ loadingErrors.length }} sounds
          </div>
        </div>
      </div>
    </div>

    <!-- Click Outside Detector -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="closeDropdown"
    ></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

// Props
const props = defineProps({
  soundsPath: {
    type: String,
    default: '/sounds'
  },
  defaultVolume: {
    type: Number,
    default: 0.5,
    validator: (value) => value >= 0 && value <= 1
  }
})

// Reactive state
const isOpen = ref(false)
const masterVolume = ref(props.defaultVolume)
const isMuted = ref(false)
const sounds = reactive(new Map())
const loadingErrors = ref([])
const isLoading = ref(false)

// Computed properties
const loadedSounds = computed(() => sounds.size)

const volumeSliderClass = computed(() => {
  if (isMuted.value) return 'opacity-50'
  
  // Dynamic slider color based on volume
  const volume = masterVolume.value
  if (volume < 0.3) return 'accent-red-500'
  if (volume < 0.7) return 'accent-yellow-500'
  return 'accent-green-500'
})

// Sound library configuration
const soundLibrary = {
  // Game actions
  diceRoll: 'dice-roll.wav', // Done
  diceLandedLow: 'dice-landed-low.wav', // Done
  diceLandedMedium: 'dice-landed-medium.wav', // Done
  diceLandedHigh: 'dice-landed-high.wav', // Done
  diceLandedMax: 'dice-landed-max.wav', // Done
  diceLandedMin: 'dice-landed-min.wav', // Done
  coinBank: 'coin-bank.wav', // Done
  pigOut: 'pig-out.mp3', // Done

  // Game events
  gameStart: 'game-start.wav', // Done
  gameWin: 'game-win.wav', // Done

  // UI sounds
  buttonClick: 'button-click.wav', // Done
  
  // Connection sounds
  playerJoin: 'player-join.wav', // Done
  playerLeave: 'player-leave.wav', // Done
  connectionLost: 'connection-lost.wav', // Done
  
  // Test sound
  test: 'test-beep.wav'
}

// Methods
const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const updateVolume = (event) => {
  masterVolume.value = parseFloat(event.target.value) / 100
  saveSettings()
}

const toggleMute = () => {
  const wasMuted = isMuted.value
  isMuted.value = !isMuted.value
  saveSettings()
  
  // Close dropdown only when muting (not when unmuting)
  if (!wasMuted && isMuted.value) {
    closeDropdown()
  }
}

const testSound = () => {
  playSound('test')
}

// Helper function for dice landed sounds based on roll value
const playDiceLandedSound = (rollValue) => {
  if (rollValue >= 2 && rollValue <= 3) {
    playSound('diceLandedLow')
  } else if (rollValue == 4) {
    playSound('diceLandedMedium')
  } else if (rollValue == 5) {
    playSound('diceLandedHigh')
  } else if (rollValue == 6) {
    playSound('diceLandedMax')
  } else if (rollValue == 1) {
    playSound('diceLandedMin')
  }
  // No sound for 1 (pig out) or invalid values
}

// Core sound loading and playing functionality
const loadSound = async (name, filename) => {
  try {
    // First, try to load from the sounds folder
    const audio = new Audio(`${props.soundsPath}/${filename}`)
    
    // Preload the audio
    audio.preload = 'auto'
    
    // Wait for the audio to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading ${filename}`))
      }, 3000) // Reduced timeout for faster fallback
      
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout)
        resolve()
      }, { once: true })
      
      audio.addEventListener('error', () => {
        clearTimeout(timeout)
        reject(new Error(`Failed to load ${filename}`))
      }, { once: true })
      
      // Trigger loading
      audio.load()
    })
    
    sounds.set(name, audio)
    console.log(`✅ Loaded sound: ${name} (${filename})`)
    
  } catch (error) {
    console.warn(`❌ Failed to load sound: ${name} (${filename})`, error)
    
    // For test sound, create a fallback programmatic beep
    if (name === 'test') {
      sounds.set(name, { isTestBeep: true })
      console.log(`🔧 Created fallback test beep for: ${name}`)
    } else {
      loadingErrors.value.push({ name, filename, error: error.message })
    }
  }
}

const loadAllSounds = async () => {
  isLoading.value = true
  loadingErrors.value = []
  
  console.log('🎵 Loading game sounds...')
  
  // Load all sounds in parallel
  const loadPromises = Object.entries(soundLibrary).map(([name, filename]) =>
    loadSound(name, filename)
  )
  
  await Promise.allSettled(loadPromises)
  
  isLoading.value = false
  console.log(`🎵 Sound loading complete: ${sounds.size}/${Object.keys(soundLibrary).length} sounds loaded`)
  
  if (loadingErrors.value.length > 0) {
    console.warn(`⚠️ ${loadingErrors.value.length} sounds failed to load:`, loadingErrors.value)
  }
}

const playSound = (soundName, options = {}) => {
  // Don't play if muted or no master volume
  if (isMuted.value || masterVolume.value === 0) {
    return
  }
  
  const audio = sounds.get(soundName)
  if (!audio) {
    console.warn(`🔇 Sound not found: ${soundName}`)
    return
  }
  
  try {
    // Handle test beep fallback
    if (audio.isTestBeep) {
      generateTestBeep()
      return
    }
    
    // Clone the audio for overlapping sounds
    const audioClone = audio.cloneNode()
    
    // Apply volume settings
    const volume = (options.volume || 1) * masterVolume.value
    audioClone.volume = Math.max(0, Math.min(1, volume))
    
    // Apply other options
    if (options.playbackRate) {
      audioClone.playbackRate = options.playbackRate
    }
    
    if (options.loop) {
      audioClone.loop = true
    }
    
    // Reset and play
    audioClone.currentTime = 0
    const playPromise = audioClone.play()
    
    if (playPromise) {
      playPromise.catch(error => {
        console.warn(`🔇 Failed to play sound: ${soundName}`, error)
      })
    }
    
    return audioClone
    
  } catch (error) {
    console.warn(`🔇 Error playing sound: ${soundName}`, error)
  }
}

// Programmatic test beep generator
const generateTestBeep = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800 // 800 Hz beep
    oscillator.type = 'sine'
    
    const currentTime = audioContext.currentTime
    const volume = masterVolume.value * 0.3 // Keep test beep quiet
    
    gainNode.gain.setValueAtTime(0, currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2)
    
    oscillator.start(currentTime)
    oscillator.stop(currentTime + 0.2)
  } catch (error) {
    console.warn('Failed to generate test beep:', error)
  }
}

// Settings persistence
const saveSettings = () => {
  try {
    const settings = {
      masterVolume: masterVolume.value,
      isMuted: isMuted.value
    }
    localStorage.setItem('pigGameSoundSettings', JSON.stringify(settings))
  } catch (error) {
    console.warn('Failed to save sound settings:', error)
  }
}

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('pigGameSoundSettings')
    if (saved) {
      const settings = JSON.parse(saved)
      masterVolume.value = settings.masterVolume ?? props.defaultVolume
      isMuted.value = settings.isMuted ?? false
    }
  } catch (error) {
    console.warn('Failed to load sound settings:', error)
  }
}

// Keyboard shortcuts
const handleKeyboard = (event) => {
  // M key to toggle mute
  if (event.key.toLowerCase() === 'm' && event.ctrlKey) {
    event.preventDefault()
    toggleMute()
  }
}

// Lifecycle
onMounted(async () => {
  loadSettings()
  await loadAllSounds()
  
  // Add keyboard listener
  document.addEventListener('keydown', handleKeyboard)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboard)
})

// Expose methods for external use
const SoundController = {
  playSound,
  playDiceLandedSound,
  setVolume: (volume) => {
    masterVolume.value = Math.max(0, Math.min(1, volume))
    saveSettings()
  },
  mute: () => {
    isMuted.value = true
    saveSettings()
  },
  unmute: () => {
    isMuted.value = false
    saveSettings()
  },
  toggleMute,
  isLoaded: (soundName) => sounds.has(soundName),
  getLoadedSounds: () => Array.from(sounds.keys()),
  reload: loadAllSounds
}

// Make sound controller globally available
defineExpose(SoundController)

// Also provide to parent components
const emit = defineEmits(['sound-controller-ready'])
emit('sound-controller-ready', SoundController)
</script>

<style scoped>
/* Custom slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

input[type="range"]::-webkit-slider-track {
  width: 100%;
  height: 8px;
  cursor: pointer;
  background: #e5e7eb;
  border-radius: 4px;
}

.dark input[type="range"]::-webkit-slider-track {
  background: #4b5563;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

input[type="range"]:disabled::-webkit-slider-thumb {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

/* Firefox */
input[type="range"]::-moz-range-track {
  width: 100%;
  height: 8px;
  cursor: pointer;
  background: #e5e7eb;
  border-radius: 4px;
  border: none;
}

.dark input[type="range"]::-moz-range-track {
  background: #4b5563;
}

input[type="range"]::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Dropdown animation */
.sound-controller > div:nth-child(2) {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Loading state */
.sound-controller[data-loading="true"] .text-xl {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
