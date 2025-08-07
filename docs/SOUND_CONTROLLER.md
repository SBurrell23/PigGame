# SoundController Usage Guide

## Overview
The SoundController component provides a comprehensive audio system for the Pig Game with volume controls, sound management, and an intuitive UI.

## Features

### 🎵 Sound Management
- **Automatic Loading**: Loads all game sounds from `/public/sounds/` on app startup
- **Fallback System**: Creates programmatic test sounds when audio files are missing
- **Error Handling**: Gracefully handles missing or failed sound files
- **Sound Mapping**: Maps sound files to easy-to-use names

### 🔊 Volume Controls
- **Master Volume**: Adjustable slider (0-100%)
- **Mute Toggle**: Quick mute/unmute functionality
- **Visual Feedback**: Dynamic sound icon based on volume level
- **Persistent Settings**: Saves user preferences to localStorage

### 🎮 User Interface
- **Dropdown Menu**: Clean, accessible volume controls
- **Sound Icon**: Shows current volume state (🔇🔈🔉🔊)
- **Test Sound**: Built-in test button for volume adjustment
- **Loading Status**: Shows loaded sounds and any errors

## Installation & Setup

### 1. Component Integration
The SoundController is already integrated into the main App.vue header:

```vue
<template>
  <header>
    <nav>
      <SoundController @sound-controller-ready="onSoundControllerReady" />
    </nav>
  </header>
</template>
```

### 2. Sound Files
Add your MP3 files to `/public/sounds/` directory:

```
public/sounds/
├── dice-roll.mp3       # When dice starts rolling
├── dice-stop.mp3       # When dice stops
├── coin-bank.mp3       # When banking points
├── pig-out.mp3         # When rolling a 1
├── game-start.mp3      # Game begins
├── game-win.mp3        # Someone wins
├── turn-change.mp3     # Turn changes
├── button-click.mp3    # UI interactions
├── notification.mp3    # General notifications
├── success.mp3         # Success actions
├── error.mp3           # Error notifications
├── player-join.mp3     # Player joins lobby
├── player-leave.mp3    # Player leaves
└── test-beep.mp3       # Test sound
```

## Usage in Components

### Basic Sound Playing
```javascript
// Play a sound (globally available)
window.$soundController.playSound('diceRoll')

// Or in a component method
const playGameSound = (soundName, options = {}) => {
  try {
    if (window.$soundController) {
      window.$soundController.playSound(soundName, options)
    }
  } catch (error) {
    console.warn('Failed to play sound:', soundName, error)
  }
}
```

### Advanced Sound Options
```javascript
// Play with custom volume (0.0 to 1.0)
playGameSound('gameWin', { volume: 0.8 })

// Play with different speed
playGameSound('diceRoll', { playbackRate: 1.5 })

// Play looping sound
playGameSound('backgroundMusic', { loop: true })

// Combine options
playGameSound('celebration', { 
  volume: 0.9, 
  playbackRate: 1.2 
})
```

### Check Sound Availability
```javascript
// Check if a sound is loaded
if (window.$soundController.isLoaded('coinBank')) {
  window.$soundController.playSound('coinBank')
}

// Get all loaded sounds
const loadedSounds = window.$soundController.getLoadedSounds()
console.log('Available sounds:', loadedSounds)
```

### Control Volume Programmatically
```javascript
// Set master volume (0.0 to 1.0)
window.$soundController.setVolume(0.5)

// Mute all sounds
window.$soundController.mute()

// Unmute
window.$soundController.unmute()

// Toggle mute state
window.$soundController.toggleMute()
```

## Current Game Integration

The following sounds are already integrated into the game:

- **🎮 Game Start**: When a new game begins
- **🎲 Dice Roll**: When dice starts rolling
- **💰 Coin Bank**: When banking points
- **🏆 Game Win**: When someone wins the game
- **🎯 Turn Change**: When switching to next player
- **💥 Pig Out**: When rolling a 1 and losing turn

## Keyboard Shortcuts

- **Ctrl + M**: Toggle mute/unmute

## Customization

### Adding New Sounds
1. Add the MP3 file to `/public/sounds/`
2. Update the `soundLibrary` object in `SoundController.vue`:

```javascript
const soundLibrary = {
  // ... existing sounds
  newSound: 'new-sound-file.mp3'
}
```

3. Use the new sound:
```javascript
playGameSound('newSound')
```

### Modifying Default Settings
```javascript
// In SoundController.vue props
const props = defineProps({
  soundsPath: {
    type: String,
    default: '/sounds'  // Change default path
  },
  defaultVolume: {
    type: Number,
    default: 0.7        // Change default volume (0.0-1.0)
  }
})
```

## Troubleshooting

### Sounds Not Playing
1. **Check Browser Console**: Look for loading errors
2. **File Format**: Ensure files are MP3 format
3. **File Paths**: Verify files are in `/public/sounds/`
4. **Volume Settings**: Check if muted or volume is 0
5. **Browser Policy**: Some browsers require user interaction before playing audio

### Performance Tips
1. **File Size**: Keep sound files small (< 500KB each)
2. **Format**: Use MP3 for best browser compatibility
3. **Preloading**: Sounds are preloaded on app startup
4. **Memory**: Large files may cause memory issues on mobile

### Browser Compatibility
- ✅ Chrome, Firefox, Safari, Edge (modern versions)
- ⚠️ Older browsers may not support all features
- 📱 Mobile browsers have autoplay restrictions

## API Reference

### Methods
- `playSound(name, options)` - Play a sound
- `setVolume(volume)` - Set master volume (0-1)
- `mute()` - Mute all sounds
- `unmute()` - Unmute all sounds
- `toggleMute()` - Toggle mute state
- `isLoaded(name)` - Check if sound is loaded
- `getLoadedSounds()` - Get array of loaded sound names
- `reload()` - Reload all sounds

### Events
- `sound-controller-ready` - Emitted when controller is ready with loaded sounds

### Storage
- Settings are automatically saved to `localStorage`
- Key: `pigGameSoundSettings`
- Contains: `{ masterVolume, isMuted }`
