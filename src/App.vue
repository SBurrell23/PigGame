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
}

const onDataReceived = (event) => {
  console.log('Data received:', event)
  
  // Handle game actions if we're in game mode
  if (currentView.value === 'game' && event.data.type === 'GAME_ACTION') {
    // Forward to GameBoard component
    const gameBoard = document.querySelector('.game-board')
    if (gameBoard && gameBoard.__vueParentComponent) {
      gameBoard.__vueParentComponent.exposed.handleGameAction(event.data.action)
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
  currentView.value = 'lobby'
  gameData.value = null
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
        
        <!-- Lobby View -->
        <div v-if="currentView === 'lobby'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Connection Manager -->
          <div class="space-y-6">
            <ConnectionManager 
              ref="connectionManager"
              :player-name="'Player 1'"
              @peer-ready="onPeerReady"
              @peer-connected="onPeerConnected" 
              @peer-disconnected="onPeerDisconnected"
              @data-received="onDataReceived"
              @connection-error="onConnectionError"
              @game-started="onGameStarted"
            />
            
            <!-- Game State Display -->
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Game State</h3>
              
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm font-medium text-gray-700">Game ID:</span>
                  <span class="text-sm text-gray-600">
                    {{ gameState.gameId || 'Not in game' }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-sm font-medium text-gray-700">Players:</span>
                  <span class="text-sm text-gray-600">
                    {{ gameState.players.size }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-sm font-medium text-gray-700">Game Started:</span>
                  <span class="text-sm text-gray-600">
                    {{ gameState.isGameStarted ? 'Yes' : 'No' }}
                  </span>
                </div>
                
                <div v-if="gameState.players.size > 0" class="mt-4">
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Connected Players:</h4>
                  <div class="space-y-1">
                    <div 
                      v-for="[playerId, player] in gameState.players"
                      :key="playerId"
                      class="flex items-center justify-between text-xs bg-gray-50 p-2 rounded"
                    >
                      <span class="font-medium">{{ player.name }}</span>
                      <span v-if="player.isHost" class="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        Host
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            :connection-manager="connectionManager"
            :player-name="'Player 1'"
            :is-host="connectionManager?.state?.isHost || false"
            @leave-game="onLeaveGame"
          />
        </div>
        
      </div>
    </main>
  </div>
</template>
