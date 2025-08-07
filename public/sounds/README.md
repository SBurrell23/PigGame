# Game Sounds Directory

This directory contains all sound effects for the Pig Game.

## Sound Files Structure

### Game Actions
- `dice-roll.mp3` - Sound when dice starts rolling
- `dice-stop.mp3` - Sound when dice stops
- `coin-bank.mp3` - Sound when banking points
- `pig-out.mp3` - Sound when rolling a 1 (pig out)

### Game Events
- `game-start.mp3` - Sound when game begins
- `game-win.mp3` - Sound when someone wins
- `turn-change.mp3` - Sound when turn changes to next player

### UI Sounds
- `button-click.mp3` - Generic button click sound
- `notification.mp3` - General notification sound
- `error.mp3` - Error notification sound
- `success.mp3` - Success notification sound

### Connection Sounds
- `player-join.mp3` - Sound when player joins lobby
- `player-leave.mp3` - Sound when player leaves
- `connection-lost.mp3` - Sound when connection is lost

### Test Sound
- `test-beep.mp3` - Test sound for volume adjustment

## Audio Format Requirements

- Format: MP3 (widely supported)
- Quality: 44.1kHz, 16-bit minimum
- Duration: Keep sounds short (under 2 seconds for UI sounds)
- Volume: Normalize all sounds to consistent levels

## Adding New Sounds

1. Add the audio file to this directory
2. Update the `soundLibrary` object in `SoundController.vue`
3. The sound will be automatically loaded on app startup

## Usage in Components

```javascript
// Play a sound
this.$soundController.playSound('diceRoll')

// Play with options
this.$soundController.playSound('gameWin', { 
  volume: 0.8, 
  playbackRate: 1.2 
})

// Check if sound is loaded
if (this.$soundController.isLoaded('coinBank')) {
  this.$soundController.playSound('coinBank')
}
```
