# PeerJS Connection Manager

A Vue 3 component and composable for handling peer-to-peer connections using PeerJS.

## Features

- 🔌 **Easy P2P Connections** - Simple peer-to-peer networking
- 🎮 **Game-Ready** - Built for multiplayer game scenarios  
- 📡 **Real-time Communication** - Instant data exchange between peers
- 🏠 **Host/Client Model** - Support for dedicated host scenarios
- 🔄 **Connection Management** - Automatic reconnection and error handling
- 📊 **State Management** - Reactive connection and game state
- 🎨 **UI Component** - Ready-to-use connection interface

## Quick Start

### 1. Basic Connection Manager

```vue
<template>
  <ConnectionManager 
    ref="connectionManager"
    :player-name="'Player 1'"
    @peer-ready="onPeerReady"
    @peer-connected="onPeerConnected" 
    @data-received="onDataReceived"
  />
</template>

<script setup>
import { ref } from 'vue'
import ConnectionManager from '@/components/ConnectionManager.vue'

const connectionManager = ref(null)

const onPeerReady = (event) => {
  console.log('My peer ID:', event.peerId)
  console.log('Am I host?', event.isHost)
}

const onPeerConnected = (event) => {
  console.log('Connected to:', event.peerId)
}

const onDataReceived = (event) => {
  console.log('Data from', event.peerId, ':', event.data)
}
</script>
```

### 2. Using the Game Composable

```javascript
import { useGameConnection } from '@/composables/useGameConnection.js'

const { 
  setConnectionManager,
  createGame, 
  joinGame,
  sendGameMessage,
  MESSAGE_TYPES 
} = useGameConnection()

// Create a game as host
const gameId = createGame('my-game-123', 'Player 1')

// Join a game as client
joinGame('my-game-123', 'Player 2')

// Send game messages
sendGameMessage(MESSAGE_TYPES.PLAYER_ACTION, {
  action: 'roll_dice',
  value: 6
})
```

## API Reference

### ConnectionManager Component

#### Props
- `gameId` (String) - Optional custom peer ID for hosting
- `playerName` (String) - Display name for the player

#### Events
- `peer-ready` - Fired when peer is initialized
- `peer-connected` - Fired when a peer connects
- `peer-disconnected` - Fired when a peer disconnects  
- `data-received` - Fired when data is received
- `connection-error` - Fired on connection errors

#### Methods (via ref)
- `connectToPeer(peerId)` - Connect to another peer
- `sendToPeer(peerId, data)` - Send data to specific peer
- `broadcast(data)` - Send data to all connected peers
- `disconnect()` - Disconnect from all peers
- `getConnectionInfo()` - Get current connection status

### Game Connection Composable

#### Game Lifecycle
```javascript
// Host creates game
const gameId = createGame('game-123', 'Host Name')

// Players join
joinGame('game-123', 'Player Name')

// Start game (host only)
startGame({ initialScore: 0 })

// End game
endGame({ winner: 'player1' })
```

#### Message Types
- `PLAYER_JOIN` - Player joining the game
- `PLAYER_LEAVE` - Player leaving the game
- `GAME_START` - Game starting
- `GAME_STATE` - Game state updates
- `PLAYER_ACTION` - Player actions (moves, etc.)
- `GAME_END` - Game ending
- `CHAT_MESSAGE` - Chat messages

## Connection Setup

### Using Public PeerJS Server (Default)

The component uses the public PeerJS server by default, which requires no setup.

### Local PeerJS Server (Optional for Development)

If you want to run your own PeerJS server:

1. Install PeerJS server:
```bash
npm install -g peer
```

2. Start local server:
```bash
peerjs --port 9000 --path /myapp
```

3. Update the component to use local server:
```javascript
// In ConnectionManager.vue, update the Peer configuration:
state.peer = new Peer(peerId, {
  host: 'localhost',
  port: 9000,
  path: '/myapp',
  secure: false
})
```

## Example: Simple Game Implementation

```vue
<template>
  <div>
    <ConnectionManager 
      ref="connectionManager"
      @peer-ready="onPeerReady"
      @data-received="onDataReceived"
    />
    
    <div v-if="gameState.isGameStarted">
      <h2>Game in Progress</h2>
      <button @click="rollDice">Roll Dice</button>
      <p>Current player: {{ currentPlayer }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ConnectionManager from '@/components/ConnectionManager.vue'
import { useGameConnection } from '@/composables/useGameConnection.js'

const connectionManager = ref(null)
const { 
  setConnectionManager, 
  gameState, 
  sendGameMessage, 
  MESSAGE_TYPES 
} = useGameConnection()

const onPeerReady = (event) => {
  setConnectionManager(connectionManager.value)
}

const onDataReceived = (event) => {
  handleGameMessage(event.peerId, event.data)
}

const rollDice = () => {
  const diceValue = Math.floor(Math.random() * 6) + 1
  
  sendGameMessage(MESSAGE_TYPES.PLAYER_ACTION, {
    action: 'dice_roll',
    value: diceValue,
    playerId: connectionManager.value.state.peerId
  })
}
</script>
```

## Troubleshooting

### Connection Issues
- Ensure PeerJS server is running (if using local server)
- Check firewall settings
- Verify both peers are on the same network (for local development)

### WebRTC Issues
- Some corporate networks block WebRTC
- HTTPS is required for production deployment
- STUN/TURN servers may be needed for NAT traversal

## Production Deployment

For production, consider:
- Setting up your own PeerJS server
- Using HTTPS for security
- Implementing TURN servers for better connectivity
- Adding connection recovery mechanisms
