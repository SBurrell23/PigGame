import { ref, reactive, readonly } from 'vue'

// Game-specific connection state
const gameState = reactive({
  gameId: null,
  players: new Map(),
  gameData: {},
  isGameStarted: false,
  hostId: null
})

const connectionManager = ref(null)

// Message types for game communication
export const MESSAGE_TYPES = {
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave', 
  GAME_START: 'game_start',
  GAME_STATE: 'game_state',
  PLAYER_ACTION: 'player_action',
  GAME_END: 'game_end',
  CHAT_MESSAGE: 'chat_message'
}

// Composable for game connections
export function useGameConnection() {
  
  // Initialize connection manager reference
  const setConnectionManager = (manager) => {
    connectionManager.value = manager
  }

  // Create a new game (as host)
  const createGame = (gameId, playerName = 'Host') => {
    if (!connectionManager.value) {
      throw new Error('Connection manager not initialized')
    }

    gameState.gameId = gameId
    gameState.hostId = connectionManager.value.state.peerId
    gameState.isGameStarted = false
    
    // Add host as first player
    addPlayer(connectionManager.value.state.peerId, {
      name: playerName,
      isHost: true,
      joinedAt: Date.now()
    })

    return gameState.gameId
  }

  // Join an existing game
  const joinGame = (gameId, playerName = 'Player') => {
    if (!connectionManager.value) {
      throw new Error('Connection manager not initialized')
    }

    gameState.gameId = gameId
    
    // Connect to the host
    connectionManager.value.connectToPeer(gameId)
    
    // Send join message
    setTimeout(() => {
      sendGameMessage(MESSAGE_TYPES.PLAYER_JOIN, {
        playerName,
        playerId: connectionManager.value.state.peerId
      })
    }, 1000) // Small delay to ensure connection is established
  }

  // Add a player to the game
  const addPlayer = (playerId, playerData) => {
    gameState.players.set(playerId, {
      id: playerId,
      ...playerData
    })
  }

  // Remove a player from the game
  const removePlayer = (playerId) => {
    gameState.players.delete(playerId)
  }

  // Send a game-specific message
  const sendGameMessage = (type, data, targetPeerId = null) => {
    if (!connectionManager.value) {
      console.warn('Connection manager not available')
      return false
    }

    const message = {
      type,
      data,
      timestamp: Date.now(),
      senderId: connectionManager.value.state.peerId
    }

    if (targetPeerId) {
      return connectionManager.value.sendToPeer(targetPeerId, message)
    } else {
      return connectionManager.value.broadcast(message)
    }
  }

  // Handle incoming game messages
  const handleGameMessage = (peerId, message) => {
    console.log('Game message received:', message)

    switch (message.type) {
      case MESSAGE_TYPES.PLAYER_JOIN:
        handlePlayerJoin(peerId, message.data)
        break
        
      case MESSAGE_TYPES.PLAYER_LEAVE:
        handlePlayerLeave(peerId, message.data)
        break
        
      case MESSAGE_TYPES.GAME_START:
        handleGameStart(message.data)
        break
        
      case MESSAGE_TYPES.GAME_STATE:
        handleGameState(message.data)
        break
        
      case MESSAGE_TYPES.PLAYER_ACTION:
        handlePlayerAction(peerId, message.data)
        break
        
      case MESSAGE_TYPES.GAME_END:
        handleGameEnd(message.data)
        break
        
      case MESSAGE_TYPES.CHAT_MESSAGE:
        handleChatMessage(peerId, message.data)
        break
        
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  // Message handlers
  const handlePlayerJoin = (peerId, data) => {
    addPlayer(peerId, {
      name: data.playerName,
      isHost: false,
      joinedAt: Date.now()
    })

    // If we're the host, send current game state to new player
    if (gameState.hostId === connectionManager.value?.state.peerId) {
      sendGameMessage(MESSAGE_TYPES.GAME_STATE, {
        players: Array.from(gameState.players.values()),
        gameData: gameState.gameData,
        isGameStarted: gameState.isGameStarted
      }, peerId)
    }
  }

  const handlePlayerLeave = (peerId, data) => {
    removePlayer(peerId)
  }

  const handleGameStart = (data) => {
    gameState.isGameStarted = true
    gameState.gameData = { ...gameState.gameData, ...data }
  }

  const handleGameState = (data) => {
    if (data.players) {
      gameState.players.clear()
      data.players.forEach(player => {
        gameState.players.set(player.id, player)
      })
    }
    
    if (data.gameData) {
      gameState.gameData = { ...gameState.gameData, ...data.gameData }
    }
    
    if (typeof data.isGameStarted !== 'undefined') {
      gameState.isGameStarted = data.isGameStarted
    }
  }

  const handlePlayerAction = (peerId, data) => {
    // Override this in your specific game implementation
    console.log('Player action from', peerId, ':', data)
  }

  const handleGameEnd = (data) => {
    gameState.isGameStarted = false
    gameState.gameData = { ...gameState.gameData, ...data }
  }

  const handleChatMessage = (peerId, data) => {
    // Override this in your specific game implementation
    console.log('Chat message from', peerId, ':', data)
  }

  // Start the game (host only)
  const startGame = (initialGameData = {}) => {
    if (gameState.hostId !== connectionManager.value?.state.peerId) {
      throw new Error('Only the host can start the game')
    }

    gameState.isGameStarted = true
    gameState.gameData = { ...gameState.gameData, ...initialGameData }

    sendGameMessage(MESSAGE_TYPES.GAME_START, {
      gameData: gameState.gameData,
      startedAt: Date.now()
    })
  }

  // End the game
  const endGame = (gameResults = {}) => {
    gameState.isGameStarted = false
    
    sendGameMessage(MESSAGE_TYPES.GAME_END, {
      results: gameResults,
      endedAt: Date.now()
    })
  }

  // Update game state
  const updateGameState = (updates) => {
    gameState.gameData = { ...gameState.gameData, ...updates }
    
    // Broadcast updated state if we're the host
    if (gameState.hostId === connectionManager.value?.state.peerId) {
      sendGameMessage(MESSAGE_TYPES.GAME_STATE, {
        gameData: gameState.gameData
      })
    }
  }

  // Get current game info
  const getGameInfo = () => {
    return {
      gameId: gameState.gameId,
      players: Array.from(gameState.players.values()),
      gameData: gameState.gameData,
      isGameStarted: gameState.isGameStarted,
      isHost: gameState.hostId === connectionManager.value?.state.peerId,
      hostId: gameState.hostId,
      playerCount: gameState.players.size
    }
  }

  // Leave the current game
  const leaveGame = () => {
    if (connectionManager.value) {
      sendGameMessage(MESSAGE_TYPES.PLAYER_LEAVE, {
        playerId: connectionManager.value.state.peerId
      })
      
      connectionManager.value.disconnect()
    }
    
    // Reset game state
    gameState.gameId = null
    gameState.players.clear()
    gameState.gameData = {}
    gameState.isGameStarted = false
    gameState.hostId = null
  }

  return {
    // State
    gameState: readonly(gameState),
    
    // Setup
    setConnectionManager,
    
    // Game lifecycle
    createGame,
    joinGame,
    startGame,
    endGame,
    leaveGame,
    
    // Player management
    addPlayer,
    removePlayer,
    
    // Communication
    sendGameMessage,
    handleGameMessage,
    updateGameState,
    
    // Utilities
    getGameInfo,
    MESSAGE_TYPES
  }
}

// Export for direct usage without composable
export { gameState }
