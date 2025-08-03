# 🎹 Classic Piano

Classic Piano is a beautiful, minimalist virtual piano you can play right in your browser. Enjoy realistic piano sounds, intuitive keyboard controls, and a curated set of popular rhythms to inspire your musical creativity!

---

## Features

- **Professional Piano Sound**: Play 13 notes (C4–C5) mapped to your keyboard or mouse.
- **Minimalist Design**: Elegant, responsive interface for desktop and mobile.
- **Popular Rhythms**: Try 5 scrollable rhythm patterns with one click.
- **Instant Play**: No login, no setup—just open and play!
- **Dockerized**: Easy to run locally with Docker or Docker Compose.

---

## Keyboard Controls

| Key | Note  |
|-----|-------|
|  A  |  C4   |
|  W  |  Db4  |
|  S  |  D4   |
|  E  |  Eb4  |
|  D  |  E4   |
|  F  |  F4   |
|  T  |  Gb4  |
|  G  |  G4   |
|  Y  |  Ab4  |
|  H  |  A4   |
|  U  |  Bb4  |
|  J  |  B4   |
|  K  |  C5   |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/classic-bloody-piano.git
cd classic-bloody-piano
```

### 2. Run with Docker Compose (Recommended)

```bash
docker compose up --build
```

- The app will be available at [http://localhost:8080](http://localhost:8080)

### 3. Manual Run (Without Docker)

Just open `index.html` in your browser.  
**Note:** For sound to work, you must serve files via a local server (e.g. [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code).

---

## Project Structure

```
classic-bloody-piano/
├── sounds/           # Piano note .mp3 files (C4, Db4, ..., C5)
├── index.html        # Main HTML file
├── style.css         # Minimalist styles
├── script.js         # Piano logic
├── nginx.conf        # Nginx config for Docker
├── Dockerfile        # Docker build file
├── docker-compose.yml# Docker Compose config
└── README.md         # This documentation
```

---

## Customization

- **Add More Notes**: Place additional `.mp3` files in the `sounds/` folder and update the key mapping in `script.js`.
- **Change Rhythms**: Edit the rhythm section in `index.html` to add your own patterns.

---

## Credits

- Sound samples: [Your Source or Attribution]
- Design & Code: [Your Name or Team]

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Feedback & Contributions

Pull requests and issues are welcome!  
Share your ideas, report bugs, or suggest new features.

---

> **Classic Piano** – Where inspiration meets simplicity.  
> Play, create, and enjoy music anywhere, anytime.