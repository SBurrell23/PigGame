<script setup>
import { computed } from 'vue'

const props = defineProps({
  settings: {
    type: Object,
  default: () => ({ pointsToWin: 100, finalChance: false })
  },
  isHost: {
    type: Boolean,
    default: false
  },
  locked: {
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

const finalChance = computed({
  get: () => !!(props.settings?.finalChance),
  set: (val) => {
    const v = !!val
    emit('settings-changed', { ...props.settings, finalChance: v })
  }
})

const dieSize = computed({
  get: () => props.settings?.dieSize ?? 6,
  set: (val) => {
  const v = Number(val)
  // If Pig Craps is active, prevent D2; bump to D6 locally
  const adjusted = (props.settings?.pigCraps && v === 2) ? 6 : v
  emit('settings-changed', { ...props.settings, dieSize: adjusted })
  }
})

const pigCraps = computed({
  get: () => !!(props.settings?.pigCraps),
  set: (val) => {
    const v = !!val
    // If host enables Pig Craps while die size is D2, auto-bump to D6
    if (v && props.isHost && (props.settings?.dieSize === 2)) {
      emit('settings-changed', { ...props.settings, pigCraps: v, dieSize: 6 })
    } else {
      emit('settings-changed', { ...props.settings, pigCraps: v })
    }
  }
})

// Slider tick positions for Points to Win labels
const minPoints = 10
const maxPoints = 250
const tickValues = [10, 50, 100, 150, 200, 250]
const tickLeft = (val) => `${((val - minPoints) / (maxPoints - minPoints)) * 100}%`
</script>

<template>
  <div>
    <div class="space-y-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
        Points to Win: <span class="font-semibold">{{ pointsToWin }}</span>
      </label>
      <div class="slider-with-labels">
        <input
          type="range"
          min="10"
          max="250"
          step="10"
          v-model.number="pointsToWin"
          :disabled="locked || !isHost"
          class="points-slider w-full accent-blue-500 disabled:opacity-60 cursor-default hover:cursor-pointer active:cursor-pointer focus:cursor-pointer disabled:cursor-not-allowed"
        />
        <!-- Value-aligned tick labels -->
        <div class="relative mt-1 mb-3 sm:mb-4 text-xs text-gray-500 dark:text-gray-400 slider-ticks select-none">
          <div class="relative" style="width: calc(100% - var(--thumb-size)); margin-left: calc(var(--thumb-size) / 2); height: 100%;">
            <span
              v-for="val in tickValues"
              :key="val"
              class="absolute -translate-x-1/2"
              :style="{ left: tickLeft(val) }"
            >
              {{ val }}
            </span>
          </div>
        </div>
      </div>

  <div class="mt-2 sm:mt-3 pt-2 border-t border-gray-200 dark:border-gray-700"></div>
      <div class="flex items-start justify-between gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Final Chance Round
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            When someone banks max points, other players will each get one final turn to beat their score. Highest total wins.
          </p>
        </div>
        <label
          class="inline-flex items-center select-none"
          :class="(locked || !isHost) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
        >
          <input
            type="checkbox"
            :checked="finalChance"
            @change="(e) => finalChance = e.target.checked"
            :disabled="locked || !isHost"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400 dark:peer-focus:ring-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 relative"></div>
        </label>
      </div>

      <!-- Page break -->
  <div class="pt-2 border-t border-gray-200 dark:border-gray-700"></div>

      <!-- Die Size Selector (distinct visual from slider) -->
      <div class="flex items-start justify-between gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Die Size
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose the number of faces for the dice.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            v-for="size in [2,4,6,8,10]"
            :key="size"
            :disabled="locked || !isHost || (pigCraps && size === 2)"
            @click="dieSize = size"
            :class="[
              'px-3 py-2 text-sm rounded-md border transition-colors select-none min-w-[55px]',
              (pigCraps && size === 2)
                ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-400 dark:border-red-600 disabled:cursor-not-allowed disabled:opacity-100'
                : (dieSize === size
                    ? 'bg-blue-600 text-white border-blue-600 shadow disabled:opacity-60 disabled:cursor-not-allowed'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed')
            ]"
            :title="pigCraps && size === 2 ? 'Pig Craps requires D4 or higher' : ''"
          >
            D{{ size }}
          </button>
        </div>
      </div>

      <!-- Pig Craps Mode -->
      <div class="pt-2 border-t border-gray-200 dark:border-gray-700"></div>
      <div class="flex items-start justify-between gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Pig Craps
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Roll two dice. Pig out only when they sum to 7.
          </p>
        </div>
        <label
          class="inline-flex items-center select-none"
          :class="(locked || !isHost) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
        >
          <input
            type="checkbox"
            :checked="pigCraps"
            @change="(e) => pigCraps = e.target.checked"
            :disabled="locked || !isHost"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400 dark:peer-focus:ring-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 relative"></div>
        </label>
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

/* Slider label alignment helpers */
.slider-with-labels {
  /* Approximate thumb size for common browsers; adjust if custom thumb CSS changes */
  --thumb-size: 20px;
}
.points-slider {
  width: 100%;
}
.slider-ticks span {
  /* Prevent line breaks and keep ticks tidy */
  white-space: nowrap;
}

/* Reserve vertical space for the ticks row */
.slider-ticks {
  height: 16px; /* about one line of text; adjust if needed */
}
</style>
