<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

// Props
const props = defineProps({
  connectionManager: {
    type: Object,
    required: true
  },
  playerName: {
    type: String,
    default: 'Player'
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits([
  'leave-game'
])

// Game state
const gameState = reactive({
  currentPlayer: 0,
  currentRound: 1,
  currentTurnScore: 0,
  gameEnded: false,
  winner: null,
  dice: 1,
  isRolling: false
})

// Players array from connection manager
const players = ref([])

// Initialize players from connection manager
onMounted(() => {
  if (props.connectionManager) {
    // Get all lobby players or build from connections
    if (props.connectionManager.allLobbyPlayers?.value?.length > 0) {
      players.value = props.connectionManager.allLobbyPlayers.value.map((player, index) => ({
        id: player.peerId,
        name: player.name,
        isHost: player.isHost,
        score: 0,
        isCurrentPlayer: index === 0
      }))
    } else {
      // Fallback: build from connection state
      players.value = [
        {
          id: props.connectionManager.state.peerId,
          name: props.playerName,
          isHost: props.isHost,
          score: 0,
          isCurrentPlayer: true
        }
      ]
      
      // Add connected peers
      props.connectionManager.connectedPeers.value.forEach(peerId => {
        players.value.push({
          id: peerId,
          name: 'Player',
          isHost: false,
          score: 0,
          isCurrentPlayer: false
        })
      })
    }
  }
})

// Computed properties
const currentPlayerData = computed(() => {
  return players.value[gameState.currentPlayer] || null
})

const isMyTurn = computed(() => {
  const currentPlayer = currentPlayerData.value
  return currentPlayer && currentPlayer.id === props.connectionManager?.state?.peerId
})

const canRoll = computed(() => {
  return isMyTurn.value && !gameState.isRolling && !gameState.gameEnded
})

const canHold = computed(() => {
  return isMyTurn.value && gameState.currentTurnScore > 0 && !gameState.isRolling && !gameState.gameEnded
})

// Game functions
const rollDice = () => {
  if (!canRoll.value) return
  
  gameState.isRolling = true
  
  // Animate dice roll
  let rollCount = 0
  const rollInterval = setInterval(() => {
    gameState.dice = Math.floor(Math.random() * 6) + 1
    rollCount++
    
    if (rollCount >= 10) {
      clearInterval(rollInterval)
      gameState.isRolling = false
      
      // Final dice value
      const finalDice = Math.floor(Math.random() * 6) + 1
      gameState.dice = finalDice
      
      // Send roll result to other players
      broadcastGameAction({
        type: 'DICE_ROLL',
        playerId: props.connectionManager.state.peerId,
        dice: finalDice,
        gameState: { ...gameState }
      })
      
      // Handle dice result
      if (finalDice === 1) {
        // Rolled a 1 - lose turn and current score
        gameState.currentTurnScore = 0
        nextPlayer()
      } else {
        // Add to current turn score
        gameState.currentTurnScore += finalDice
      }
    }
  }, 100)
}

const holdScore = () => {
  if (!canHold.value) return
  
  // Add current turn score to player's total
  const currentPlayer = currentPlayerData.value
  if (currentPlayer) {
    currentPlayer.score += gameState.currentTurnScore
    
    // Check for win condition
    if (currentPlayer.score >= 100) {
      gameState.gameEnded = true
      gameState.winner = currentPlayer
      
      broadcastGameAction({
        type: 'GAME_END',
        winner: currentPlayer,
        finalScores: players.value.map(p => ({ id: p.id, name: p.name, score: p.score }))
      })
      
      return
    }
  }
  
  // Send hold action to other players
  broadcastGameAction({
    type: 'HOLD_SCORE',
    playerId: props.connectionManager.state.peerId,
    score: gameState.currentTurnScore,
    newTotal: currentPlayer?.score || 0,
    gameState: { ...gameState }
  })
  
  gameState.currentTurnScore = 0
  nextPlayer()
}

const nextPlayer = () => {
  // Update current player
  players.value[gameState.currentPlayer].isCurrentPlayer = false
  gameState.currentPlayer = (gameState.currentPlayer + 1) % players.value.length
  players.value[gameState.currentPlayer].isCurrentPlayer = true
  
  // If we're back to player 0, increment round
  if (gameState.currentPlayer === 0) {
    gameState.currentRound++
  }
  
  broadcastGameAction({
    type: 'NEXT_PLAYER',
    currentPlayer: gameState.currentPlayer,
    currentRound: gameState.currentRound
  })
}

const broadcastGameAction = (action) => {
  if (props.connectionManager) {
    props.connectionManager.broadcast({
      type: 'GAME_ACTION',
      action: action,
      timestamp: Date.now()
    })
  }
}

const newGame = () => {
  // Reset game state
  gameState.currentPlayer = 0
  gameState.currentRound = 1
  gameState.currentTurnScore = 0
  gameState.gameEnded = false
  gameState.winner = null
  gameState.dice = 1
  gameState.isRolling = false
  
  // Reset player scores
  players.value.forEach((player, index) => {
    player.score = 0
    player.isCurrentPlayer = index === 0
  })
  
  broadcastGameAction({
    type: 'NEW_GAME',
    gameState: { ...gameState },
    players: players.value
  })
}

const leaveGame = () => {
  emit('leave-game')
}

// Handle incoming game actions from other players
const handleGameAction = (action) => {
  switch (action.type) {
    case 'DICE_ROLL':
      gameState.dice = action.dice
      gameState.currentTurnScore = action.gameState.currentTurnScore
      if (action.dice === 1) {
        gameState.currentTurnScore = 0
        // The rolling player will handle nextPlayer()
      }
      break
      
    case 'HOLD_SCORE':
      const holdingPlayer = players.value.find(p => p.id === action.playerId)
      if (holdingPlayer) {
        holdingPlayer.score = action.newTotal
      }
      gameState.currentTurnScore = 0
      break
      
    case 'NEXT_PLAYER':
      players.value.forEach((player, index) => {
        player.isCurrentPlayer = index === action.currentPlayer
      })
      gameState.currentPlayer = action.currentPlayer
      gameState.currentRound = action.currentRound
      break
      
    case 'GAME_END':
      gameState.gameEnded = true
      gameState.winner = action.winner
      action.finalScores.forEach(score => {
        const player = players.value.find(p => p.id === score.id)
        if (player) {
          player.score = score.score
        }
      })
      break
      
    case 'NEW_GAME':
      Object.assign(gameState, action.gameState)
      players.value = action.players
      break
  }
}

// Expose function for parent to call when receiving game actions
defineExpose({
  handleGameAction
})
</script>

<template>
  <div class="game-board bg-white rounded-lg shadow-md p-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">🎲 Pig Game</h2>
        <button 
          @click="leaveGame"
          class="px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
        >
          Leave Game
        </button>
      </div>
    </div>

    <!-- Game Status -->
    <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-blue-900">Round {{ gameState.currentRound }}</h3>
          <p class="text-sm text-blue-700">
            {{ gameState.gameEnded ? 'Game Over!' : `${currentPlayerData?.name || 'Unknown'}'s Turn` }}
          </p>
        </div>
        <div class="text-right">
          <div class="text-3xl font-bold text-blue-900">{{ gameState.currentTurnScore }}</div>
          <div class="text-sm text-blue-700">Turn Score</div>
        </div>
      </div>
    </div>

    <!-- Dice Area -->
    <div class="mb-6 text-center">
      <div class="mb-4">
        <div 
          class="inline-block w-20 h-20 bg-white border-2 border-gray-300 rounded-lg shadow-lg flex items-center justify-center text-4xl font-bold"
          :class="{ 'animate-pulse': gameState.isRolling }"
        >
          {{ gameState.dice }}
        </div>
      </div>
      
      <div class="space-x-4" v-if="!gameState.gameEnded">
        <button 
          @click="rollDice"
          :disabled="!canRoll"
          class="px-6 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {{ gameState.isRolling ? 'Rolling...' : 'Roll Dice' }}
        </button>
        
        <button 
          @click="holdScore"
          :disabled="!canHold"
          class="px-6 py-3 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Hold Score
        </button>
      </div>
      
      <!-- Game Over Actions -->
      <div v-if="gameState.gameEnded && isHost" class="space-x-4">
        <button 
          @click="newGame"
          class="px-6 py-3 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 transition-colors"
        >
          New Game
        </button>
      </div>
    </div>

    <!-- Winner Announcement -->
    <div v-if="gameState.gameEnded && gameState.winner" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
      <h3 class="text-2xl font-bold text-green-900 mb-2">🎉 Game Over! 🎉</h3>
      <p class="text-lg text-green-700">
        {{ gameState.winner.name }} wins with {{ gameState.winner.score }} points!
      </p>
    </div>

    <!-- Players Scoreboard -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h4 class="text-lg font-semibold text-gray-900 mb-4">Scoreboard</h4>
      
      <div class="space-y-2">
        <div 
          v-for="player in players" 
          :key="player.id"
          class="flex items-center justify-between p-3 bg-white rounded border-l-4"
          :class="{
            'border-green-400 bg-green-50': player.isCurrentPlayer && !gameState.gameEnded,
            'border-purple-400': player.isHost,
            'border-blue-400': !player.isHost && !player.isCurrentPlayer,
            'border-yellow-400 bg-yellow-50': gameState.winner && player.id === gameState.winner.id
          }"
        >
          <div class="flex items-center">
            <div class="text-lg mr-3">
              {{ player.isHost ? '👑' : '🎮' }}
              {{ player.isCurrentPlayer && !gameState.gameEnded ? '👆' : '' }}
              {{ gameState.winner && player.id === gameState.winner.id ? '🏆' : '' }}
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900">
                {{ player.id === connectionManager?.state?.peerId ? `You (${playerName})` : player.name }}
              </div>
              <div class="text-xs text-gray-500">{{ player.id }}</div>
            </div>
          </div>
          
          <div class="text-right">
            <div class="text-xl font-bold text-gray-900">{{ player.score }}</div>
            <div class="text-xs text-gray-500">points</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Game Rules -->
    <div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h4 class="text-sm font-semibold text-gray-900 mb-2">How to Play:</h4>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>• Roll the dice to accumulate points for your turn</li>
        <li>• Rolling a 1 ends your turn and loses all points for that turn</li>
        <li>• Click "Hold Score" to bank your turn points and pass to next player</li>
        <li>• First player to reach 100 points wins!</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse {
  animation: pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.1);
  }
}
</style>
