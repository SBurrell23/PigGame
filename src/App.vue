<script setup>
import { ref, onMounted } from 'vue'
import ConnectionManager from './components/ConnectionManager.vue'
import GameBoard from './components/GameBoard.vue'
import GameRules from './components/GameRules.vue'
import { useGameConnection } from './composables/useGameConnection.js'

// Game connection composable
const { 
  setConnectionManager, 
  handleGameMessage, 
  getGameInfo,
  gameState
} = useGameConnection()

// Refs
const connectionManager = ref(null)
const gameBoardRef = ref(null)
const currentView = ref('lobby') // 'lobby' or 'game'
const gameData = ref(null)
const isDisconnecting = ref(false) // Flag to prevent lobby flash during disconnection

// Connection event handlers
const onPeerReady = (event) => {
  console.log('Peer ready:', event)
  // Set the connection manager in our game composable
  setConnectionManager(connectionManager.value)
}

const onPeerConnected = (event) => {
  console.log('Peer connected:', event)
}

const onPeerDisconnected = (event) => {
  console.log('Peer disconnected:', event)
  
  // If a peer disconnected during game, forward to GameBoard
  if (currentView.value === 'game' && event.duringGame) {
    if (gameBoardRef.value && gameBoardRef.value.handlePlayerDisconnected) {
      gameBoardRef.value.handlePlayerDisconnected(event.peerId)
    }
  }
}

const onDataReceived = (event) => {
  console.log('Data received:', event)
  
  // Handle special game messages
  if (event.data.type === 'HOST_LEFT_GAME') {
    // Host left - disconnect completely and return to front page
    console.log('Host left game, disconnecting completely')
    
    // Set disconnecting flag immediately to prevent lobby flash
    isDisconnecting.value = true
    
    // Disconnect completely
    if (connectionManager.value && connectionManager.value.disconnect) {
      connectionManager.value.disconnect()
    }
    
    // Return to lobby view (which will show connection screen since we're disconnected)
    currentView.value = 'lobby'
    gameData.value = null
    
    // Reset disconnecting flag after a brief delay
    setTimeout(() => {
      isDisconnecting.value = false
    }, 200)
    return
  }
  
  if (event.data.type === 'PLAYER_DISCONNECTED') {
    // Player disconnected during game
    if (currentView.value === 'game' && gameBoardRef.value && gameBoardRef.value.handlePlayerDisconnected) {
      gameBoardRef.value.handlePlayerDisconnected(event.data.playerId)
    }
    return
  }
  
  if (event.data.type === 'PLAYER_LEFT_GAME') {
    // Player voluntarily left the game (clicked Leave Game button)
    console.log('Player left game:', event.data.playerId)
    if (currentView.value === 'game' && gameBoardRef.value && gameBoardRef.value.handlePlayerDisconnected) {
      gameBoardRef.value.handlePlayerDisconnected(event.data.playerId)
    }
    return
  }
  
  // Handle game actions if we're in game mode
  if (currentView.value === 'game' && event.data.type === 'GAME_ACTION') {
    // Forward to GameBoard component using ref
    if (gameBoardRef.value && gameBoardRef.value.handleGameAction) {
      gameBoardRef.value.handleGameAction(event.data.action)
    }
  }
  
  // Handle other game messages through our composable
  handleGameMessage(event.peerId, event.data)
}

const onGameStarted = (data) => {
  console.log('Game started:', data)
  gameData.value = data
  currentView.value = 'game'
}

const onLeaveGame = () => {
  console.log('Player leaving game')
  
  // If host is leaving, end game for everyone
  if (connectionManager.value?.state?.isHost && connectionManager.value.endGameAndDisconnectAll) {
    // Set disconnecting flag immediately for host too
    isDisconnecting.value = true
    
    connectionManager.value.endGameAndDisconnectAll()
    
    // Reset to lobby for host
    currentView.value = 'lobby'
    gameData.value = null
    
    // Reset game state in connection manager
    if (connectionManager.value && connectionManager.value.resetGameState) {
      connectionManager.value.resetGameState()
    }
    
    // Reset disconnecting flag after a brief delay
    setTimeout(() => {
      isDisconnecting.value = false
    }, 200)
  } else {
    // Non-host player leaving - notify other players and disconnect completely
    console.log('Non-host player leaving game - disconnecting completely')
    
    // Notify other players that this player is leaving the game
    if (connectionManager.value && connectionManager.value.broadcast) {
      connectionManager.value.broadcast({
        type: 'PLAYER_LEFT_GAME',
        playerId: connectionManager.value.state.peerId,
        timestamp: Date.now()
      })
    }
    
    // Disconnect completely and return to connection screen
    if (connectionManager.value && connectionManager.value.disconnect) {
      connectionManager.value.disconnect()
    }
    
    // Reset to lobby view (which will show the connection screen since player is disconnected)
    currentView.value = 'lobby'
    gameData.value = null
  }
}

const onHostDisconnectedDuringGame = () => {
  console.log('Host disconnected during game - disconnecting completely')
  
  // Set disconnecting flag immediately to prevent lobby flash
  isDisconnecting.value = true
  
  // Host disconnected unexpectedly - disconnect completely
  if (connectionManager.value && connectionManager.value.disconnect) {
    connectionManager.value.disconnect()
  }
  
  // Return to lobby view (which will show connection screen since we're disconnected)
  currentView.value = 'lobby'
  gameData.value = null
  
  // Reset disconnecting flag after a brief delay
  setTimeout(() => {
    isDisconnecting.value = false
  }, 200)
}

const onGameEnded = () => {
  console.log('Game ended - returning to lobby')
  currentView.value = 'lobby'
  gameData.value = null
  
  // Reset game state in connection manager
  if (connectionManager.value && connectionManager.value.resetGameState) {
    connectionManager.value.resetGameState()
  }
}

const onConnectionError = (error) => {
  console.error('Connection error:', error)
}

onMounted(() => {
  console.log('Pig Game App mounted')
})
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex justify-start lg:w-0 lg:flex-1">
            <h1 class="text-2xl font-bold text-gray-900">🐷 Pig Dice</h1>
          </div>
          <nav class="">
            <div class="text-sm text-gray-500 italic">
              A Game Of Greed
            </div>
          </nav>
        </div>
      </div>
    </header>

    <main class="py-5 sm:py-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <!-- ConnectionManager - always rendered to maintain peer connections -->
        <div class="max-w-5xl mx-auto">
          <ConnectionManager 
            ref="connectionManager"
            :player-name="'Player 1'"
            :style="{ 
              display: currentView === 'game' ? 'none' : 'block',
              visibility: isDisconnecting ? 'hidden' : 'visible'
            }"
            @peer-ready="onPeerReady"
            @peer-connected="onPeerConnected" 
            @peer-disconnected="onPeerDisconnected"
            @data-received="onDataReceived"
            @connection-error="onConnectionError"
            @game-started="onGameStarted"
            @host-disconnected-during-game="onHostDisconnectedDuringGame"
          />
        </div>
        
        <!-- Disconnecting State -->
        <div v-if="isDisconnecting" class="max-w-md mx-auto mt-8">
          <div class="bg-white rounded-lg shadow-md p-8 text-center">
            <div class="text-4xl mb-4">🔄</div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Disconnecting...</h3>
            <p class="text-gray-600">Returning to connection screen</p>
          </div>
        </div>
        
        <!-- Lobby View -->
        <div v-else-if="currentView === 'lobby'" class="max-w-5xl mx-auto">
          
          <!-- Game Rules Card -->
          <div class="mt-8">
            <GameRules />
          </div>
          
        </div>

        <!-- Game View -->
        <div v-else-if="currentView === 'game'" class="max-w-5xl mx-auto">
          <GameBoard 
            ref="gameBoardRef"
            :connection-manager="connectionManager"
            :player-name="'Player 1'"
            :is-host="connectionManager?.state?.isHost || false"
            :game-data="gameData"
            @leave-game="onLeaveGame"
            @game-ended="onGameEnded"
          />
        </div>
        
      </div>
    </main>
  </div>
</template>
