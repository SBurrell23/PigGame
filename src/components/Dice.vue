<script setup>
import { ref, watch, computed } from 'vue'

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
  },
  finalResult: {
    type: Number,
    default: null,
    validator: (value) => value === null || (value >= 1 && value <= 6)
  }
})

// Emits
const emit = defineEmits(['roll', 'result'])

// Refs
const isAnimating = ref(false)
const currentValue = ref(props.value)

// Size mapping
const sizeMapping = {
  small: { size: 60, pipSize: 6 },
  medium: { size: 80, pipSize: 8 },
  large: { size: 100, pipSize: 10 }
}

// Computed dice size
const diceSize = computed(() => sizeMapping[props.size])

// Roll animation that displays random faces then shows the predetermined result
const startRollAnimation = () => {
  if (isAnimating.value) return
  
  isAnimating.value = true
  
  // Animation parameters
  const animationDuration = 1500 // 1.5 seconds (must match external game logic)
  const changeInterval = 45 // Change dice face every 45ms (faster face changes)
  const startTime = Date.now()
  
  // Always use finalResult if provided, otherwise wait for it to be set
  const finalValue = props.finalResult !== null ? props.finalResult : props.value
  
  // Pre-generate random intermediate values for animation (just for visual effect)
  const intermediateValues = []
  const totalSteps = Math.floor(animationDuration / changeInterval)
  for (let i = 0; i < totalSteps; i++) {
    intermediateValues.push(Math.floor(Math.random() * 6) + 1)
  }
  
  let currentStep = 0
  
  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = elapsed / animationDuration
    
    // Check if we have received the final result during animation
    const currentFinalValue = props.finalResult !== null ? props.finalResult : props.value
    
    if (progress < 1) {
      // Show random intermediate values for visual effect
      const intervalMultiplier = 1 + progress * 3 // Slow down over time
      const currentInterval = Math.floor(changeInterval * intervalMultiplier)
      const stepIndex = Math.floor(elapsed / currentInterval)
      
      if (stepIndex < intermediateValues.length && stepIndex !== currentStep) {
        currentValue.value = intermediateValues[stepIndex]
        currentStep = stepIndex
      }
      
      requestAnimationFrame(animate)
    } else {
      // Animation complete - show the current final value (which should be set by now)
      currentValue.value = currentFinalValue
      isAnimating.value = false
      emit('result', currentFinalValue)
    }
  }
  
  animate()
}

// Handle click
const handleClick = () => {
  if (!props.disabled && !props.isRolling && !isAnimating.value) {
    emit('roll')
  }
}

// Watch for rolling state changes
watch(() => props.isRolling, (newIsRolling) => {
  if (newIsRolling && !isAnimating.value) {
    startRollAnimation()
  }
})

// Watch for value changes when not rolling
watch(() => props.value, (newValue) => {
  if (!props.isRolling && !isAnimating.value) {
    currentValue.value = newValue
  }
})

// Get dot positions for each dice face
const getDotPositions = (value) => {
  const positions = []
  
  switch (value) {
    case 1:
      positions.push({ x: 50, y: 50 }) // Center
      break
    case 2:
      positions.push({ x: 25, y: 25 }) // Top-left
      positions.push({ x: 75, y: 75 }) // Bottom-right
      break
    case 3:
      positions.push({ x: 25, y: 25 }) // Top-left
      positions.push({ x: 50, y: 50 }) // Center
      positions.push({ x: 75, y: 75 }) // Bottom-right
      break
    case 4:
      positions.push({ x: 25, y: 25 }) // Top-left
      positions.push({ x: 75, y: 25 }) // Top-right
      positions.push({ x: 25, y: 75 }) // Bottom-left
      positions.push({ x: 75, y: 75 }) // Bottom-right
      break
    case 5:
      positions.push({ x: 25, y: 25 }) // Top-left
      positions.push({ x: 75, y: 25 }) // Top-right
      positions.push({ x: 50, y: 50 }) // Center
      positions.push({ x: 25, y: 75 }) // Bottom-left
      positions.push({ x: 75, y: 75 }) // Bottom-right
      break
    case 6:
      positions.push({ x: 25, y: 25 }) // Top-left
      positions.push({ x: 75, y: 25 }) // Top-right
      positions.push({ x: 25, y: 50 }) // Middle-left
      positions.push({ x: 75, y: 50 }) // Middle-right
      positions.push({ x: 25, y: 75 }) // Bottom-left
      positions.push({ x: 75, y: 75 }) // Bottom-right
      break
  }
  
  return positions
}
</script>

<template>
  <div class="dice-container">
    <div 
      :class="[
        'dice-face',
        `dice-${props.size}`,
        {
          'dice-rolling': isAnimating || props.isRolling,
          'dice-disabled': props.disabled,
          'dice-clickable': !props.disabled && !props.isRolling && !isAnimating
        }
      ]"
      @click="handleClick"
      :style="{
        width: diceSize.size + 'px',
        height: diceSize.size + 'px'
      }"
    >
      <!-- Dice pips (dots) -->
      <div
        v-for="(pip, index) in getDotPositions(currentValue)"
        :key="index"
        class="dice-pip"
        :style="{
          left: pip.x + '%',
          top: pip.y + '%',
          width: diceSize.pipSize + 'px',
          height: diceSize.pipSize + 'px'
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.dice-container {
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  margin: 0 auto;
}

.dice-face {
  position: relative;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%);
  border: 3px solid #495057;
  border-radius: 15%;
  box-shadow: 
    0 8px 16px rgba(0, 0, 0, 0.25),
    inset 2px 2px 4px rgba(255, 255, 255, 0.4),
    inset -2px -2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  margin: 0 auto;
}

.dice-face:hover:not(.dice-disabled):not(.dice-rolling) {
  transform: scale(1.05) translateY(-2px);
  box-shadow: 
    0 12px 24px rgba(0, 0, 0, 0.3),
    inset 2px 2px 4px rgba(255, 255, 255, 0.4),
    inset -2px -2px 4px rgba(0, 0, 0, 0.1);
}

.dice-rolling {
  animation: diceRoll 0.8s infinite ease-in-out;
  cursor: default !important;
}

.dice-disabled {
  opacity: 0.4;
  cursor: not-allowed !important;
  filter: grayscale(50%);
}

.dice-clickable {
  cursor: pointer;
}

.dice-pip {
  position: absolute;
  background: radial-gradient(circle, #212529 30%, #343a40 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 
    inset 1px 1px 2px rgba(0, 0, 0, 0.5),
    0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Size variants */
.dice-small {
  border-radius: 12%;
  border-width: 2px;
}

.dice-medium {
  border-radius: 14%;
  border-width: 2.5px;
}

.dice-large {
  border-radius: 15%;
  border-width: 3px;
}

/* Enhanced rolling animation with buzzing/shaking effect */
@keyframes diceRoll {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  8% { transform: translate(-3px, 2px) rotate(4deg) scale(1.02); }
  16% { transform: translate(4px, -1px) rotate(-3deg) scale(0.98); }
  24% { transform: translate(-1px, -4px) rotate(5deg) scale(1.01); }
  32% { transform: translate(2px, 3px) rotate(-2deg) scale(0.99); }
  40% { transform: translate(-4px, 1px) rotate(6deg) scale(1.03); }
  48% { transform: translate(3px, -3px) rotate(-4deg) scale(0.97); }
  56% { transform: translate(-2px, 4px) rotate(3deg) scale(1.01); }
  64% { transform: translate(4px, -2px) rotate(-5deg) scale(0.98); }
  72% { transform: translate(-3px, -1px) rotate(2deg) scale(1.02); }
  80% { transform: translate(1px, 3px) rotate(-3deg) scale(0.99); }
  88% { transform: translate(-1px, -2px) rotate(4deg) scale(1.01); }
  96% { transform: translate(2px, 1px) rotate(-1deg) scale(0.99); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}

/* Responsive hover effects */
@media (hover: hover) {
  .dice-clickable:hover {
    border-color: #007bff;
    background: linear-gradient(135deg, #ffffff 0%, #f1f3f4 50%, #e8eaed 100%);
  }
}

/* Active state */
.dice-clickable:active {
  transform: scale(0.95) translateY(1px);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.2),
    inset 2px 2px 4px rgba(255, 255, 255, 0.4),
    inset -2px -2px 4px rgba(0, 0, 0, 0.1);
}
</style>
