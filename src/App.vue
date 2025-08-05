<script setup>
import { ref, onMounted } from 'vue'
import ConnectionManager from './components/ConnectionManager.vue'
import GameBoard from './components/GameBoard.vue'
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
    // Host left during game - return to lobby
    console.log('Host left game, returning to lobby')
    currentView.value = 'lobby'
    gameData.value = null
    if (connectionManager.value && connectionManager.value.resetGameState) {
      connectionManager.value.resetGameState()
    }
    return
  }
  
  if (event.data.type === 'PLAYER_DISCONNECTED') {
    // Player disconnected during game
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
    connectionManager.value.endGameAndDisconnectAll()
  }
  
  currentView.value = 'lobby'
  gameData.value = null
  
  // Reset game state in connection manager
  if (connectionManager.value && connectionManager.value.resetGameState) {
    connectionManager.value.resetGameState()
  }
}

const onHostDisconnectedDuringGame = () => {
  console.log('Host disconnected during game')
  
  // If we're in game, let GameBoard handle it gracefully
  if (currentView.value === 'game' && gameBoardRef.value && gameBoardRef.value.handleHostDisconnected) {
    gameBoardRef.value.handleHostDisconnected()
  } else {
    // Otherwise just return to lobby immediately
    currentView.value = 'lobby'
    gameData.value = null
  }
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
            <h1 class="text-2xl font-bold text-gray-900">🎲 Pig Game</h1>
          </div>
          <nav class="hidden md:flex space-x-10">
            <div class="text-sm text-gray-500">
              Multiplayer Dice Game
            </div>
          </nav>
        </div>
      </div>
    </header>

    <main class="py-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <!-- ConnectionManager - always rendered -->
        <ConnectionManager 
          ref="connectionManager"
          :player-name="'Player 1'"
          :style="{ display: currentView === 'game' ? 'none' : 'block' }"
          @peer-ready="onPeerReady"
          @peer-connected="onPeerConnected" 
          @peer-disconnected="onPeerDisconnected"
          @data-received="onDataReceived"
          @connection-error="onConnectionError"
          @game-started="onGameStarted"
          @host-disconnected-during-game="onHostDisconnectedDuringGame"
        />
        
        <!-- Lobby View -->
        <div v-if="currentView === 'lobby'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Left Column - Space for Connection Manager (rendered above) -->
          <div class="space-y-6">
            <!-- Connection Manager area - rendered above with absolute positioning -->
          </div>

          <!-- Game Area -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Pig Game</h3>
            
            <div class="text-center py-8">
              <div class="text-6xl mb-4">🎲</div>
              <h4 class="text-xl font-semibold text-gray-800 mb-2">Ready to Play!</h4>
              <p class="text-gray-600 mb-6">
                Connect with other players to start a multiplayer Pig Game session.
              </p>
            </div>
            
            <div class="space-y-4">
              <div class="p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 class="text-sm font-semibold text-blue-900 mb-2">How to Play:</h4>
                <ul class="text-sm text-blue-800 space-y-1">
                  <li>• Roll the dice to accumulate points</li>
                  <li>• First player to reach 100 points wins</li>
                  <li>• Rolling a 1 loses your turn and current points</li>
                  <li>• You can "hold" to bank your points</li>
                </ul>
              </div>
              
              <div class="p-4 bg-green-50 border border-green-200 rounded">
                <h4 class="text-sm font-semibold text-green-900 mb-2">Connection Status:</h4>
                <p class="text-sm text-green-800">
                  Use the Connection Manager to connect with other players and start your game!
                </p>
              </div>
            </div>
          </div>
          
        </div>

        <!-- Game View -->
        <div v-else-if="currentView === 'game'" class="max-w-4xl mx-auto">
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
