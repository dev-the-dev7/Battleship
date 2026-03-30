# Online Battleship Web Application
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A multiplayer Battleship game playable in the browser. You can play solo against a CPU opponent or host an online game for up to 4 players. No accounts, no installs — just share a room code and you're in.

![Gameplay](assets/gameplay.gif)

---

## Features

**Local vs CPU**
- Place your ships manually via drag-and-drop, or hit the random button to let the game place them for you
- Rotate ships before placing with the rotate button
- Three AI difficulty levels: easy (pure random shots), medium (hunts after a hit), and hard (uses probability to target the most likely ship locations)
- Up to 4 players total (1 to 3 CPU opponents)

**Online Multiplayer**
- Host a game and share the 6-character room code with friends
- 2 to 4 players per room, with CPU slots filling any empty spots
- If a player disconnects mid-game, a CPU automatically takes over their slot so the game keeps going
- Dropped out? Rejoin the same room and pick up where you left off
- The host can kick players from the waiting room and controls game settings

**Customisation**
- Grid size: 10×10 up to 15×15
- Choose how many of each ship type to include (carriers, battleships, cruisers, submarines, destroyers)
- First-turn setting: random, winner goes first, or loser goes first
- CPU difficulty applies to all bots in the game

**Profiles**
- Set your display name and pick a colour before joining
- Upload a profile picture — the game will let you crop it to a circle
- Your profile is saved locally so it carries over between sessions

**Stats**
- Tracks shots fired, hits, accuracy, wins, and losses for the current session

---

## Built With

- Vanilla JavaScript
- Node.js + Express
- WebSockets (ws)
- HTML / CSS

---

## Getting Started

You'll need [Node.js](https://nodejs.org) installed.

```bash
# Clone the repo
git clone https://github.com/dev-the-dev7/battleship.git
cd battleship

# Install server dependencies
cd server
npm install

# Start the server
node server.js
```

Then open your browser and go to `http://localhost:3000`.

That's it — the server serves the frontend too, so there's no separate build step or dev server needed.

---

## How to Play

**Local game:**
1. Click **New Game** to start
2. Drag ships from the sidebar onto your grid, or click **Random** to place them automatically
3. Click **Confirm** when you're happy with your placement
4. Click any cell on the enemy grid to fire — you and the CPU take turns until one side is sunk
5. Use the **Settings** button to change the grid size, ship counts, or difficulty before starting a new game

**Online game:**
1. Set your name and colour on the lobby screen
2. Click **Host** to create a room, or enter a room code and click **Join**
3. Once everyone is in the waiting room, the host clicks **Start Game**
4. All players are taken to the game screen where they place their ships independently
5. Once everyone confirms, the game begins — the server handles turn order and validates all shots

---

## Room Codes

Room codes are 6 characters (e.g. `X4KN2P`). Share it however you like — chat, Discord, whatever. Codes are case-insensitive. Rooms close automatically a couple of minutes after a game ends if fewer than two humans are still connected.

---

## Contact

Devin Vella — devin.vella.career@outlook.com

Distributed under the MIT License. See `LICENSE` for details.
