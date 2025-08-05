<script setup>
import { ref, watch, onMounted } from 'vue'

// Props
const props = defineProps({
  value: {
    type: Number,
    default: 1,
    validator: (value) => value >= 1 && value <= 6
  },
  isRolling: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'large', // 'small', 'medium', 'large'
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['roll'])

// Internal state for animation
const displayValue = ref(props.value)
const animationInterval = ref(null)

// Size classes
const sizeClasses = {
  small: 'w-12 h-12 text-2xl',
  medium: 'w-16 h-16 text-3xl',
  large: 'w-20 h-20 text-4xl'
}

// Dice face emojis for visual enhancement
const diceEmojis = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅'
}

// Watch for rolling state changes
watch(() => props.isRolling, (newIsRolling) => {
  if (newIsRolling) {
    startRollingAnimation()
  } else {
    stopRollingAnimation()
    displayValue.value = props.value
  }
})

// Watch for value changes when not rolling
watch(() => props.value, (newValue) => {
  if (!props.isRolling) {
    displayValue.value = newValue
  }
})

const startRollingAnimation = () => {
  if (animationInterval.value) {
    clearInterval(animationInterval.value)
  }
  
  animationInterval.value = setInterval(() => {
    displayValue.value = Math.floor(Math.random() * 6) + 1
  }, 100) // Fast animation for rolling effect
}

const stopRollingAnimation = () => {
  if (animationInterval.value) {
    clearInterval(animationInterval.value)
    animationInterval.value = null
  }
}

const handleClick = () => {
  if (!props.disabled && !props.isRolling) {
    emit('roll')
  }
}

// Cleanup on unmount
onMounted(() => {
  displayValue.value = props.value
})
</script>

<template>
  <div class="dice-container text-center">
    <div class="">
      <div 
        :class="[
          'inline-block bg-white border-2 border-gray-300 rounded-lg shadow-lg flex items-center justify-center font-bold cursor-pointer transition-all duration-200',
          sizeClasses[size],
          {
            'animate-pulse border-blue-400 shadow-xl': isRolling,
            'hover:border-gray-400 hover:shadow-xl': !disabled && !isRolling,
            'opacity-50 cursor-not-allowed': disabled,
            'border-green-400 hover:border-green-500': !disabled && !isRolling,
            'animate-bounce': isRolling
          }
        ]"
        @click="handleClick"
      >
        <div class="flex flex-col items-center">
          <!-- Emoji dice face -->
          <div class="text-2xl mb-1" v-if="size === 'large'">
            {{ diceEmojis[displayValue] }}
          </div>
          <!-- Number -->
          <div :class="size === 'large' ? 'text-lg' : 'text-xl'">
            {{ displayValue }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dice-container {
  user-select: none;
}

/* Custom bounce animation for rolling */
@keyframes dice-roll {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(90deg); }
  50% { transform: scale(1) rotate(180deg); }
  75% { transform: scale(1.1) rotate(270deg); }
}

.animate-bounce {
  animation: dice-roll 0.3s ease-in-out infinite;
}
</style>
