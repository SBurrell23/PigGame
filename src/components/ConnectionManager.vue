<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import Peer from 'peerjs'
import GameSetup from './GameSetup.vue'

// Props
const props = defineProps({
  gameId: {
    type: String,
    default: null
  },
  playerName: {
    type: String,
    default: 'Player'
  }
})

// Emits
const emit = defineEmits([
  'peer-connected',
  'peer-disconnected', 
  'data-received',
  'connection-error',
  'peer-ready',
  'game-started',
  'player-joined-sound',
  'player-left-sound',
  'button-click-sound'
])

// Reactive state
const state = reactive({
  peer: null,
  peerId: null,
  connections: new Map(),
  isHost: false,
  isConnected: false,
  error: null,
  status: 'disconnected', // disconnected, connecting, connected, error
  lobbyId: null,
  isInLobby: false
})

const connectedPeers = ref([])
const joinGameId = ref('')
const lobbyMode = ref('join') // 'join' or 'host'
const allLobbyPlayers = ref([]) // All players in lobby (including host)
const gameInProgress = ref(false) // Flag to track if game is in progress
const copyNotification = ref(false) // Flag for copy notification
const gameSettings = ref({ pointsToWin: 100, finalChance: false, dieSize: 6 }) // Lobby-configurable settings

// Handle settings change from GameSetup (host-controlled)
const onSettingsChanged = (s) => {
  emit('button-click-sound')
  gameSettings.value = { ...gameSettings.value, ...s }
  if (state.isHost) {
    broadcast({ type: 'LOBBY_SETTINGS_UPDATE', settings: { ...gameSettings.value } })
  }
}

// Utility function to copy text to clipboard
const copyToClipboard = async (text) => {
  emit('button-click-sound')
  
  try {
    await navigator.clipboard.writeText(text)
    console.log('Copied to clipboard:', text)
    
    // Show notification
    copyNotification.value = true
    
    // Hide notification after 1 second
    setTimeout(() => {
      copyNotification.value = false
    }, 1000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Generate a random game ID for hosting
const generateGameId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Get color name for player based on join order
const getPlayerColorName = (index) => {
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

// Broadcast lobby update to all connected players (host only)
const broadcastLobbyUpdate = () => {
  if (!state.isHost) return
  
  const lobbyData = {
    type: 'LOBBY_UPDATE',
    players: [
      {
        peerId: state.peerId,
        name: getPlayerColorName(0), // Host is always Green
        isHost: true
      },
      ...connectedPeers.value.map((peerId, index) => ({
        peerId,
        name: getPlayerColorName(index + 1), // Assign colors based on join order
        isHost: false
      }))
    ]
  }
  
  broadcast(lobbyData)
  
  // Update our own lobby players list
  allLobbyPlayers.value = lobbyData.players
}

// Start the game (host only)
const startGame = () => {
  if (!state.isHost) return
  
  console.log('Starting game with lobby players:', allLobbyPlayers.value)
  
  // Set game in progress flag
  gameInProgress.value = true
  
  const gameStartData = {
    type: 'GAME_START',
    players: allLobbyPlayers.value.map(player => ({
      id: player.peerId,
      peerId: player.peerId, // Keep both for compatibility
      name: player.name,
      isHost: player.isHost
  })),
  settings: { ...gameSettings.value },
    timestamp: Date.now()
  }
  
  console.log('Game start data:', gameStartData)
  
  // Broadcast to all players
  broadcast(gameStartData)
  
  // Emit event for this client
  emit('game-started', gameStartData)
}

// Host a new game lobby
const hostLobby = () => {
  emit('button-click-sound')
  
  const gameId = generateGameId()
  state.lobbyId = gameId
  state.isHost = true
  lobbyMode.value = 'host'
  initializePeer(gameId)
}

// Join an existing game lobby
const joinLobby = () => {
  if (joinGameId.value.trim()) {
    emit('button-click-sound')
    
    state.lobbyId = joinGameId.value.trim()
    state.isHost = false
    lobbyMode.value = 'join'
    initializePeer()
  }
}

// Leave the current lobby
const leaveLobby = () => {
  // Play leave sound for the person voluntarily leaving
  emit('player-left-sound', {
    peerId: state.peerId // Use own peer ID since we're the one leaving
  })
  
  disconnect()
  state.lobbyId = null
  state.isInLobby = false
  state.isHost = false
  lobbyMode.value = 'join'
  joinGameId.value = ''
}

// Handle connecting to a new peer (now used internally)
const handleConnect = () => {
  if (state.isHost) {
    // Host doesn't need to connect to anyone - players connect to host
    return
  }
  
  if (state.lobbyId) {
    try {
      connectToPeer(state.lobbyId)
    } catch (error) {
      console.error('Failed to connect to lobby:', error)
    }
  }
}

// Create a new peer instance
const initializePeer = (customId = null) => {
  try {
    state.status = 'connecting'
    
    // Use custom ID for host, or generate one for players
    const peerId = customId || undefined
    
    // Try to use public PeerJS server with fallback configuration
    state.peer = new Peer(peerId, {
      // Use public PeerJS server
      debug: 2, // Enable debug logging
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    })

    // Handle peer open event
    state.peer.on('open', (id) => {
      state.peerId = id
      state.isConnected = true
      state.status = 'connected'
      state.error = null
      
      // If we're hosting and got the lobby ID we wanted
      if (state.isHost && state.lobbyId && id === state.lobbyId) {
        console.log('Lobby created successfully:', id)
        state.isInLobby = true
        
        // Initialize host's lobby data with their color name
        allLobbyPlayers.value = [
          {
            peerId: state.peerId,
            name: getPlayerColorName(0), // Host is always Green
            isHost: true
          }
        ]
      }
      // If we're joining, try to connect to the host
      else if (!state.isHost && state.lobbyId) {
        handleConnect()
        // Only set isInLobby to true after we successfully connect to host
      }
      
      emit('peer-ready', {
        peerId: id,
        isHost: state.isHost,
        lobbyId: state.lobbyId
      })
    })

    // Handle incoming connections
    state.peer.on('connection', (conn) => {
      handleConnection(conn)
    })

    // Handle errors
    state.peer.on('error', (error) => {
      console.error('Peer error:', error)
      state.error = error.message
      state.status = 'error'
      emit('connection-error', error)
    })

    // Handle disconnection
    state.peer.on('disconnected', () => {
      state.isConnected = false
      state.status = 'disconnected'
    })

  } catch (error) {
    console.error('Failed to initialize peer:', error)
    state.error = error.message
    state.status = 'error'
    emit('connection-error', error)
  }
}

// Handle a new connection (incoming or outgoing)
const handleConnection = (conn) => {
  // Store connection
  state.connections.set(conn.peer, conn)
  
  // Setup connection event handlers
  conn.on('open', () => {
    console.log('Connection opened with:', conn.peer)
    updateConnectedPeers()
    
    // If we're a player connecting to a host, now we're officially in the lobby
    if (!state.isHost && conn.peer === state.lobbyId) {
      state.isInLobby = true
    }
    
    // If we're the host, broadcast lobby update to all players
    if (state.isHost) {
      setTimeout(() => {
        broadcastLobbyUpdate()
        // Send current lobby settings to all players (including the newly connected one)
        broadcast({
          type: 'LOBBY_SETTINGS_UPDATE',
          settings: { ...gameSettings.value }
        })
        // Broadcast player join sound to all players (including host)
        broadcast({
          type: 'PLAYER_JOIN_SOUND',
          peerId: conn.peer
        })
        // Also trigger sound locally for host
        emit('player-joined-sound', {
          peerId: conn.peer
        })
      }, 100) // Small delay to ensure connection is ready
    }
    
    emit('peer-connected', {
      peerId: conn.peer,
      connection: conn
    })
  })

  conn.on('data', (data) => {
    console.log('Data received from', conn.peer, ':', data)
    
    // Handle kick message
    if (data && data.type === 'KICKED') {
      console.log('Kicked from lobby:', data.message)
      
      // Play leave sound for the kicked player
      emit('player-left-sound', {
        peerId: state.peerId // Use own peer ID since we're the one leaving
      })
      
      // Set error message to show user they were kicked
      state.error = data.message || 'You have been removed from the lobby'
      
      // Disconnect completely - this will reset all state and close peer connection
      disconnect()
      
      // Clear error after a few seconds
      setTimeout(() => {
        state.error = null
      }, 5000)
      
      return
    }
    
    // Handle lobby update message
    if (data && data.type === 'LOBBY_UPDATE') {
      console.log('Lobby update received:', data.players)
      allLobbyPlayers.value = data.players
      return
    }
    
    // Handle lobby settings update
    if (data && data.type === 'LOBBY_SETTINGS_UPDATE') {
      console.log('Lobby settings update received:', data.settings)
      gameSettings.value = { ...gameSettings.value, ...data.settings }
      return
    }
    
    // Handle game start message
    if (data && data.type === 'GAME_START') {
      console.log('Game start received:', data.players)
      gameInProgress.value = true  // Set flag for non-host players too
      emit('game-started', data)
      return
    }
    
    // Handle player join sound message
    if (data && data.type === 'PLAYER_JOIN_SOUND') {
      emit('player-joined-sound', {
        peerId: data.peerId
      })
      return
    }
    
    // Handle player leave sound message
    if (data && data.type === 'PLAYER_LEAVE_SOUND') {
      emit('player-left-sound', {
        peerId: data.peerId
      })
      return
    }
    
    emit('data-received', {
      peerId: conn.peer,
      data: data,
      timestamp: Date.now()
    })
  })

  conn.on('close', () => {
    console.log('Connection closed with:', conn.peer)
    
    // Broadcast player leave sound if we're the host (before deleting connection)
    if (state.isHost) {
      broadcast({
        type: 'PLAYER_LEAVE_SOUND',
        peerId: conn.peer
      })
      // Also trigger sound locally for host
      emit('player-left-sound', {
        peerId: conn.peer
      })
    }
    
    state.connections.delete(conn.peer)
    updateConnectedPeers()
    
    // Handle disconnections differently based on whether game is in progress
    if (!gameInProgress.value) {
      // Lobby mode - handle lobby updates
      if (state.isHost) {
        setTimeout(() => broadcastLobbyUpdate(), 100)
      }
      
      // If we're not the host and the connection that closed was to the host (lobby ID), 
      // then the host left and we should return to home screen
      if (!state.isHost && conn.peer === state.lobbyId) {
        console.log('Host disconnected, returning to home screen')
        
        // Play leave sound since we're being disconnected due to host leaving
        emit('player-left-sound', {
          peerId: state.peerId // Use own peer ID since we're the one leaving
        })
        
        // Reset lobby state
        state.lobbyId = null
        state.isInLobby = false
        state.isHost = false
        lobbyMode.value = 'join'
        joinGameId.value = ''
        allLobbyPlayers.value = []
        
        // Show message that host left
        state.error = 'The host has left the lobby'
        
        // Clear error after a few seconds
        setTimeout(() => {
          state.error = null
        }, 5000)
      }
    } else {
      // Game mode - handle player disconnections during game
      console.log('Player disconnected during game:', conn.peer)
      
      if (state.isHost) {
        // Host handling player disconnection - notify remaining players
        broadcast({
          type: 'PLAYER_DISCONNECTED',
          playerId: conn.peer,
          timestamp: Date.now()
        })
      } else if (conn.peer === state.lobbyId) {
        // Non-host player - check if host disconnected
        console.log('Host disconnected unexpectedly - disconnecting completely')
        
        // Emit event to trigger complete disconnection
        emit('host-disconnected-during-game')
        
        // Don't reset state here - let the App.vue handler call disconnect() completely
      }
    }
    
    emit('peer-disconnected', {
      peerId: conn.peer,
      duringGame: gameInProgress.value
    })
  })

  conn.on('error', (error) => {
    console.error('Connection error with', conn.peer, ':', error)
    state.connections.delete(conn.peer)
    updateConnectedPeers()
    
    emit('connection-error', error)
  })
}

// Connect to another peer
const connectToPeer = (peerId) => {
  if (!state.peer || !state.isConnected) {
    throw new Error('Peer not initialized or not connected')
  }

  if (state.connections.has(peerId)) {
    console.warn('Already connected to peer:', peerId)
    return
  }

  try {
    const conn = state.peer.connect(peerId)
    handleConnection(conn)
    return conn
  } catch (error) {
    console.error('Failed to connect to peer:', error)
    emit('connection-error', error)
    throw error
  }
}

// Send data to a specific peer
const sendToPeer = (peerId, data) => {
  const conn = state.connections.get(peerId)
  if (conn && conn.open) {
    conn.send(data)
    return true
  }
  console.warn('No open connection to peer:', peerId)
  return false
}

// Send data to all connected peers
const broadcast = (data) => {
  let sentCount = 0
  state.connections.forEach((conn, peerId) => {
    if (conn.open) {
      conn.send(data)
      sentCount++
    }
  })
  return sentCount
}

// Disconnect from a specific peer
const disconnectFromPeer = (peerId) => {
  const conn = state.connections.get(peerId)
  if (conn) {
    // Send kick message before disconnecting
    if (conn.open) {
      conn.send({
        type: 'KICKED',
        message: 'You have been removed from the lobby by the host'
      })
    }
    
    conn.close()
    state.connections.delete(peerId)
    updateConnectedPeers()
  }
}

// Disconnect from all peers and destroy peer instance
const disconnect = () => {
  // Close all connections
  state.connections.forEach((conn) => {
    conn.close()
  })
  state.connections.clear()
  
  // Destroy peer
  if (state.peer) {
    state.peer.destroy()
    state.peer = null
  }
  
  // Reset state
  state.peerId = null
  state.isConnected = false
  state.isHost = false
  state.status = 'disconnected'
  state.error = null
  state.lobbyId = null
  state.isInLobby = false
  
  // Reset UI state
  joinGameId.value = ''
  lobbyMode.value = 'join'
  allLobbyPlayers.value = []
  gameSettings.value = { pointsToWin: 100, finalChance: false, dieSize: 6 }
  
  updateConnectedPeers()
}

// Update the reactive list of connected peers
const updateConnectedPeers = () => {
  connectedPeers.value = Array.from(state.connections.keys()).filter(peerId => {
    const conn = state.connections.get(peerId)
    return conn && conn.open
  })
}

// Get connection info
const getConnectionInfo = () => {
  return {
    peerId: state.peerId,
    isHost: state.isHost,
    isConnected: state.isConnected,
    connectedPeers: connectedPeers.value,
    status: state.status,
    error: state.error
  }
}

// Reset game state (when leaving game)
const resetGameState = () => {
  gameInProgress.value = false
  console.log('Game state reset - lobby mode resumed')
}

// End game and disconnect all players (host only)
const endGameAndDisconnectAll = () => {
  if (!state.isHost) return
  
  console.log('Host ending game and disconnecting all players')
  
  // Broadcast game end message to all players
  broadcast({
    type: 'HOST_LEFT_GAME',
    message: 'Host has left the game. Disconnecting all players.',
    timestamp: Date.now()
  })
  
  // Reset game state
  gameInProgress.value = false
  
  // Disconnect all players immediately (but give a tiny delay for message to send)
  setTimeout(() => {
    disconnect()
  }, 100) // Much shorter delay to minimize lobby flash
}

// Lifecycle hooks
onMounted(() => {
  console.log('ConnectionManager mounted - waiting for user action')
  // Don't automatically initialize peer - wait for user to host or join
})

onUnmounted(() => {
  disconnect()
})

// Expose methods to parent component
defineExpose({
  connectToPeer,
  sendToPeer,
  broadcast,
  disconnectFromPeer,
  disconnect,
  getConnectionInfo,
  startGame,
  resetGameState,
  endGameAndDisconnectAll,
  // Reactive state access
  state: state,
  connectedPeers: connectedPeers,
  allLobbyPlayers: allLobbyPlayers,
  gameSettings: gameSettings
})
</script>

<template>
  <div class="connection-manager bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-300">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        
        <!-- Status indicator -->
        <div class="flex items-center space-x-2">
          <div class="flex items-center">
            <div 
              :class="[
                'w-3 h-3 rounded-full mr-2',
                {
                  'bg-gray-400': state.status === 'disconnected',
                  'bg-yellow-400 animate-pulse': state.status === 'connecting',
                  'bg-green-400': state.status === 'connected',
                  'bg-red-400': state.status === 'error'
                }
              ]"
            ></div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize transition-colors duration-300">
              {{ state.status }}
            </span>
          </div>
          
          <div v-if="state.isHost" class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs font-medium rounded transition-colors duration-300">
            👑 Host
          </div>
          <div v-else-if="state.isInLobby" class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded transition-colors duration-300">
            🎮 Player
          </div>
        </div>
      </div>
    </div>

    <!-- Not in lobby - Choose host or join -->
    <div v-if="!state.isInLobby" class="space-y-4">
      <div class="text-center hidden sm:block">
        <h4 class="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 transition-colors duration-300">Ready to play?</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 transition-colors duration-300">Host a new game or join an existing lobby</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Host Game -->
        <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-500 transition-colors">
          <div class="text-center">
            <div class="text-3xl mb-2">👑</div>
            <h5 class="font-semibold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-300">Host Game</h5>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 transition-colors duration-300">Create a new lobby for other players to join</p>
            <button 
              @click="hostLobby"
              :disabled="state.status === 'connecting'"
              class="w-full px-4 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {{ state.status === 'connecting' ? 'Creating...' : 'Create Lobby' }}
            </button>
          </div>
        </div>

        <!-- Join Game -->
        <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
          <div class="text-center">
            <div class="text-3xl mb-2">🎮</div>
            <h5 class="font-semibold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-300">Join Game</h5>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 transition-colors duration-300">Enter a lobby code to join an existing game</p>
            <div class="space-y-2">
              <input 
                v-model="joinGameId"
                type="text" 
                placeholder="Enter Lobby Code"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
                @keyup.enter="joinLobby"
              >
              <button 
                @click="joinLobby"
                :disabled="!joinGameId.trim() || state.status === 'connecting'"
                class="w-full px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {{ state.status === 'connecting' ? 'Joining...' : 'Join Lobby' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- In lobby -->
    <div v-else class="space-y-4">
      <!-- Lobby Info -->
      <div class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 max-w-sm mx-auto transition-colors duration-300">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-md font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-300">
            {{ state.isHost ? '👑 Your Lobby' : '🎮 Joined Lobby' }}
          </h4>
          <button 
            @click="leaveLobby"
            class="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
          >
            Leave
          </button>
        </div>

        <!-- Lobby ID -->
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
            {{ state.isHost ? 'Share Lobby Code' : 'Lobby Code' }}
          </label>
          <div class="flex items-center space-x-2">
            <code class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded text-lg font-mono flex-1 text-center transition-colors duration-300">
              {{ state.lobbyId }}
            </code>
            <div class="relative">
              <button 
                @click="copyToClipboard(state.lobbyId)"
                class="px-3 py-2.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors flex items-center h-full"
              >
                📋 Copy
              </button>
              
              <!-- Copy Notification -->
              <div 
                v-if="copyNotification"
                class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap"
              >
                Copied!
                <!-- Triangle pointer -->
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Players in Lobby -->
      <div class="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-colors duration-300">
        <h4 class="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 transition-colors duration-300">
          👥 Players in Lobby ({{ state.isHost ? connectedPeers.length + 1 : allLobbyPlayers.length }})
        </h4>
        
        <div class="space-y-2">
          <!-- For hosts: show yourself + connected players -->
          <template v-if="state.isHost">
            <!-- Host player (yourself) -->
            <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border-l-4 transition-colors duration-300" :class="getColorBorderClass('Green')">
              <div class="flex items-center">
                <div class="text-lg mr-2">👑</div>
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors duration-300">
                    You (Green)
                  </div>
                </div>
              </div>
              <div class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded transition-colors duration-300">
                Host
              </div>
            </div>

            <!-- Connected players -->
            <div 
              v-for="(peerId, index) in connectedPeers" 
              :key="peerId"
              class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border-l-4 transition-colors duration-300"
              :class="getColorBorderClass(getPlayerColorName(index + 1))"
            >
              <div class="flex items-center">
                <div class="text-lg mr-2">🎮</div>
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors duration-300">
                    {{ getPlayerColorName(index + 1) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <div class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded transition-colors duration-300">
                  Connected
                </div>
                <button 
                  @click="disconnectFromPeer(peerId)"
                  class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                >
                  Kick
                </button>
              </div>
            </div>
          </template>

          <!-- For players: show all lobby players from host's broadcast -->
          <template v-else>
            <div 
              v-for="player in allLobbyPlayers" 
              :key="player.peerId"
              class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border-l-4 transition-colors duration-300"
              :class="getColorBorderClass(player.name)"
            >
              <div class="flex items-center">
                <div class="text-lg mr-2">{{ player.isHost ? '👑' : '🎮' }}</div>
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors duration-300">
                    {{ player.peerId === state.peerId ? `You (${player.name})` : player.name }}
                  </div>
                </div>
              </div>
              <div class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded transition-colors duration-300">
                {{ player.isHost ? 'Host' : 'Connected' }}
              </div>
            </div>
          </template>

          <!-- Waiting for players -->
          <div v-if="(state.isHost && connectedPeers.length === 0) || (!state.isHost && allLobbyPlayers.length <= 1)" class="text-center py-4">
            <div class="text-gray-400 text-lg mb-2">⏳</div>
            <p class="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
              {{ state.isHost ? 'Waiting for players to join...' : 'Waiting for other players...' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Game Setup Panel (visible to all, editable by host) -->
      <div class="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-colors duration-300">
        <GameSetup 
          :settings="gameSettings" 
          :is-host="state.isHost"
          @settings-changed="onSettingsChanged"
        />
      </div>

      <!-- Game Controls (if host) -->
      <div v-if="state.isHost && connectedPeers.length > 0">
        <button 
          @click="startGame"
          class="w-full px-4 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 transition-colors"
        >
          🚀 Start Game
        </button>
      </div>
    </div>

    <!-- Error display -->
    <div v-if="state.error" class="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded transition-colors duration-300">
      <p class="text-red-700 dark:text-red-200 text-sm transition-colors duration-300">
        <strong>Error:</strong> {{ state.error }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles can go here if needed */
</style>
