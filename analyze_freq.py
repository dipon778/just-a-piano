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
        'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13,
        'E4': 329.63, 'F4': 349.23, 'Gb4': 369.99, 'G4': 392.00,
        'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88,
        'C5': 523.25
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