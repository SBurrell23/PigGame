<script setup>
import { ref, onMounted } from 'vue'
import ConnectionManager from './components/ConnectionManager.vue'
import GameBoard from './components/GameBoard.vue'
import GameRules from './components/GameRules.vue'
import GameSetupDropdown from './components/GameSetupDropdown.vue'
import SoundController from './components/SoundController.vue'
import DarkModeController from './components/DarkModeController.vue'
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
const soundController = ref(null)
const darkModeController = ref(null)
const currentView = ref('lobby') // 'lobby' or 'game'
const gameData = ref(null)
const isDisconnecting = ref(false) // Flag to prevent lobby flash during disconnection
const isGameOver = ref(false) // Tracks in-game over state to unlock setup for host
const lobbySettings = ref({ pointsToWin: 100, finalChance: false, dieSize: 6 })

// Sound controller methods
const onSoundControllerReady = (controller) => {
  console.log('🎵 Sound controller ready with', controller.getLoadedSounds().length, 'sounds')
  
  // Make sound controller globally available
  if (typeof window !== 'undefined') {
    window.$soundController = controller
  }
  
  // Store reference for easy access in this component
  soundController.value = controller
}

// Dark mode controller methods
const onDarkModeReady = (controller) => {
  console.log('🌙 Dark mode controller ready')
  darkModeController.value = controller
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

// Connection event handlers
const onPeerReady = (event) => {
  console.log('Peer ready:', event)
  // Set the connection manager in our game composable
  setConnectionManager(connectionManager.value)
}

const onPeerConnected = (event) => {
  console.log('Peer connected:', event)
  // Sound will be handled by broadcast system for all players
}

const onPeerDisconnected = (event) => {
  console.log('Peer disconnected:', event)
  // Sound will be handled by broadcast system for all players
  
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
    
    // Play leave sound since we're being disconnected due to host leaving
    playGameSound('playerLeave')
    
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
    // Also flip game-over flag when end is observed over the wire
    if (event.data.action?.type === 'GAME_END') {
      isGameOver.value = true
    }
  }
  
  // Handle other game messages through our composable
  handleGameMessage(event.peerId, event.data)
}

const onGameStarted = (data) => {
  console.log('Game started:', data)
  gameData.value = data
  currentView.value = 'game'
  isGameOver.value = false
  // Lock setup during play
  // (The Game Setup dropdown under GameBoard uses isGameOver to control locking)
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
  isGameOver.value = false
  
  // Reset game state in connection manager
  if (connectionManager.value && connectionManager.value.resetGameState) {
    connectionManager.value.resetGameState()
  }
}

const onConnectionError = (error) => {
  console.error('Connection error:', error)
}

const onPlayerJoinedSound = (event) => {
  console.log('Player joined sound:', event)
  playGameSound('playerJoin')
}

const onPlayerLeftSound = (event) => {
  console.log('Player left sound:', event)
  playGameSound('playerLeave')
}

const onButtonClickSound = () => {
  console.log('Button click sound')
  playGameSound('buttonClick')
}

const onGameOver = () => {
  isGameOver.value = true
}

const onGameActive = () => {
  isGameOver.value = false
}

// Forward settings changes from dropdown to ConnectionManager
const onLobbySettingsChanged = (settings) => {
  try {
    // Only allow host to apply changes; component already disables for non-host
    if (connectionManager.value?.applyLobbySettingsUpdate) {
      connectionManager.value.applyLobbySettingsUpdate(settings)
    }
    // Update local reactive copy immediately for UI responsiveness
    lobbySettings.value = { ...lobbySettings.value, ...settings }
  } catch (e) {
    console.warn('Failed to apply lobby settings:', e)
  }
}
// Keep local lobbySettings synced with ConnectionManager
const onLobbySettingsUpdated = (settings) => {
  lobbySettings.value = { ...lobbySettings.value, ...settings }
}

onMounted(() => {
  console.log('Pig Game App mounted')
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
    <header class="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-300">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex justify-start lg:w-0 lg:flex-1">
            <div class="flex items-baseline space-x-3">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">🐷 Pig Dice</h1>
              <div class="hidden sm:block text-sm text-gray-500 dark:text-gray-400 italic">
                &nbsp;A Game Of Greed
              </div>
            </div>
          </div>
          <nav class="flex items-center space-x-4">
            <!-- Theme Controls -->
            <div class="flex items-center space-x-2">
              <!-- Dark Mode Controller -->
              <DarkModeController 
                ref="darkModeController"
                @dark-mode-ready="onDarkModeReady"
              />
              <!-- Sound Controller -->
              <SoundController 
                ref="soundController"
                @sound-controller-ready="onSoundControllerReady"
              />
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
            @player-joined-sound="onPlayerJoinedSound"
            @player-left-sound="onPlayerLeftSound"
            @button-click-sound="onButtonClickSound"
            @lobby-settings-updated="onLobbySettingsUpdated"
          />
        </div>
        
        <!-- Disconnecting State -->
        <div v-if="isDisconnecting" class="max-w-md mx-auto mt-8">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center transition-colors duration-300">
            <div class="text-4xl mb-4">🔄</div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Disconnecting...</h3>
            <p class="text-gray-600 dark:text-gray-300 transition-colors duration-300">Returning to connection screen</p>
          </div>
        </div>
        
        <!-- Lobby View -->
        <div v-else-if="currentView === 'lobby'" class="max-w-5xl mx-auto">
          
          <!-- Game Setup Dropdown (host-controlled, visible to all) -->
          <div class="mt-8">
            <GameSetupDropdown
              v-if="connectionManager"
              :settings="lobbySettings"
              :is-host="connectionManager?.state?.isHost || false"
              :locked="false"
              :auto-open="true"
              @settings-changed="onLobbySettingsChanged"
            />
          </div>

          <!-- Game Rules Card -->
          <div class="mt-8 mb-10 sm:mb-0">
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
            :next-settings="lobbySettings"
            @leave-game="onLeaveGame"
            @game-ended="onGameEnded"
            @game-over="onGameOver"
            @game-active="onGameActive"
          />
          <!-- Game Setup Dropdown (visible during game but locked) -->
          <div class="mt-8">
            <GameSetupDropdown
              v-if="connectionManager"
              :settings="lobbySettings"
              :is-host="connectionManager?.state?.isHost || false"
              :locked="!(connectionManager?.state?.isHost && isGameOver)"
              :auto-open="isGameOver"
              @settings-changed="onLobbySettingsChanged"
            />
          </div>
          <!-- Game Rules Card -->
          <div class="mt-8 mb-10 sm:mb-0">
            <GameRules />
          </div>
        </div>
        
      </div>
    </main>
  </div>
</template>
