<script setup>
import GameSetup from './GameSetup.vue'

const props = defineProps({
  settings: { type: Object, required: true },
  isHost: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  autoOpen: { type: Boolean, default: false },
  gameOver: { type: Boolean, default: false }
})

const emit = defineEmits(['settings-changed'])

const onChanged = (s) => {
  emit('settings-changed', s)
}
</script>

<template>
  <details :open="autoOpen" class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-600 overflow-hidden transition-colors duration-300">
  <summary class="flex w-full items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
      <span class="font-semibold">⚙️ Game Settings</span>
      <span class="ml-4 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
        {{
          isHost
            ? (locked ? 'Locked During Game' : 'Host Controls')
            : ((gameOver || !locked) ? 'Host Determined' : 'Locked During Game')
        }}
      </span>
    </summary>
  <div class="p-4 bg-white dark:bg-gray-800 transition-colors duration-300 border-t border-gray-200 dark:border-gray-700">
      <GameSetup 
        :settings="settings" 
        :is-host="isHost" 
        :locked="locked"
        @settings-changed="onChanged"
      />
    </div>
  </details>
</template>
