<script setup>
import { computed } from 'vue'

const props = defineProps({
  settings: {
    type: Object,
    default: () => ({ pointsToWin: 100 })
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['settings-changed'])

const pointsToWin = computed({
  get: () => props.settings?.pointsToWin ?? 100,
  set: (val) => {
    const v = Number(val)
    emit('settings-changed', { ...props.settings, pointsToWin: v })
  }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-colors duration-300">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-md font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-300">
        ⚙️ Game Setup
      </h4>
      <span class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
        {{ isHost ? 'Host controls' : 'View only' }}
      </span>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
        Points to Win: <span class="font-semibold">{{ pointsToWin }}</span>
      </label>
      <input
        type="range"
        min="50"
        max="200"
        step="10"
        :value="pointsToWin"
        @input="(e) => pointsToWin = e.target.value"
        :disabled="!isHost"
        class="w-full accent-blue-500 disabled:opacity-60 cursor-default hover:cursor-pointer active:cursor-pointer focus:cursor-pointer disabled:cursor-not-allowed"
      />
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>50</span>
        <span>100</span>
        <span>150</span>
        <span>200</span>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
/* Make cursor a pointer when interacting with the slider, but not when disabled */
input[type="range"]:not(:disabled):hover,
input[type="range"]:not(:disabled):active,
input[type="range"]:not(:disabled):focus {
  cursor: pointer;
}

/* Ensure the slider thumb also shows a pointer across browsers */
input[type="range"]::-webkit-slider-thumb {
  cursor: pointer;
}
input[type="range"]::-moz-range-thumb {
  cursor: pointer;
}
input[type="range"]::-ms-thumb {
  cursor: pointer;
}
</style>
