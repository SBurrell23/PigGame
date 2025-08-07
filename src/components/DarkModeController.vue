<template>
  <div class="dark-mode-controller">
    <!-- Dark Mode Toggle Button -->
    <button
      @click="toggleDarkMode"
      :class="[
        'p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
        isDarkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-700'
      ]"
      :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      <!-- Dynamic Dark Mode Icon -->
      <div class="w-6 h-6 flex items-center justify-center">
        <span v-if="isDarkMode" class="text-xl">☀️</span>
        <span v-else class="text-xl">🌙</span>
      </div>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

// Reactive state
const isDarkMode = ref(false)

// Methods
const toggleDarkMode = () => {
  // Play button click sound
  try {
    if (window.$soundController && window.$soundController.playSound) {
      window.$soundController.playSound('buttonClick')
    }
  } catch (error) {
    console.warn('Failed to play button click sound:', error)
  }
  
  isDarkMode.value = !isDarkMode.value
  applyDarkMode()
  saveSettings()
}

const applyDarkMode = () => {
  const html = document.documentElement
  if (isDarkMode.value) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

// Settings persistence
const saveSettings = () => {
  try {
    localStorage.setItem('pigGameDarkMode', JSON.stringify(isDarkMode.value))
  } catch (error) {
    console.warn('Failed to save dark mode settings:', error)
  }
}

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('pigGameDarkMode')
    if (saved !== null) {
      isDarkMode.value = JSON.parse(saved)
    } else {
      // Default to system preference
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  } catch (error) {
    console.warn('Failed to load dark mode settings:', error)
    // Fallback to system preference
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
}

// Watch for system theme changes
const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    // Only auto-switch if user hasn't explicitly set a preference
    const saved = localStorage.getItem('pigGameDarkMode')
    if (saved === null) {
      isDarkMode.value = e.matches
      applyDarkMode()
    }
  })
}

// Lifecycle
onMounted(() => {
  loadSettings()
  applyDarkMode()
  watchSystemTheme()
})

// Watch for changes and apply immediately
watch(isDarkMode, () => {
  applyDarkMode()
})

// Expose methods for external use
const DarkModeController = {
  toggleDarkMode,
  setDarkMode: (enabled) => {
    isDarkMode.value = enabled
    applyDarkMode()
    saveSettings()
  },
  isDarkMode: () => isDarkMode.value
}

defineExpose(DarkModeController)

// Emit ready event
const emit = defineEmits(['dark-mode-ready'])
emit('dark-mode-ready', DarkModeController)
</script>

<style scoped>
/* Button hover effects */
.dark-mode-controller button {
  transition: all 0.2s ease-in-out;
}

.dark-mode-controller button:hover {
  transform: translateY(-1px);
}

.dark-mode-controller button:active {
  transform: translateY(0);
}

/* Icon animation */
.dark-mode-controller .text-xl {
  transition: transform 0.3s ease-in-out;
}

.dark-mode-controller button:hover .text-xl {
  transform: scale(1.1);
}
</style>
