# Battleship
![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)
![release](https://img.shields.io/badge/release-1.0.0-orange)

> Note:
I plan to add an online function soon, so some buttons have no use as of yet. I'm using this project as a learning experience, so I will not be accepting any pull requests until I finish the online section. I want to be able to do this on my own, so please bear with me until that part is complete. There are more features I plan to add, like being able to place your own ships, but I want to make sure the online is done first as I want to get familiar with writing server-side code.

**Battleship** is a 2-player board game where each player gets their own ships to place on their ocean grid. They're five different types of ships, each taking up a different amount of space on the grid. Each player takes shots at each other's ships without knowing the location of their opponent's ships. If all the parts of a ship are hit, the ship sinks. The object of the game is to sink all of your opponent's ships before they sink yours. You can customize your game by increasing the size of the grids and the number of ships each player has. You can also view game statistics, including wins, losses, win rate, and accuracy.

**User interfaces**
1. Here, we can see the game statistics on the left panel, the game in the center panel, and the controls on the right panel.
![Image of Battleship start page](https://i.imgur.com/bbkCotq.png)
2. To get started, press the 'New Game' button. Your ships will be placed randomly on the bottom, and you can then fire at your opponent by clicking on a cell on the enemy's grid.
![Image of Battleship new game](https://i.imgur.com/iQjHOCz.png)
3. Both players take turns until one of them destroys all of their opponent's ships.
![Image of Battleship shoot](https://i.imgur.com/uFeTxlB.png)
4. A notification is sent to the player when a ship is destroyed, or when the game is over.
![Image of Battleship notification](https://i.imgur.com/Xk7vlGl.png)
5. In the settings, you can increase the grid size and the number of ships. The grid size ranges from 10x10 to 15x15, and the number of ships per ship type range from 1 to 3.
![Image of Battleship settings](https://i.imgur.com/BuPMTX1.png)
6. If a player wishes to end the game early, they can click the 'Surrender' button.
![Image of Battleship settings aplied](https://i.imgur.com/UoFOoD2.png)

## Contact for questions

Devin Vella – devinvella@gmail.com

Distributed under the GNU General Public License version 3. See ``LICENSE`` for more information.

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -m 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
