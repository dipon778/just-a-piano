import librosa
import os
import numpy as np

def analyze_note(file_path):
    # Load the audio file
    y, sr = librosa.load(file_path)
    
    # Compute fundamental frequency using Librosa's pitch detection
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    
    # Get the highest magnitude pitch
    pitch_idx = magnitudes.argmax()
    pitch = pitches.flatten()[pitch_idx]
    
    return pitch

def main():
    notes_dir = 'sounds'
    expected_frequencies = {
        # Standard A440 tuning frequencies
        'E4': 329.63,   # Key: D
        'Eb4': 311.13,  # Key: E (black key)
        'E4': 329.63,   # Key: D
        'Eb4': 311.13,  # Key: E
        'E4': 329.63,   # Key: D
        'B3': 246.94,   # Key: S
        'D4': 293.66,   # Key: S
        'C4': 261.63,   # Key: A
        'A3': 220.00,   # Key: Z (need to add this key binding)
        # ...existing frequencies...
    }
    
    for file in sorted(os.listdir(notes_dir)):
        if file.endswith('.mp3'):
            note_name = file[:-4]  # Remove .mp3
            file_path = os.path.join(notes_dir, file)
            
            # Get actual frequency
            freq = analyze_note(file_path)
            
            # Print results
            print(f"\n=== {note_name} ===")
            print(f"Measured frequency: {freq:.2f} Hz")
            if note_name in expected_frequencies:
                expected = expected_frequencies[note_name]
                diff = freq - expected
                print(f"Expected frequency: {expected:.2f} Hz")
                print(f"Difference: {diff:.2f} Hz")

if __name__ == "__main__":
    main()