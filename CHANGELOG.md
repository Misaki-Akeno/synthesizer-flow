# Changelog

## 0.6.2 (2025-04-14)

## UI Improvements

### New Components

- Added modular UI components for better code organization:
  - `ModuleEnableToggle`: Component for toggling module enabled/disabled state
  - `ModulePorts`: Reusable components for input and output ports
  - `ParameterControls`: Standardized parameter control components with tooltips

### Parameter Interface Enhancements

- Replaced the "advanced parameters" drawer with Radix UI Accordion groups
- Added tooltips to parameter labels for better documentation
- Improved parameter organization with logical grouping
- Added human-readable labels and descriptions to module parameters

## Core Architecture Updates

- Updated `ModuleBase` parameter metadata to support:
  - Parameter hiding (`hide: true`)
  - Parameter grouping (`group: "Group Name"`)
  - Parameter descriptions (`describe: "Description text"`)
  - Custom display labels (`label: "Display Name"`)
- Added URL-based preset loading via query parameters
  - Enhanced `page.tsx` to support URL query parameters (`?preset=presetId`)
  - Added `initialPresetId` prop to `Canvas.tsx` component
  - Updated `PresetLoader.tsx` to prioritize URL-specified presets
  - Maintained backward compatibility with default preset loading
  - Examples:
    - `/` loads default preset
    - `/?preset=major-chord` loads the major chord preset
    - `/?preset=midi-input-test` loads MIDI controller test preset

## Module Improvements

- Enhanced `AdvancedOscillatorModule` with comprehensive envelope controls
- Made `MIDIInputModule` client-side safe with proper browser detection
- Improved parameter organization across all modules

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
