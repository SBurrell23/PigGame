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
  },
  gameData: {
    type: Object,
    default: () => ({ players: [] })
  }
})

// Emits
const emit = defineEmits([
  'leave-game',
  'game-ended'
])

// Game state
const gameState = reactive({
  currentPlayer: 0,
  currentRound: 1,
  currentTurnScore: 0,
  gameEnded: false,
  winner: null,
  dice: 1,
  isRolling: false,
  isTurnEnding: false, // Flag to prevent actions during turn transitions (hold/pigout)
  lastAction: null,
  notification: null
})

// Players array from connection manager
const players = ref([])
const gameStarted = ref(false)

// Initialize players from connection manager
onMounted(() => {
  console.log('GameBoard mounted with props:', {
    connectionManager: props.connectionManager,
    playerName: props.playerName,
    isHost: props.isHost,
    gameData: props.gameData
  })
  
  if (props.connectionManager) {
    // First try to use gameData if it has players
    if (props.gameData?.players?.length > 0) {
      console.log('Using gameData players:', props.gameData.players)
      players.value = props.gameData.players.map((player, index) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        score: 0,
        isCurrentPlayer: player.isHost // Host always starts first
      }))
    }
    // Then try allLobbyPlayers from connection manager
    else if (props.connectionManager.allLobbyPlayers?.value?.length > 0) {
      console.log('Using allLobbyPlayers:', props.connectionManager.allLobbyPlayers.value)
      // Sort players so host is always first
      const allPlayers = [...props.connectionManager.allLobbyPlayers.value]
      allPlayers.sort((a, b) => {
        if (a.isHost && !b.isHost) return -1
        if (!a.isHost && b.isHost) return 1
        return 0
      })
      
      players.value = allPlayers.map((player, index) => ({
        id: player.peerId,
        name: player.peerId === props.connectionManager.state.peerId 
          ? getColorName(index) // Use color name for self too
          : player.isHost 
            ? getColorName(0) // Host is always Green
            : getColorName(index),
        isHost: player.isHost,
        score: 0,
        isCurrentPlayer: player.isHost // Host always starts first
      }))
    } else {
      console.log('Fallback: building from connection state')
      // Fallback: build from connection state
      players.value = [
        {
          id: props.connectionManager.state.peerId,
          name: props.isHost ? 'Green' : 'Blue', // Host is Green, first non-host is Blue
          isHost: props.isHost,
          score: 0,
          isCurrentPlayer: props.isHost // Current player only if host
        }
      ]
      
      // Add connected peers
      if (props.connectionManager.connectedPeers?.value) {
        props.connectionManager.connectedPeers.value.forEach((peerId, index) => {
          players.value.push({
            id: peerId,
            name: getColorName(index + 1), // +1 because host is at index 0
            isHost: false,
            score: 0,
            isCurrentPlayer: false
          })
        })
      }
    }
    
    // Set current player to host index
    const hostIndex = players.value.findIndex(p => p.isHost)
    gameState.currentPlayer = hostIndex >= 0 ? hostIndex : 0
    
    console.log('Final players array:', players.value)
    console.log('Current player index:', gameState.currentPlayer)
    
    gameStarted.value = true
    const currentPlayer = players.value[gameState.currentPlayer]
    const currentPlayerName = getPlayerName(currentPlayer?.id)
    showNotification(`🎮 Game Started! ${currentPlayerName} goes first!`, 'info')
    
    // Broadcast initial game state to ensure everyone is synchronized
    if (props.isHost) {
      console.log('Broadcasting initial game sync as host')
      broadcastGameAction({
        type: 'GAME_SYNC',
        currentPlayer: gameState.currentPlayer,
        currentRound: gameState.currentRound,
        players: players.value
      })
    }
  } else {
    console.error('No connection manager provided to GameBoard')
  }
})

// Utility functions
const getColorName = (index) => {
  // Host is always Green (index 0), then Blue, Purple, Orange, Red, Yellow, Pink
  const colors = ['Green', 'Blue', 'Purple', 'Orange', 'Red', 'Yellow', 'Pink']
  return colors[index] || `Player ${index + 1}`
}

const showNotification = (message, type = 'info', duration = 3000) => {
  gameState.notification = { message, type }
  setTimeout(() => {
    gameState.notification = null
  }, duration)
}

const getPlayerName = (playerId) => {
  const player = players.value.find(p => p.id === playerId)
  if (!player) return 'Unknown Player'
  if (player.id === props.connectionManager.state.peerId) return `You (${player.name})`
  return player.name
}

// Computed properties
const currentPlayerData = computed(() => {
  return players.value[gameState.currentPlayer] || null
})

const isMyTurn = computed(() => {
  const currentPlayer = currentPlayerData.value
  const result = currentPlayer && currentPlayer.id === props.connectionManager?.state?.peerId
  
  console.log('isMyTurn check:', {
    currentPlayerData: currentPlayer,
    myPeerId: props.connectionManager?.state?.peerId,
    result: result,
    currentPlayerIndex: gameState.currentPlayer
  })
  
  return result
})

const canRoll = computed(() => {
  return isMyTurn.value && !gameState.isRolling && !gameState.isTurnEnding && !gameState.gameEnded
})

const canHold = computed(() => {
  return isMyTurn.value && gameState.currentTurnScore > 0 && !gameState.isRolling && !gameState.isTurnEnding && !gameState.gameEnded
})

// Debug info
const debugInfo = computed(() => {
  const currentPlayer = currentPlayerData.value
  return {
    myId: props.connectionManager?.state?.peerId,
    currentPlayerId: currentPlayer?.id,
    currentPlayerIndex: gameState.currentPlayer,
    isMyTurn: isMyTurn.value,
    canRoll: canRoll.value,
    gameEnded: gameState.gameEnded,
    isRolling: gameState.isRolling,
    playersLength: players.value.length,
    players: players.value.map(p => ({ 
      id: p.id, 
      name: p.name, 
      isCurrentPlayer: p.isCurrentPlayer, 
      isHost: p.isHost,
      score: p.score // Add score to debug info
    })),
    // Safe connection manager state (avoiding circular references)
    connectionManagerState: props.connectionManager?.state ? {
      peerId: props.connectionManager.state.peerId,
      isHost: props.connectionManager.state.isHost,
      connectionStatus: props.connectionManager.state.connectionStatus
    } : null,
    // Connection details
    allLobbyPlayersCount: props.connectionManager?.allLobbyPlayers?.value?.length || 0,
    connectedPeersCount: props.connectionManager?.connectedPeers?.value?.length || 0,
    connectedPeersList: props.connectionManager?.connectedPeers?.value || [],
    // Last few actions received
    lastAction: gameState.lastAction
  }
})

// Game functions
const rollDice = () => {
  if (!canRoll.value) return
  
  gameState.isRolling = true
  gameState.lastAction = 'rolling'
  
  // Show rolling notification
  showNotification(`🎲 ${getPlayerName(props.connectionManager.state.peerId)} is rolling...`, 'info', 2000)
  
  // Animate dice roll
  let rollCount = 0
  const rollInterval = setInterval(() => {
    gameState.dice = Math.floor(Math.random() * 6) + 1
    rollCount++
    
    if (rollCount >= 15) { // Longer animation for better effect
      clearInterval(rollInterval)
      gameState.isRolling = false
      
      // Final dice value
      const finalDice = Math.floor(Math.random() * 6) + 1
      gameState.dice = finalDice
      
      // Handle dice result
      if (finalDice === 1) {
        // Pig out! Lose turn and current score
        gameState.isTurnEnding = true // Immediately prevent further actions
        gameState.currentTurnScore = 0
        gameState.lastAction = 'pigout'
        
        const playerName = getPlayerName(props.connectionManager.state.peerId)
        showNotification(`💥 ${playerName} rolled a 1! Pig out! Turn lost!`, 'error', 4000)
        
        // Send pig out result to other players using host-relay pattern
        if (props.isHost) {
          broadcastGameAction({
            type: 'PIG_OUT',
            playerId: props.connectionManager.state.peerId,
            playerName: props.playerName,
            dice: finalDice
          })
        } else {
          // Non-host requests host to broadcast
          broadcastGameAction({
            type: 'REQUEST_PIG_OUT',
            playerId: props.connectionManager.state.peerId,
            playerName: props.playerName,
            dice: finalDice
          })
        }
        
        // End turn after a delay
        setTimeout(() => {
          nextPlayer()
        }, 2000)
      } else {
        // Successful roll - add to current turn score
        gameState.currentTurnScore += finalDice
        gameState.lastAction = 'rolled'
        
        const playerName = getPlayerName(props.connectionManager.state.peerId)
        showNotification(`🎲 ${playerName} rolled a ${finalDice}! Turn score: ${gameState.currentTurnScore}`, 'success', 3000)
        
        // Send successful roll to other players using host-relay pattern
        if (props.isHost) {
          broadcastGameAction({
            type: 'SUCCESSFUL_ROLL',
            playerId: props.connectionManager.state.peerId,
            playerName: props.playerName,
            dice: finalDice,
            turnScore: gameState.currentTurnScore
          })
        } else {
          // Non-host requests host to broadcast
          broadcastGameAction({
            type: 'REQUEST_SUCCESSFUL_ROLL',
            playerId: props.connectionManager.state.peerId,
            playerName: props.playerName,
            dice: finalDice,
            turnScore: gameState.currentTurnScore
          })
        }
      }
    }
  }, 80) // Slightly slower for better visual effect
}

const holdScore = () => {
  if (!canHold.value) return
  
  // Immediately prevent further actions
  gameState.isTurnEnding = true
  
  // Add current turn score to player's total
  const currentPlayer = currentPlayerData.value
  if (currentPlayer) {
    const bankedScore = gameState.currentTurnScore
    currentPlayer.score += bankedScore
    
    const playerName = getPlayerName(currentPlayer.id)
    showNotification(`💰 ${playerName} banked ${bankedScore} points! Total: ${currentPlayer.score}`, 'success', 3000)
    
    // Check for win condition
    if (currentPlayer.score >= 100) {
      gameState.gameEnded = true
      gameState.winner = currentPlayer
      gameState.lastAction = 'won'
      
      showNotification(`🏆 ${playerName} wins with ${currentPlayer.score} points!`, 'success', 6000)
      
      broadcastGameAction({
        type: 'GAME_END',
        winner: currentPlayer,
        finalScores: players.value.map(p => ({ id: p.id, name: p.name, score: p.score }))
      })
      
      return
    }
  }
  
  // Send hold action to other players using host-relay pattern
  if (props.isHost) {
    broadcastGameAction({
      type: 'HOLD_SCORE',
      playerId: props.connectionManager.state.peerId,
      playerName: props.playerName,
      bankedScore: gameState.currentTurnScore,
      newTotal: currentPlayer?.score || 0,
      players: players.value
    })
  } else {
    // Non-host requests host to broadcast
    broadcastGameAction({
      type: 'REQUEST_HOLD_SCORE',
      playerId: props.connectionManager.state.peerId,
      playerName: props.playerName,
      bankedScore: gameState.currentTurnScore,
      newTotal: currentPlayer?.score || 0,
      players: players.value
    })
  }
  
  gameState.lastAction = 'held'
  
  // End turn immediately - nextPlayer will reset currentTurnScore and isHolding
  setTimeout(() => {
    nextPlayer()
  }, 1500)
}

const nextPlayer = () => {
  if (gameState.gameEnded) return
  
  console.log('nextPlayer called - current player before:', gameState.currentPlayer)
  console.log('Players array:', players.value.map(p => ({ id: p.id, name: p.name })))
  
  // Reset turn state
  gameState.currentTurnScore = 0
  gameState.isTurnEnding = false
  
  // Update current player
  players.value[gameState.currentPlayer].isCurrentPlayer = false
  gameState.currentPlayer = (gameState.currentPlayer + 1) % players.value.length
  players.value[gameState.currentPlayer].isCurrentPlayer = true
  
  console.log('nextPlayer - new current player index:', gameState.currentPlayer)
  console.log('nextPlayer - new current player:', players.value[gameState.currentPlayer])
  
  // If we're back to player 0, increment round
  if (gameState.currentPlayer === 0) {
    gameState.currentRound++
  }
  
  const newCurrentPlayer = players.value[gameState.currentPlayer]
  const playerName = getPlayerName(newCurrentPlayer.id)
  
  // Show turn notification
  showNotification(`🎯 It's ${playerName}'s turn!`, 'info', 3000)
  
  console.log('Broadcasting NEXT_PLAYER with:', {
    currentPlayer: gameState.currentPlayer,
    currentRound: gameState.currentRound,
    playersCount: players.value.length,
    isHost: props.isHost
  })
  
  // WORKAROUND: Only host broadcasts NEXT_PLAYER directly
  // Non-host players request the host to broadcast
  if (props.isHost) {
    broadcastGameAction({
      type: 'NEXT_PLAYER',
      currentPlayer: gameState.currentPlayer,
      currentRound: gameState.currentRound,
      players: players.value
    })
  } else {
    // Send a request to host to broadcast next player
    broadcastGameAction({
      type: 'REQUEST_NEXT_PLAYER',
      requestedCurrentPlayer: gameState.currentPlayer,
      requestedCurrentRound: gameState.currentRound,
      requestingPlayerId: props.connectionManager.state.peerId,
      players: players.value
    })
  }
  
  gameState.lastAction = 'turn_change'
}

const broadcastGameAction = (action) => {
  console.log('Broadcasting action:', action.type, 'to all peers')
  if (props.connectionManager) {
    props.connectionManager.broadcast({
      type: 'GAME_ACTION',
      action: action,
      timestamp: Date.now()
    })
  } else {
    console.error('No connection manager available for broadcasting')
  }
}

const forceSync = () => {
  console.log('Host forcing game sync to all players')
  broadcastGameAction({
    type: 'GAME_SYNC',
    currentPlayer: gameState.currentPlayer,
    currentRound: gameState.currentRound,
    players: players.value
  })
  showNotification('🔄 Forced sync sent to all players', 'info', 2000)
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
  console.log(`[${props.connectionManager?.state?.peerId}] Received game action:`, action.type, action)
  
  switch (action.type) {
    case 'GAME_SYNC':
      console.log('Received GAME_SYNC - syncing state from host')
      // Synchronize game state from host
      gameState.currentPlayer = action.currentPlayer
      gameState.currentRound = action.currentRound
      gameState.currentTurnScore = 0
      gameState.isTurnEnding = false
      
      // Update player current status
      players.value.forEach((player, index) => {
        player.isCurrentPlayer = index === action.currentPlayer
      })
      
      const syncPlayerName = getPlayerName(players.value[action.currentPlayer]?.id)
      showNotification(`🔄 Game synchronized! ${syncPlayerName}'s turn`, 'info', 2000)
      console.log('Post-sync state:', {
        currentPlayer: gameState.currentPlayer,
        currentPlayerData: players.value[gameState.currentPlayer]
      })
      break
      
    case 'SUCCESSFUL_ROLL':
      if (action.playerId !== props.connectionManager.state.peerId) {
        gameState.dice = action.dice
        gameState.currentTurnScore = action.turnScore
        gameState.lastAction = 'rolled'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`🎲 ${playerName} rolled a ${action.dice}! Turn score: ${action.turnScore}`, 'info', 2500)
      }
      break
      
    case 'PIG_OUT':
      if (action.playerId !== props.connectionManager.state.peerId) {
        gameState.dice = action.dice
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = true // Prevent actions during pig out transition
        gameState.lastAction = 'pigout'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💥 ${playerName} rolled a 1! Pig out! Turn lost!`, 'error', 3500)
      }
      break
    
    case 'DICE_ROLL':
      gameState.dice = action.dice
      gameState.currentTurnScore = action.gameState.currentTurnScore
      if (action.dice === 1) {
        gameState.currentTurnScore = 0
        // The rolling player will handle nextPlayer()
      }
      break
      
    case 'HOLD_SCORE':
      if (action.playerId !== props.connectionManager.state.peerId) {
        const holdingPlayer = players.value.find(p => p.id === action.playerId)
        if (holdingPlayer) {
          holdingPlayer.score = action.newTotal
        }
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = false
        gameState.lastAction = 'held'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💰 ${playerName} banked ${action.bankedScore} points! Total: ${action.newTotal}`, 'info', 2500)
      }
      break
      
    case 'NEXT_PLAYER':
      console.log('Received NEXT_PLAYER action:', action)
      console.log('Current gameState.currentPlayer:', gameState.currentPlayer)
      console.log('Action currentPlayer:', action.currentPlayer)
      console.log('Players array length:', players.value.length)
      
      // Always update - remove the condition check that was causing sync issues
      players.value.forEach((player, index) => {
        player.isCurrentPlayer = index === action.currentPlayer
      })
      gameState.currentPlayer = action.currentPlayer
      gameState.currentRound = action.currentRound
      gameState.currentTurnScore = 0
      gameState.isTurnEnding = false
      gameState.lastAction = 'turn_change'
      
      const newCurrentPlayer = players.value[action.currentPlayer]
      console.log('New current player:', newCurrentPlayer)
      const playerName = getPlayerName(newCurrentPlayer?.id)
      showNotification(`🎯 It's ${playerName}'s turn!`, 'info', 2500)
      break
      
    case 'REQUEST_NEXT_PLAYER':
      // Only host handles this request and broadcasts to everyone
      if (props.isHost) {
        console.log('Host received REQUEST_NEXT_PLAYER from:', action.requestingPlayerId)
        console.log('Requested player index:', action.requestedCurrentPlayer)
        
        // Update host's state to match the request
        gameState.currentPlayer = action.requestedCurrentPlayer
        gameState.currentRound = action.requestedCurrentRound
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = false
        
        // Update player current status
        players.value.forEach((player, index) => {
          player.isCurrentPlayer = index === action.requestedCurrentPlayer
        })
        
        // Now broadcast to everyone (including the requester)
        broadcastGameAction({
          type: 'NEXT_PLAYER',
          currentPlayer: action.requestedCurrentPlayer,
          currentRound: action.requestedCurrentRound,
          players: action.players
        })
        
        const newCurrentPlayer = players.value[action.requestedCurrentPlayer]
        const playerName = getPlayerName(newCurrentPlayer?.id)
        showNotification(`🎯 It's ${playerName}'s turn! (via host)`, 'info', 2500)
      } else {
        console.log('Non-host received REQUEST_NEXT_PLAYER - ignoring')
      }
      break
      
    case 'REQUEST_SUCCESSFUL_ROLL':
      // Only host handles this request and broadcasts to everyone
      if (props.isHost) {
        console.log('Host received REQUEST_SUCCESSFUL_ROLL from:', action.playerId)
        
        // Broadcast the successful roll to everyone (including the requester)
        broadcastGameAction({
          type: 'SUCCESSFUL_ROLL',
          playerId: action.playerId,
          playerName: action.playerName,
          dice: action.dice,
          turnScore: action.turnScore
        })
        
        // Also update host's local state
        gameState.dice = action.dice
        gameState.currentTurnScore = action.turnScore
        gameState.lastAction = 'rolled'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`🎲 ${playerName} rolled a ${action.dice}! Turn score: ${action.turnScore} (via host)`, 'info', 2500)
      } else {
        console.log('Non-host received REQUEST_SUCCESSFUL_ROLL - ignoring')
      }
      break
      
    case 'REQUEST_HOLD_SCORE':
      // Only host handles this request and broadcasts to everyone
      if (props.isHost) {
        console.log('Host received REQUEST_HOLD_SCORE from:', action.playerId)
        
        // Update the player's score in host's state
        const holdingPlayer = players.value.find(p => p.id === action.playerId)
        if (holdingPlayer) {
          holdingPlayer.score = action.newTotal
        }
        
        // Broadcast the hold score to everyone (including the requester)
        broadcastGameAction({
          type: 'HOLD_SCORE',
          playerId: action.playerId,
          playerName: action.playerName,
          bankedScore: action.bankedScore,
          newTotal: action.newTotal,
          players: players.value
        })
        
        // Update host's local game state
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = false
        gameState.lastAction = 'held'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💰 ${playerName} banked ${action.bankedScore} points! Total: ${action.newTotal} (via host)`, 'info', 2500)
      } else {
        console.log('Non-host received REQUEST_HOLD_SCORE - ignoring')
      }
      break
      
    case 'REQUEST_PIG_OUT':
      // Only host handles this request and broadcasts to everyone
      if (props.isHost) {
        console.log('Host received REQUEST_PIG_OUT from:', action.playerId)
        
        // Broadcast the pig out to everyone (including the requester)
        broadcastGameAction({
          type: 'PIG_OUT',
          playerId: action.playerId,
          playerName: action.playerName,
          dice: action.dice
        })
        
        // Update host's local game state
        gameState.dice = action.dice
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = true
        gameState.lastAction = 'pigout'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💥 ${playerName} rolled a 1! Pig out! Turn lost! (via host)`, 'error', 3500)
      } else {
        console.log('Non-host received REQUEST_PIG_OUT - ignoring')
      }
      break
      
    case 'GAME_END':
      gameState.gameEnded = true
      gameState.winner = action.winner
      gameState.lastAction = 'won'
      
      const winnerName = getPlayerName(action.winner.id)
      showNotification(`🏆 ${winnerName} wins with ${action.winner.score} points!`, 'success', 5000)
      
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
      showNotification(`🎮 New game started!`, 'info', 2000)
      break
  }
}

// Handle player disconnection during game
const handlePlayerDisconnected = (disconnectedPlayerId) => {
  console.log('Handling player disconnection:', disconnectedPlayerId)
  
  // Find and remove the disconnected player
  const disconnectedPlayerIndex = players.value.findIndex(p => p.id === disconnectedPlayerId)
  
  if (disconnectedPlayerIndex !== -1) {
    const disconnectedPlayer = players.value[disconnectedPlayerIndex]
    
    // Show notification about player leaving
    showNotification(`${disconnectedPlayer.name} has left the game`, 'warning', 3000)
    
    // Remove player from the game
    players.value.splice(disconnectedPlayerIndex, 1)
    
    // Adjust current player index if needed
    if (gameState.currentPlayer >= disconnectedPlayerIndex) {
      gameState.currentPlayer = Math.max(0, gameState.currentPlayer - 1)
    }
    
    // If only one player left, end the game
    if (players.value.length <= 1) {
      gameState.gameEnded = true
      if (players.value.length === 1) {
        gameState.winner = players.value[0]
        showNotification(`🏆 ${players.value[0].name} wins by default!`, 'success', 5000)
      } else {
        showNotification('Game ended - no players remaining', 'info', 3000)
      }
    } else {
      // Make sure current player index is valid
      if (gameState.currentPlayer >= players.value.length) {
        gameState.currentPlayer = 0
      }
    }
  }
}

// Handle host disconnection - end game and return to lobby
const handleHostDisconnected = () => {
  console.log('Host disconnected - ending game')
  gameState.gameEnded = true
  showNotification('Host disconnected - returning to lobby...', 'warning', 3000)
  
  // Emit event to parent to return to lobby
  setTimeout(() => {
    emit('game-ended')
  }, 3000)
}

// Expose functions for parent to call
defineExpose({
  handleGameAction,
  handlePlayerDisconnected,
  handleHostDisconnected
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

    <!-- Notification Display -->
    <div class="mb-4 h-16 flex items-center">
      <div 
        v-if="gameState.notification" 
        class="w-full p-3 rounded-lg border-l-4 transition-all duration-300 ease-in-out transform"
        :class="{
          'bg-green-50 border-green-400 text-green-800': gameState.notification.type === 'success',
          'bg-blue-50 border-blue-400 text-blue-800': gameState.notification.type === 'info',
          'bg-red-50 border-red-400 text-red-800': gameState.notification.type === 'error',
          'bg-yellow-50 border-yellow-400 text-yellow-800': gameState.notification.type === 'warning'
        }"
      >
        <div class="flex items-center">
          <div class="text-lg mr-2 flex-shrink-0">
            <span v-if="gameState.notification.type === 'success'">✅</span>
            <span v-else-if="gameState.notification.type === 'info'">ℹ️</span>
            <span v-else-if="gameState.notification.type === 'error'">❌</span>
            <span v-else-if="gameState.notification.type === 'warning'">⚠️</span>
          </div>
          <div class="font-medium text-sm leading-tight">{{ gameState.notification.message }}</div>
        </div>
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
      
      <!-- Debug/Admin Actions -->
      <div v-if="isHost && !gameState.gameEnded" class="mt-4">
        <button 
          @click="forceSync"
          class="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
        >
          Force Sync (Debug)
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
                {{ player.id === connectionManager?.state?.peerId ? `You (${player.name})` : player.name }}
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

    <!-- Debug Info (temporary) -->
    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h4 class="text-xs font-semibold text-yellow-900 mb-2">Debug Info:</h4>
      <pre class="text-xs text-yellow-800">{{ JSON.stringify(debugInfo, null, 2) }}</pre>
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
