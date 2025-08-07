<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Dice from './Dice.vue'
import GameRules from './GameRules.vue'

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
  isPiggedOut: false, // Flag to show pig out indicator
  isProcessingNextPlayer: false, // Flag to prevent duplicate nextPlayer calls
  lastAction: null,
  notification: null
})

// Players array from connection manager
const players = ref([])
const gameStarted = ref(false)
const nextPlayerTimeout = ref(null) // Track the nextPlayer timeout to clear it if needed
const gameStartingPlayer = ref(0) // Track which player should start the next game

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
    
    // Play game start sound
    playGameSound('gameStart')
    
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

const getColorBorderClass = (colorName) => {
  const colorMap = {
    'Green': 'border-green-400',
    'Blue': 'border-blue-400', 
    'Purple': 'border-purple-400',
    'Orange': 'border-orange-400',
    'Red': 'border-red-400',
    'Yellow': 'border-yellow-400',
    'Pink': 'border-pink-400'
  }
  return colorMap[colorName] || 'border-gray-400'
}

const getColorTextClass = (colorName) => {
  const colorMap = {
    'Green': 'text-green-600',
    'Blue': 'text-blue-600', 
    'Purple': 'text-purple-600',
    'Orange': 'text-orange-600',
    'Red': 'text-red-600',
    'Yellow': 'text-yellow-600',
    'Pink': 'text-pink-600'
  }
  return colorMap[colorName] || 'text-gray-600'
}

const showNotification = (message, type = 'info', duration = 3000) => {
  gameState.notification = { message, type }
  setTimeout(() => {
    gameState.notification = null
  }, duration)
}

// Sound helper function
const playGameSound = (soundName, options = {}) => {
  try {
    if (window.$soundController && window.$soundController.playSound) {
      window.$soundController.playSound(soundName, options)
    }
  } catch (error) {
    console.warn('Failed to play sound:', soundName, error)
  }
}

// Dice landed sound helper - uses SoundController's helper function
const playDiceLandedSound = (rollValue) => {
  console.log('🎵 DICE LANDED SOUND:', rollValue, 'from player:', props.connectionManager?.state?.peerId)
  try {
    if (window.$soundController && window.$soundController.playDiceLandedSound) {
      window.$soundController.playDiceLandedSound(rollValue)
    }
  } catch (error) {
    console.warn('Failed to play dice landed sound:', rollValue, error)
  }
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
  
  gameState.lastAction = 'rolling'
  
  // Broadcast dice rolling start to other players
  const playerName = getPlayerName(props.connectionManager.state.peerId)
  
  // Send rolling start event using host-relay pattern
  if (props.isHost) {
    // Host generates the dice result immediately
    const diceResult = Math.floor(Math.random() * 6) + 1
    gameState.dice = diceResult
    gameState.isRolling = true
    
    broadcastGameAction({
      type: 'DICE_ROLLING_START',
      playerId: props.connectionManager.state.peerId,
      playerName: playerName,
      diceResult: diceResult
    })
  } else {
    // Non-host requests host to generate and broadcast the result
    // Don't start rolling animation yet - wait for host response
    broadcastGameAction({
      type: 'REQUEST_DICE_ROLLING_START',
      playerId: props.connectionManager.state.peerId,
      playerName: playerName
    })
  }
  
  // Show rolling notification
  showNotification(`🎲 ${playerName} is rolling...`, 'info', 2000)
  
  // Play dice roll sound
  playGameSound('diceRoll')
}

// Handle dice result from the dice component
const handleDiceResult = (finalDice) => {
  gameState.isRolling = false
  
  // Play dice landed sound for local player only
  playDiceLandedSound(finalDice)
  
  const playerName = getPlayerName(props.connectionManager.state.peerId)
  
  // Broadcast dice result to other players
  if (props.isHost) {
    // Host processes its own dice result through the centralized logic
    // Don't broadcast DICE_ROLLING_END here to avoid duplicate processing
    const action = {
      playerId: props.connectionManager.state.peerId,
      playerName: playerName,
      dice: finalDice
    }
    
    // Process the host's own dice result through the same centralized logic
    // as non-host players to avoid duplicate processing
    handleGameAction({ type: 'REQUEST_DICE_ROLLING_END', ...action })
  } else {
    // Non-host requests host to broadcast
    broadcastGameAction({
      type: 'REQUEST_DICE_ROLLING_END',
      playerId: props.connectionManager.state.peerId,
      playerName: playerName,
      dice: finalDice
    })
  }
  
  // Remove the old host-specific dice processing logic since it's now
  // handled centrally in the REQUEST_DICE_ROLLING_END case
}

const bankScore = () => {
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
    
    // Play coin bank sound
    playGameSound('coinBank')
    
    // Check for win condition
    if (currentPlayer.score >= 100) {
      gameState.gameEnded = true
      gameState.winner = currentPlayer
      gameState.lastAction = 'won'
      
      showNotification(`🏆 ${playerName} wins with ${currentPlayer.score} points!`, 'success', 6000)
      
      // Play game win sound
      playGameSound('gameWin')
      
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
  
  gameState.lastAction = 'banked'
  
  // End turn immediately for banking - no delay needed
  nextPlayer()
}

const nextPlayer = () => {
  console.log('nextPlayer called - gameEnded:', gameState.gameEnded, 'isHost:', props.isHost, 'isProcessingNextPlayer:', gameState.isProcessingNextPlayer)
  if (gameState.gameEnded) {
    console.log('nextPlayer: Early return because gameEnded is true')
    return
  }
  
  // Prevent multiple simultaneous nextPlayer calls
  if (gameState.isProcessingNextPlayer) {
    console.log('nextPlayer: Already processing nextPlayer, ignoring duplicate call')
    return
  }
  
  // Clear the timeout since we're processing now
  if (nextPlayerTimeout.value) {
    clearTimeout(nextPlayerTimeout.value)
    nextPlayerTimeout.value = null
  }
  
  gameState.isProcessingNextPlayer = true
  
  console.log('nextPlayer called - current player before:', gameState.currentPlayer)
  console.log('Players array:', players.value.map(p => ({ id: p.id, name: p.name })))
  
  // Reset turn state
  gameState.currentTurnScore = 0
  gameState.isTurnEnding = false
  gameState.isPiggedOut = false // Reset pig out indicator
  
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
  
  // Play turn change sound
  playGameSound('turnChange')
  
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
  gameState.isProcessingNextPlayer = false // Reset the flag
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
  // Rotate starting player for fairness
  gameStartingPlayer.value = (gameStartingPlayer.value + 1) % players.value.length
  
  // Reset game state completely
  gameState.currentPlayer = gameStartingPlayer.value
  gameState.currentRound = 1
  gameState.currentTurnScore = 0
  gameState.gameEnded = false
  gameState.winner = null
  gameState.dice = 1
  gameState.isRolling = false
  gameState.isTurnEnding = false  // Critical: Reset turn ending flag
  gameState.isPiggedOut = false   // Critical: Reset pig out flag
  gameState.isProcessingNextPlayer = false  // Critical: Reset processing flag
  gameState.lastAction = null
  
  // Reset player scores and set current player
  players.value.forEach((player, index) => {
    player.score = 0
    player.isCurrentPlayer = index === gameStartingPlayer.value
  })
  
  const startingPlayerName = getPlayerName(players.value[gameStartingPlayer.value]?.id)
  showNotification(`🎮 New Game Started! ${startingPlayerName} goes first!`, 'info', 3000)
  
  // Play game start sound
  playGameSound('gameStart')
  
  broadcastGameAction({
    type: 'NEW_GAME',
    gameState: { ...gameState },
    players: players.value,
    startingPlayer: gameStartingPlayer.value
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
        // Other player's successful roll
        gameState.dice = action.dice
        gameState.currentTurnScore = action.turnScore
        gameState.lastAction = 'rolled'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`🎲 ${playerName} rolled a ${action.dice}! Turn score: ${action.turnScore}`, 'info', 2500)
        
        // Don't play dice landed sound here - only local player should hear their own dice land
      } else {
        // My own successful roll confirmed by host
        gameState.dice = action.dice
        gameState.currentTurnScore = action.turnScore
        gameState.lastAction = 'rolled'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`🎲 ${playerName} rolled a ${action.dice}! Turn score: ${action.turnScore}`, 'success', 3000)
      }
      break
      
    case 'PIG_OUT':
      if (action.playerId !== props.connectionManager.state.peerId) {
        // Other player pigged out
        if (nextPlayerTimeout.value) {
          console.log('Clearing pending nextPlayer timeout because someone else pigged out')
          clearTimeout(nextPlayerTimeout.value)
          nextPlayerTimeout.value = null
        }
        
        gameState.dice = action.dice
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = true
        gameState.isPiggedOut = true
        gameState.lastAction = 'pigout'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💥 ${playerName} rolled a 1! Pig out! Turn lost!`, 'error', 3500)
        
        // Don't play dice landed sound here - only local player should hear their own dice land
        playGameSound('pigOut')
      } else {
        // My own pig out confirmed by host
        gameState.dice = action.dice
        gameState.currentTurnScore = 0
        gameState.isTurnEnding = true
        gameState.isPiggedOut = true
        gameState.lastAction = 'pigout'
        
        showNotification(`💥 You rolled a 1! Pig out! Turn lost!`, 'error', 4000)
        
        // Play pig out sound for yourself
        playGameSound('pigOut')
        
        // Non-host player who pigged out waits for host to handle nextPlayer
      }
      break
      
    case 'FIRST_ROLL_PROTECTION':
      if (action.playerId !== props.connectionManager.state.peerId) {
        // Other player's first roll protection
        gameState.dice = action.dice
        gameState.lastAction = 'first_roll_protection'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`🎲 ${playerName} rolled a 1 on first roll - roll again! (No pig out)`, 'info', 2500)
        
        // Don't play dice landed sound here - only local player should hear their own dice land
      } else {
        // My own first roll protection confirmed by host
        gameState.dice = action.dice
        gameState.lastAction = 'first_roll_protection'
        
        showNotification(`🎲 You rolled a 1 on first roll - roll again! (No pig out)`, 'info', 3000)
      }
      break
    
    case 'DICE_ROLLING_START':
      // All players (including the rolling player) receive this from the host
      gameState.isRolling = true
      gameState.dice = action.diceResult
      gameState.lastAction = 'rolling'
      
      const playerName = getPlayerName(action.playerId)
      if (action.playerId !== props.connectionManager.state.peerId) {
        showNotification(`🎲 ${playerName} is rolling...`, 'info', 1500)
        // Play dice roll sound for other players
        playGameSound('diceRoll')
      }
      break
      
    case 'DICE_ROLLING_END':
      if (action.playerId !== props.connectionManager.state.peerId) {
        gameState.isRolling = false
        gameState.dice = action.dice
        
        // Don't play dice landed sound here - it will be played by the specific result handlers
        // (SUCCESSFUL_ROLL, PIG_OUT, FIRST_ROLL_PROTECTION) to avoid duplicate sounds
      }
      break
      
    case 'REQUEST_DICE_ROLLING_START':
      // Only host handles this request and broadcasts to everyone
      if (props.isHost) {
        console.log('Host received REQUEST_DICE_ROLLING_START from:', action.playerId)
        
        // Host generates the dice result for consistency
        const diceResult = Math.floor(Math.random() * 6) + 1
        
        // Broadcast dice rolling start to everyone (including the requester)
        broadcastGameAction({
          type: 'DICE_ROLLING_START',
          playerId: action.playerId,
          playerName: action.playerName,
          diceResult: diceResult
        })
        
        // Update host's local state
        gameState.isRolling = true
        gameState.dice = diceResult
        gameState.lastAction = 'rolling'
        
        showNotification(`🎲 ${action.playerName} is rolling... (via host)`, 'info', 1500)
        
        // Play dice roll sound for host too (if it's another player rolling)
        if (action.playerId !== props.connectionManager.state.peerId) {
          playGameSound('diceRoll')
        }
      } else {
        console.log('Non-host received REQUEST_DICE_ROLLING_START - ignoring')
      }
      break
      
    case 'REQUEST_DICE_ROLLING_END':
      // Only host handles this request and processes the dice result
      if (props.isHost) {
        console.log('Host received REQUEST_DICE_ROLLING_END from:', action.playerId)
        
        // Verify that it's actually this player's turn
        const currentPlayer = players.value[gameState.currentPlayer]
        if (!currentPlayer || currentPlayer.id !== action.playerId) {
          console.warn('Received dice roll from player who is not current player:', {
            rollingPlayer: action.playerId,
            currentPlayerId: currentPlayer?.id,
            currentPlayerIndex: gameState.currentPlayer
          })
          return // Ignore dice rolls from players when it's not their turn
        }
        
        // Broadcast dice rolling end to everyone (including the requester)
        broadcastGameAction({
          type: 'DICE_ROLLING_END',
          playerId: action.playerId,
          playerName: action.playerName,
          dice: action.dice
        })
        
        // Update host's local state
        gameState.isRolling = false
        gameState.dice = action.dice
        
        // Don't play dice landed sound here - it will be played in the specific result handlers
        // (SUCCESSFUL_ROLL, PIG_OUT, FIRST_ROLL_PROTECTION) to avoid duplicate sounds
        
        // Host processes the dice result logic and broadcasts the outcome
        const finalDice = action.dice
        const rollingPlayerName = action.playerName
        
        console.log('Processing dice result:', {
          finalDice,
          currentTurnScore: gameState.currentTurnScore,
          playerId: action.playerId
        })
        
        if (finalDice === 1) {
          // Check if this is the first roll of the turn (no points accumulated yet)
          if (gameState.currentTurnScore === 0) {
            // First roll protection - just roll again, no pig out
            showNotification(`🎲 ${rollingPlayerName} rolled a 1 on first roll - roll again! (No pig out)`, 'info', 3000)
            
            broadcastGameAction({
              type: 'FIRST_ROLL_PROTECTION',
              playerId: action.playerId,
              playerName: action.playerName,
              dice: finalDice
            })
            
            gameState.lastAction = 'first_roll_protection'
          } else {
            // Pig out! Lose turn and current score
            gameState.isTurnEnding = true
            gameState.isPiggedOut = true
            gameState.currentTurnScore = 0
            gameState.lastAction = 'pigout'
            
            showNotification(`💥 ${rollingPlayerName} rolled a 1! Pig out! Turn lost!`, 'error', 4000)
            
            // Play pig out sound for host
            playGameSound('pigOut')
            
            broadcastGameAction({
              type: 'PIG_OUT',
              playerId: action.playerId,
              playerName: action.playerName,
              dice: finalDice
            })
            
            // Host handles nextPlayer after delay for pig out
            nextPlayerTimeout.value = setTimeout(() => {
              console.log('HOST PROCESSING PIG OUT: About to call nextPlayer()')
              nextPlayer()
            }, 4000)
          }
        } else {
          // Successful roll - add to current turn score
          const newTurnScore = gameState.currentTurnScore + finalDice
          gameState.currentTurnScore = newTurnScore
          gameState.lastAction = 'rolled'
          
          console.log('Updated turn score:', {
            oldScore: gameState.currentTurnScore - finalDice,
            addedDice: finalDice,
            newScore: newTurnScore
          })
          
          showNotification(`🎲 ${rollingPlayerName} rolled a ${finalDice}! Turn score: ${newTurnScore}`, 'success', 3000)
          
          broadcastGameAction({
            type: 'SUCCESSFUL_ROLL',
            playerId: action.playerId,
            playerName: action.playerName,
            dice: finalDice,
            turnScore: newTurnScore
          })
        }
      } else {
        console.log('Non-host received REQUEST_DICE_ROLLING_END - ignoring')
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
        gameState.lastAction = 'banked'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💰 ${playerName} banked ${action.bankedScore} points! Total: ${action.newTotal}`, 'info', 2500)
        
        // Play coin bank sound for other players
        playGameSound('coinBank')
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
      gameState.currentTurnScore = 0  // Critical: Reset turn score for new player
      gameState.isTurnEnding = false
      
      console.log('New current player:', players.value[gameState.currentPlayer])
      gameState.isPiggedOut = false // Reset pig out indicator
      gameState.lastAction = 'turn_change'
      
      const newCurrentPlayer = players.value[action.currentPlayer]
      console.log('New current player:', newCurrentPlayer)
      const currentPlayerName = getPlayerName(newCurrentPlayer?.id)
      showNotification(`🎯 It's ${currentPlayerName}'s turn!`, 'info', 2500)
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
        gameState.isPiggedOut = false // Reset pig out indicator
        
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
        const newPlayerName = getPlayerName(newCurrentPlayer?.id)
        showNotification(`🎯 It's ${newPlayerName}'s turn! (via host)`, 'info', 2500)
      } else {
        console.log('Non-host received REQUEST_NEXT_PLAYER - ignoring')
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
        gameState.lastAction = 'banked'
        
        const playerName = getPlayerName(action.playerId)
        showNotification(`💰 ${playerName} banked ${action.bankedScore} points! Total: ${action.newTotal} (via host)`, 'info', 2500)
        
        // Play coin bank sound for host too (if it's another player banking)
        if (action.playerId !== props.connectionManager.state.peerId) {
          playGameSound('coinBank')
        }
      } else {
        console.log('Non-host received REQUEST_HOLD_SCORE - ignoring')
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
      // Reset all game state from the broadcast
      Object.assign(gameState, action.gameState)
      players.value = action.players
      
      // Update starting player tracker if provided
      if (action.startingPlayer !== undefined) {
        gameStartingPlayer.value = action.startingPlayer
      }
      
      // Ensure all critical flags are reset for clean state
      gameState.isTurnEnding = false
      gameState.isPiggedOut = false
      gameState.isProcessingNextPlayer = false
      gameState.isRolling = false
      
      const startingPlayerName = getPlayerName(players.value[gameState.currentPlayer]?.id)
      showNotification(`🎮 New game started! ${startingPlayerName} goes first!`, 'info', 3000)
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
  <div class="game-board bg-gray-100">
    <div class="max-w-6xl mx-auto p-6 sm:p-8 border border-gray-100 rounded-2xl">
      
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-end space-x-3">
          <div class="text-2xl sm:text-4xl">🎲</div>
          <div>
            <!-- Mobile: Round and Race on same line, Desktop: stacked -->
            <div class="flex items-baseline space-x-2 sm:block sm:space-x-0">
              <div class="text-lg font-bold text-gray-800">Round {{ gameState.currentRound }}</div>
              <div class="text-sm text-gray-600">Race to 100 points!</div>
            </div>
          </div>
        </div>
        <!-- Hide quit game for now, can be enabled later -->
        <button 
          @click="leaveGame"
          v-if="false" 
          class="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Quit Game
        </button>
      </div>

      <!-- Players Scoreboard - Moved to Top -->
      <div class="mb-8">
        <div 
          class="grid gap-5 w-full grid-cols-1 md:grid-cols-2"
          :class="{
            'lg:grid-cols-3': players.length === 3 || players.length >= 5,
            'lg:grid-cols-2': players.length === 4
          }"
        >
          <div 
            v-for="player in players" 
            :key="player.id"
            class="relative bg-white rounded-xl border-l-8 p-4 transition-all duration-300 hover:shadow-xl"
            :style="!(player.isCurrentPlayer && !gameState.gameEnded) && !(gameState.winner && player.id === gameState.winner.id) ? 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05);' : ''"
            :class="{
              'ring-4 ring-pink-300 ring-opacity-50 transform scale-105 hover:scale-105 bg-gradient-to-r from-pink-50 to-red-50': player.isCurrentPlayer && !gameState.gameEnded && gameState.isPiggedOut,
              'ring-4 ring-yellow-300 ring-opacity-50 transform scale-105 hover:scale-105 bg-gradient-to-r from-yellow-50 to-orange-50': player.isCurrentPlayer && !gameState.gameEnded && !gameState.isPiggedOut,
              'ring-4 ring-green-300 ring-opacity-50 bg-gradient-to-r from-green-50 to-emerald-50': gameState.winner && player.id === gameState.winner.id,
              [getColorBorderClass(player.name)]: true
            }"
          >
            <!-- Current Player Indicator -->
            <div 
              v-if="player.isCurrentPlayer && !gameState.gameEnded"
              class="absolute -top-2 -right-2 text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse"
              :class="{
                'bg-pink-500 text-white': gameState.isPiggedOut,
                'bg-yellow-400 text-yellow-900': !gameState.isPiggedOut
              }"
            >
              {{ gameState.isPiggedOut ? 'PIG!' : 'TURN' }}
            </div>
            
            <!-- Winner Crown -->
            <div 
              v-if="gameState.winner && player.id === gameState.winner.id"
              class="absolute -top-2 -right-2 bg-green-400 text-green-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg"
            >
              WINNER
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="text-2xl">
                  {{ player.isHost ? '👑' : '🎮' }}
                  {{ gameState.winner && player.id === gameState.winner.id ? '🏆' : '' }}
                </div>
                <div>
                  <div class="font-bold text-gray-900">
                    {{ player.id === connectionManager?.state?.peerId ? `You (${player.name})` : player.name }}
                  </div>
                  <div class="text-xs text-gray-500">{{ player.isHost ? 'Host' : 'Player' }}</div>
                </div>
              </div>
              
              <div class="text-right">
                <!-- Banked points with optional turn points inline -->
                <div class="flex items-center justify-end space-x-2">
                  <div v-if="player.isCurrentPlayer && !gameState.gameEnded && gameState.currentTurnScore > 0" 
                       class="text-3xl font-bold" :class="getColorTextClass(player.name)">
                    +{{ gameState.currentTurnScore }}
                  </div>
                  <div v-if="player.isCurrentPlayer && !gameState.gameEnded && gameState.currentTurnScore > 0" 
                       class="text-2xl text-gray-400">
                    →
                  </div>
                  <div class="text-3xl font-bold text-gray-900">{{ player.score }}</div>
                </div>
                <div class="text-sm text-gray-500">points</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dice and Actions Area -->
      <div class="mb-8">
        <div class="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <!-- Dice Component -->
          <div class="">
            <Dice 
              :value="gameState.dice"
              :is-rolling="gameState.isRolling"
              :final-result="gameState.dice"
              :disabled="!canRoll"
              size="large"
              @roll="rollDice"
              @result="handleDiceResult"
            />
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6" v-if="!gameState.gameEnded && isMyTurn">
            <button 
              @click="rollDice"
              :disabled="!canRoll"
              class="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-md disabled:hover:from-gray-300 disabled:hover:to-gray-400 disabled:hover:shadow-md disabled:hover:scale-100"
            >
              {{ gameState.isRolling ? '🎲 Rolling...' : '🎲 Roll Dice' }}
            </button>
            
            <button 
              @click="bankScore"
              :disabled="!canHold"
              class="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-md disabled:hover:from-gray-300 disabled:hover:to-gray-400 disabled:hover:shadow-md disabled:hover:scale-100"
            >
              💰 Bank Points
            </button>
          </div>
          
          <!-- Game Over Actions -->
          <div v-if="gameState.gameEnded" class="space-y-4">
            <!-- Winner Announcement -->
            <div v-if="gameState.winner" class="mb-6 mt-6 p-6 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 rounded-xl text-center">
              <div class="text-4xl mb-2">🎉</div>
              <h3 class="text-3xl font-bold text-green-900 mb-2">Game Over!</h3>
              <p class="text-xl text-green-700">
                {{ gameState.winner.name }} wins with {{ gameState.winner.score }} points!
              </p>
            </div>

            <div v-if="isHost" class="flex justify-center">
              <button 
                @click="newGame"
                class="px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-lg rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🎮 New Game
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Notification Display (Hidden for clean UI - kept for debugging) -->
      <div v-if="false" class="mb-6 h-16 flex items-center justify-center">
        <div 
          v-if="gameState.notification" 
          class="w-full max-w-md p-4 rounded-xl shadow-lg border-l-4 transition-all duration-500 ease-in-out transform animate-pulse"
          :class="{
            'bg-green-50 border-green-400 text-green-800': gameState.notification.type === 'success',
            'bg-blue-50 border-blue-400 text-blue-800': gameState.notification.type === 'info',
            'bg-red-50 border-red-400 text-red-800': gameState.notification.type === 'error',
            'bg-yellow-50 border-yellow-400 text-yellow-800': gameState.notification.type === 'warning'
          }"
        >
          <div class="flex items-center justify-center">
            <div class="text-xl mr-3 flex-shrink-0">
              <span v-if="gameState.notification.type === 'success'">✅</span>
              <span v-else-if="gameState.notification.type === 'info'">ℹ️</span>
              <span v-else-if="gameState.notification.type === 'error'">💥</span>
              <span v-else-if="gameState.notification.type === 'warning'">⚠️</span>
            </div>
            <div class="font-semibold text-center">{{ gameState.notification.message }}</div>
          </div>
        </div>
      </div>

      <!-- Game Rules (Collapsed by default) -->
      <div class="mb-6">
        <GameRules />
      </div>

      <!-- Debug Info (hidden by default) -->
      <div v-if="false" class="mt-6 opacity-50 hover:opacity-100 transition-opacity">
        <details class="bg-yellow-50 rounded-lg overflow-hidden">
          <summary class="p-3 bg-yellow-100 cursor-pointer text-xs font-semibold text-yellow-900">
            � Debug Info
          </summary>
          <div class="p-3 bg-yellow-50 space-y-3">
            <!-- Force Sync Debug Button -->
            <div v-if="isHost && !gameState.gameEnded" class="text-center">
              <button 
                @click="forceSync"
                class="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors shadow-md"
              >
                � Force Sync (Debug)
              </button>
            </div>
            <!-- Debug Data -->
            <pre class="text-xs text-yellow-800 overflow-auto">{{ JSON.stringify(debugInfo, null, 2) }}</pre>
          </div>
        </details>
      </div>

      </div>
  </div>
</template>

<style scoped>
/* Main game card styling */
.game-board .max-w-6xl {
  backdrop-filter: blur(10px);
  background: white;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1), 
    0 10px 10px -5px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Custom animations */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.02);
    opacity: 0.9;
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.6);
  }
}

@keyframes bounce-subtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

/* Enhanced button hover effects */
.game-board button:not(:disabled):hover {
  transform: translateY(-1px);
}

.game-board button:not(:disabled):active {
  transform: translateY(0);
}

/* Completely prevent hover effects on disabled buttons */
.game-board button:disabled:hover {
  transform: none !important;
}

/* Current player glow effect */
.game-board .ring-4 {
  animation: glow 2s ease-in-out infinite;
}

/* Notification slide-in effect */
.game-board .transition-all {
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Score card hover effect - exclude current player cards that have scale transform */
.game-board .hover\:shadow-xl:hover:not(.scale-105) {
  transform: translateY(-2px);
}

/* Dice area enhancement */
.game-board .bg-white.rounded-2xl.shadow-xl {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Mobile responsiveness improvements */
@media (max-width: 640px) {
  .game-board {
    padding: .25rem;
    padding-top:0px;
  }
  
  .game-board .text-3xl {
    font-size: 2rem;
  }
  
  .game-board .text-2xl {
    font-size: 1.5rem;
  }
}

/* Focus styles for accessibility */
.game-board button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Enhanced card borders */
.game-board .border-l-8 {
  border-left-width: 8px;
}

/* Winner celebration effect */
.game-board .from-green-100.to-emerald-100 {
  animation: celebration 1s ease-in-out;
}

@keyframes celebration {
  0%, 100% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.02);
  }
  75% {
    transform: scale(0.98);
  }
}
</style>
