# Changelog

## 0.6.1 (2025-04-13)

### Features

- **Polyphonic Synthesis**: Added support for multiple simultaneous notes
  - Created new `PolyphonicOscillatorModule` for handling multiple voices
  - Enhanced `MIDIInputModule` with `activeNotes` and `activeVelocities` outputs
  - Added new `ARRAY` port type to support complex data transmission
  - Implemented voice allocation and management system (up to 16 voices)

### Improvements

- **Module System**: New port types for advanced data flows
  - Added array-type ports with purple color for complex data structures
  - Improved port type checking and validation

### Presets

- Added new "复音合成器测试" (Polyphonic Synthesizer Test) preset

## 0.6.0 (2023-11-12)

### Features

- **MIDI Support**: Added WebMIDI API integration
  - Added new MIDIInputModule for receiving data from MIDI controllers
  - Added AdvancedOscillatorModule with MIDI note and velocity inputs
  - Created MIDI controller test preset

### Improvements

- **Preset System**: Enhanced preset management
  - Added support for default preset selection
  - Added getDefaultPresetId method to PresetManager
  - Updated PresetLoader to use dynamic default preset

### UI Enhancements

- Added advanced UI options to ReverbModule parameters
- Created responsive MIDI controller connection interface

### Dependencies

- Added webmidi v3.1.12
