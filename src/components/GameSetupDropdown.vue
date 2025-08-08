<script setup>
import GameSetup from './GameSetup.vue'

const props = defineProps({
  settings: { type: Object, required: true },
  isHost: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  autoOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['settings-changed'])

const onChanged = (s) => {
  emit('settings-changed', s)
}
</script>

<template>
  <details :open="autoOpen" class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-600 overflow-hidden transition-colors duration-300">
    <summary class="p-4 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold text-gray-700 dark:text-gray-300">
      ⚙️ Game Setup
    </summary>
    <div class="p-4 bg-white dark:bg-gray-800 transition-colors duration-300">
      <GameSetup 
        :settings="settings" 
        :is-host="isHost" 
        :locked="locked"
        @settings-changed="onChanged"
      />
    </div>
  </details>
</template>
