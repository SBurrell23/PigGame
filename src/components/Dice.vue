<script setup>
import { ref, watch, computed } from 'vue'

// Props
const props = defineProps({
  value: {
    type: Number,
    default: 1,
    validator: (value) => value >= 1 && value <= 10
  },
  isRolling: {
    type: Boolean,
    default: false
  },
  sides: {
    type: Number,
    default: 6,
    validator: (value) => [2,4,6,8,10].includes(value)
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
    validator: (value) => value === null || (value >= 1 && value <= 10)
  }
})

// Emits
const emit = defineEmits(['roll', 'result'])

// Refs
const isAnimating = ref(false)
const currentValue = ref(props.value)

// Size mapping
const sizeMapping = {
  small: { size: 60, pipSize: 7 },
  medium: { size: 80, pipSize: 9 },
  large: { size: 100, pipSize: 12 }
}

// Computed dice size
const diceSize = computed(() => sizeMapping[props.size])

// Slightly reduce pip size for higher-sided dice to prevent crowding
const pipSizePx = computed(() => {
  let size = diceSize.value.pipSize
  if (props.sides > 6) {
    size = Math.round(size * 0.85)
  }
  return size
})

// Roll animation that displays random faces then shows the predetermined result
const startRollAnimation = () => {
  if (isAnimating.value) return
  
  isAnimating.value = true
  
  // Animation parameters
  const animationDuration = 1250 // 1.25 seconds (must match external game logic)
  const changeInterval = 40 // Change dice face every x ms
  const startTime = Date.now()
  
  // Always use finalResult if provided, otherwise wait for it to be set
  const finalValue = props.finalResult !== null ? props.finalResult : props.value
  
  // Pre-generate random intermediate values for animation (just for visual effect)
  // Ensure each value is different from the previous one
  const intermediateValues = []
  const totalSteps = Math.floor(animationDuration / changeInterval)
  let lastValue = currentValue.value
  
  for (let i = 0; i < totalSteps; i++) {
    let newValue
    do {
      newValue = Math.floor(Math.random() * props.sides) + 1
    } while (newValue === lastValue)
    
    intermediateValues.push(newValue)
    lastValue = newValue
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

// Get dot positions for each dice face (supports 1..10)
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
    case 7:
      // Six layout plus a center pip
      positions.push({ x: 25, y: 25 })
      positions.push({ x: 75, y: 25 })
      positions.push({ x: 25, y: 50 })
      positions.push({ x: 75, y: 50 })
      positions.push({ x: 25, y: 75 })
      positions.push({ x: 75, y: 75 })
      positions.push({ x: 50, y: 50 })
      break
    case 8:
      // Add mid-top and mid-bottom to the six layout
      positions.push({ x: 25, y: 25 })
      positions.push({ x: 75, y: 25 })
      positions.push({ x: 25, y: 50 })
      positions.push({ x: 75, y: 50 })
      positions.push({ x: 25, y: 75 })
      positions.push({ x: 75, y: 75 })
      positions.push({ x: 50, y: 25 })
      positions.push({ x: 50, y: 75 })
      break
    case 9:
      // 3x3 grid full
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          positions.push({ x: 25 * (c + 1), y: 25 * (r + 1) })
        }
      }
      break
    case 10:
  // 3-4-3 columns layout
  // Left column (x=25): 3 pips
  positions.push({ x: 25, y: 25 })
  positions.push({ x: 25, y: 50 })
  positions.push({ x: 25, y: 75 })
  // Center column (x=50): 4 pips (staggered to avoid row alignment)
  positions.push({ x: 50, y: 15 })
  positions.push({ x: 50, y: 37.5 })
  positions.push({ x: 50, y: 62.5 })
  positions.push({ x: 50, y: 85 })
  // Right column (x=75): 3 pips
  positions.push({ x: 75, y: 25 })
  positions.push({ x: 75, y: 50 })
  positions.push({ x: 75, y: 75 })
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
      <!-- Dice pips (dots) or pig snout for 1 -->
      <div
        v-if="currentValue === 1"
        class="dice-pig-snout"
        :style="{
          left: '50%',
          top: '46%',
          fontSize: (diceSize.size * 0.4) + 'px'
        }"
      >
        🐷
      </div>
      <div
        v-else
        v-for="(pip, index) in getDotPositions(currentValue)"
        :key="index"
        class="dice-pip"
        :style="{
          left: pip.x + '%',
          top: pip.y + '%',
          width: pipSizePx + 'px',
          height: pipSizePx + 'px'
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

.dice-pig-snout {
  position: absolute;
  transform: translate(-50%, -50%);
  user-select: none;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
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
  0% { transform: translate(0, 0); }
  10% { transform: translate(-6px, -2px); }
  20% { transform: translate(6px, 2px); }
  30% { transform: translate(-5px, -3px); }
  40% { transform: translate(5px, 1px); }
  50% { transform: translate(-4px, 2px); }
  60% { transform: translate(4px, -2px); }
  70% { transform: translate(-5px, 1px); }
  80% { transform: translate(5px, -1px); }
  90% { transform: translate(-3px, 2px); }
  100% { transform: translate(0, 0); }
}

/* Responsive hover effects */
@media (hover: hover) {
  .dice-clickable:hover {
    border-color: #cc72cf;
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
