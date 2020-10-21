//Copyright © 2020 Devin Vella
/*
This file is part of Battleship.

Battleship is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Battleship is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Battleship. If not, see <https://www.gnu.org/licenses/>.
*/

let p1, p2, stats, gridx=10, gridy=10, playflag=false, online=false,
shipNum, carrierNum=1, battleNum=1, cruiserNum=1, subNum=1, destroyerNum=1;

start();

//stats object
function Stats() {
	this.wins = 0;
	this.losses = 0;
	this.winRate = 0;
	this.hits = 0;
	this.shots = 0;
	this.accuracy = 0;

	this.addWin = function() {
		++this.wins;
		const win = document.getElementById('wins');
		win.innerText = 'Wins: ' + this.wins;
		this.getwinRate();
	}

	this.addLoss = function() {
		++this.losses
		const los = document.getElementById('losses');
		los.innerText = 'Losses: ' + this.losses;
		this.getwinRate();
	}

	this.getwinRate = function() {
		const wr = document.getElementById('win-rate');
	
		this.winRate = Math.round(this.wins / (this.losses + this.wins) * 100)
		wr.innerText = 'Win Rate: ' + this.winRate + '%';
	}

	this.addHit = function() {
		++this.hits;
		this.getAccuracy();
	}

	this.addShot = function() {
		++this.shots
		this.getAccuracy();
	}

	this.getAccuracy = function() {
		const acc = document.getElementById('accuracy');

		this.accuracy = Math.round(this.hits / this.shots * 100);
		acc.innerText = 'Accuracy: ' + this.accuracy + '%';
	}
}

//player object
function Player() {
	this.shipsLeft = shipNum; //set to the number of ships for each player
	this.ships = []; //store ship objects
	this.grid = []; //cell type (0:water, 1:ship, 2:hit, 3:miss, 4:sunk), shipid

	let y,x; //grid coordinates
	//for every item in grid
	for(y=0;y<gridy;++y) {
		this.grid[y] = [];
		for(x=0;x<gridx;++x) {
			this.grid[y][x] = [0, -1]; //fill cell with water 
		}
	}
}

//ship object
function Ship(shipId, shiptype, len, align, player1) {
	this.shipId = shipId;
	this.shiptype = shiptype;
	this.len = len;
	this.align = align;
	this.placeShip = function(grid) {
		//find empty spot for Ship//
		let rangex = gridx, rangey = gridy; //range of potential x and y coordinates
		let offsetx = 0, offsety = 0; //offset x and y coordinates
		//horzontal alignment
		if(this.align == 0) {
			rangex -= len //prevent ship from going off grid
			++offsetx; //used to place ship horzontally
		}
		//vertical alignment
		else {
			rangey -= len //prevent ship from going off grid
			++offsety; //used to place ship vertically
		}
		let x, y, i;
		do {
			y = Math.floor(Math.random()*rangey); //starting y-coordinates for ship
			x = Math.floor(Math.random()*rangex); //starting x-coordinates for ship
			let tx = x, ty = y; //store x and y values temporarily
			//for the length of the ship
			for (i=0;i<len;++i) {
				//if a ship is already at the coordinates get new coordinates
				if (grid[ty][tx][0] == 1) {
					break;
				}
				//check next cell
				tx+=offsetx;
				ty+=offsety;
			}
		} while(i != len);

		//build ship//
		tx = x, ty = y; //reset temp values
		//for the length of the ship
		for (let i=0;i<len;++i) {
			grid[ty][tx][0] = 1; //store ship part
			grid[ty][tx][1] = shipId; //store shipId
			if (player1) 
				updateGrid(ty,tx,1,false); //place ship part
			//go to next cell
			tx+=offsetx;
			ty+=offsety;
		}
	}
}

//setup functions//
function buildGrids() {
	let grid, x, y, cap, tr, th, td;
	grid = document.getElementById('ocean-grid')
	//add caption
	cap = document.createElement('caption');
	cap.innerText = 'YOUR FLEET';
	grid.appendChild(cap);
	for(y=-1; y<gridy; ++y) {
		//add row
		tr = document.createElement('tr');
		for(x=-1; x<gridx; ++x) {
			//x coordinates	heading(A-J)
			if(y==-1) {
				let letter = (x+10).toString(36);
				th = document.createElement('th');
				if(x==-1) {/* do nothing */}
				else th.innerText = letter.toUpperCase();
				tr.appendChild(th);
			}
			else {
				//y coordinates	heading(1-10)
				if(x==-1) {
					th = document.createElement('th');
					th.innerText = y + 1;
					tr.appendChild(th);
				}
				//add cell
				else {
					td = document.createElement('td');
					td.setAttribute('id', 'ply1-cell-'+y+'-'+x);
					tr.appendChild(td);
				}
			}
		}
		grid.appendChild(tr);
	}
	grid = document.getElementById('target-grid')
	//add caption
	cap = document.createElement('caption');
	cap.innerText = 'ENEMY FLEET';
	grid.appendChild(cap);
	for(y=-1; y<gridy; ++y) {
		//add row
		tr = document.createElement('tr');
		for(x=-1; x<gridx; ++x) {
			//x coordinates	heading(A-J)
			if(y==-1) {
				let letter = (x+10).toString(36);
				th = document.createElement('th');
				if(x==-1) {/* do nothing */}
				else th.innerText = letter.toUpperCase();
				tr.appendChild(th);
			}
			else {
				//y coordinates	heading(1-10)
				if(x==-1) {
					th = document.createElement('th');
					th.innerText = y + 1;
					tr.appendChild(th);
				}
				//add cell
				else {
					td = document.createElement('td');
					td.setAttribute('id', 'ply2-cell-'+y+'-'+x);
					//add onClick function
					td.addEventListener('click', shoot.bind(null, y, x));
					tr.appendChild(td);
				}
			}
		}
		grid.appendChild(tr);
	}
}
function setupPlayers(player1) {
	let total = 0;
	//if player 1
	if(player1) {
		p1 = new Player(); //create new player 
		//for all of the aircraft carriers
		for(let i=0; i<carrierNum; ++i) {
			p1.ships[i] = new Ship(i, 'carrier', 5, Math.floor(Math.random()*2), true); //create aircraft carrier
			p1.ships[i].placeShip(p1.grid); //place aircraft carrier
		}
		total += carrierNum;

		//for all of the battleships
		for(let i=0; i<battleNum; ++i) {
			p1.ships[total+i] = new Ship(total+i, 'battleship', 4, Math.floor(Math.random()*2), true); //create battleship
			p1.ships[total+i].placeShip(p1.grid); //place battleship
		}
		total += battleNum;

		//for all of the cruiser
		for(let i=0; i<cruiserNum; ++i) {
			p1.ships[total+i] = new Ship(total+i, 'cruiser', 3, Math.floor(Math.random()*2), true); //create cruiser
			p1.ships[total+i].placeShip(p1.grid); //place cruiser
		}
		total += cruiserNum;

		//for all of the submarine
		for(let i=0; i<subNum; ++i) {
			p1.ships[total+i] = new Ship(total+i, 'submarine', 3, Math.floor(Math.random()*2), true); //create submarine
			p1.ships[total+i].placeShip(p1.grid); //place submarine
		}
		total += subNum;

		//for all of the destroyer
		for(let i=0; i<destroyerNum; ++i) {
			p1.ships[total+i] = new Ship(total+i, 'destroyer', 2, Math.floor(Math.random()*2), true); //create destroyer
			p1.ships[total+i].placeShip(p1.grid); //place destroyer
		}
		total = 0;
	}
	//if player 2
	else {
		p2 = new Player(); //create new player
		//for all of the aircraft carriers
		for(let i=0; i<carrierNum; ++i) {
			p2.ships[i] = new Ship(i, 'carrier', 5, Math.floor(Math.random()*2), false); //create aircraft carrier
			p2.ships[i].placeShip(p2.grid); //place aircraft carrier
		}
		total += carrierNum;

		//for all of the battleships
		for(let i=0; i<battleNum; ++i) {
			total = carrierNum;
			p2.ships[total+i] = new Ship(total+i, 'battleship', 4, Math.floor(Math.random()*2), false); //create battleship
			p2.ships[total+i].placeShip(p2.grid); //place battleship
		}
		total += battleNum;

		//for all of the cruiser
		for(let i=0; i<cruiserNum; ++i) {
			p2.ships[total+i] = new Ship(total+i, 'cruiser', 3, Math.floor(Math.random()*2), false); //create cruiser
			p2.ships[total+i].placeShip(p2.grid); //place cruiser
		}
		total += cruiserNum;

		//for all of the submarine
		for(let i=0; i<subNum; ++i) {
			p2.ships[total+i] = new Ship(total+i, 'submarine', 3, Math.floor(Math.random()*2), false); //create submarine
			p2.ships[total+i].placeShip(p2.grid); //place submarine
		}
		total += subNum;

		//for all of the destroyer
		for(let i=0; i<destroyerNum; ++i) {
			p2.ships[total+i] = new Ship(total+i, 'destroyer', 2, Math.floor(Math.random()*2), false); //create destroyer
			p2.ships[total+i].placeShip(p2.grid); //place destroyer
		}
	}
}

function updateGrid(y,x,celltype,player1) {
	//player1
	if(player1) {
		p2.grid[y][x][0] = celltype; //change opponents cell to match new cell
		//show updated cell
		let cell = document.getElementById('ply2-cell-'+y+'-'+x);
		if(celltype == 1) cell.classList.add('ship');
		else if(celltype == 2) {
			cell.classList.add('ship');
			const div = document.createElement('div')
			div.classList.add('hit');
			cell.appendChild(div);
		}
		else if(celltype == 3) cell.classList.add('x');
		else cell.classList.add('sunk');
	}
	//player2
	else {
		p1.grid[y][x][0] = celltype; //change opponents cell to match new cell
		//show updated cell
		let cell = document.getElementById('ply1-cell-'+y+'-'+x);
		if(celltype == 1) cell.className = 'ship';
		else if(celltype == 2) {
			const div = document.createElement('div')
			div.classList.add('hit');
			cell.appendChild(div);
		}
		else if(celltype == 3) cell.className = 'x';
		else cell.className = 'sunk';
	}
}

function shoot(y,x) {
	const cell = document.getElementById('ply2-cell-'+y+'-'+x);
	if(playflag && !cell.classList.contains('ship') && !cell.classList.contains('x')) {
		stats.addShot();
		//hit
		if(p2.grid[y][x][0] == 1) {
			stats.addHit();
			updateGrid(y,x,2,true);
			const shipId = p2.grid[y][x][1];
			const ship = p2.ships[shipId];
			//if ship is detroyed
			if(--ship.len == 0) {
				sinkShip(p2.grid,shipId,true);
				alert('You sank my '+ship.shiptype+'!');
				//todo: show shipsLeft here
				//if all ships are destroyed end game
				if (--p2.shipsLeft == 0) {
					endGame(true);
				}
			}
			if(playflag) {computerMove();} //if game is not over switch turns
		}
		//miss
		else if(p2.grid[y][x][0] == 0) {
			updateGrid(y,x,3,true);
			computerMove();
		}
	}
}

function computerMove() {
	let x, y, sx, sy, pass;
	let selected = false;
	for (pass=0;pass<2;++pass) {
		//for every item in the grid while target is not selected
		for (y=0;y<gridy && !selected;++y) {
			for (x=0;x<gridx && !selected;++x) {
				//if coordinates has a hit
				if (p1.grid[y][x][0] == 2) {
					sx = x; 
					sy = y;
					//if there is a space above coordinates & if the space is water or ship set true
					let up = (y>0 && p1.grid[y-1][x][0]<=1);
					let dn = (y<gridy-1 && p1.grid[y+1][x][0]<=1);
					let lt = (x>0 && p1.grid[y][x-1][0]<=1);
					let rt = (x<gridx-1 && p1.grid[y][x+1][0]<=1);
					//look for two hits in a row first
					if(pass == 0) {
						let hup = (y>0 && p1.grid[y-1][x][0]==2);
						let hdn = (y<gridy-1 && p1.grid[y+1][x][0]==2);
						let hlt = (x>0 && p1.grid[y][x-1][0]==2);
						let hrt = (x<gridx-1 && p1.grid[y][x+1][0]==2);

						if (lt && hrt) { sx = x-1; selected=true; } //set target to left of hit
						else if (rt && hlt) { sx = x+1; selected=true; } //set target to right of hit
						else if (up && hdn) { sy = y-1; selected=true; } //set target above hit
						else if (dn && hup) { sy = y+1; selected=true; } //set target below hit
					}
					//if no other hits are around
					else {
						if (lt) { sx = x-1; selected=true; } //set target to left of hit
						else if (rt) { sx = x+1; selected=true; } //set target to right of hit
						else if (up) { sy = y-1; selected=true; } //set target above hit
						else if (dn) { sy = y+1; selected=true; } //set target below hit
					}
				}
			}
		}
	}
	//if no target was selected
	if (!selected) {
		//loop until selected coordinates is water or ship
		do{
			sy = Math.floor(Math.random() * (gridy-1));
			sx = Math.floor(Math.random() * (gridx-1)/2)*2+sy%2;
		} while(p1.grid[sy][sx][0]>1);
	}
	//hit
	if(p1.grid[sy][sx][0] == 1) {
		updateGrid(sy,sx,2,false);
		let shipId = p1.grid[sy][sx][1];
		let ship = p1.ships[shipId];
		//if ship is detroyed
		if(--ship.len == 0) {
			sinkShip(p1.grid,shipId,false);
			alert('I sank your '+ship.shiptype+'!');
			//if all ships are destroyed
			if (--p1.shipsLeft == 0) {
				showShips();
				endGame(false);
			}
		}
	}
	//miss
	else
		updateGrid(sy,sx,3,false);
}

function sinkShip(grid,shipId,player1) {
  let y,x;
  //for all of the cells
  for (y=0;y<gridy;++y) {
    for (x=0;x<gridx;++x) {
	  //that the ship occupies
      if (grid[y][x][1] == shipId)
		//change image to sunken ship
        if (player1)
			updateGrid(y,x,4,true);
		else
			updateGrid(y,x,4,false);
    }
  }
}

function showShips() {
  let y,x;
  //for every item in grid
  for (y=0;y<gridy;++y) {
    for (x=0;x<gridx;++x) {	
		//show ship
		if (p2.grid[y][x][0] == 1)
			updateGrid(y,x,1,true);
    }
  }
}

function start() {
	shipNum = carrierNum + battleNum + cruiserNum + subNum + destroyerNum;
	buildGrids();
	stats = new Stats;
}

function endGame(player1) {
	if(playflag == true) {
		let btn;

		//turn off grid
		const grid = document.getElementById('target-grid');
		grid.classList.toggle('on-off');

		playflag = false;
		if(player1)
		{
			stats.addWin();
			alert('You win!');
		}
		else
		{
			stats.addLoss();
			alert('I win!');
		}

		//turn on btnNewGame
		btn = document.getElementById('btnNewGame');
		btn.classList.toggle('on-off');
		//turn off btnSur
		btn = document.getElementById('btnSur');
		btn.classList.toggle('on-off');
	}
}

function host() {

}

function join() {

}

function showSettings() {
	let settingsScreen = document.querySelector('.setting-screen');
	settingsScreen.classList.toggle('show');
}

function newGame() {
	if(playflag == false) {
		let btn, grid;
		
		//turn on grid
		grid = document.getElementById('target-grid');
		grid.classList.toggle('on-off');

		//turn off btnNewGame
		btn = document.getElementById('btnNewGame');
		btn.classList.toggle('on-off');

		//turn on btnSur
		btn = document.getElementById('btnSur');
		btn.classList.toggle('on-off');
		
		//destroy grids
		grid = document.getElementById('target-grid');
		while(grid.firstChild) {
			grid.removeChild(grid.firstChild);
		}
		grid = document.getElementById('ocean-grid');
		while(grid.firstChild) {
			grid.removeChild(grid.firstChild);
		}

		//build game
		shipNum = carrierNum + battleNum + cruiserNum + subNum + destroyerNum;
		buildGrids();
		setupPlayers(true);
		setupPlayers(false);
		playflag = true;
	}
}

function quit() {
	if(online) {
		
	}
}

//settings functions//
//grid settings
function colAdd() {
	if(!(gridx == 15)) {
		const columns = document.getElementById('col');
		columns.innerText = ++gridx;
		//turn on col-
		if(gridx == 11) {
			const btn = document.getElementById('col-');
			btn.classList.toggle('on-off');
		}
		//turn off col+
		if(gridx == 15) {
			const btn = document.getElementById('col+');
			btn.classList.toggle('on-off');
		}
	}
}
function colSub() {
	if(!(gridx == 10)) {
		const el = document.getElementById('col');
		el.innerText = --gridx;
		//turn on col+
		if(gridx == 14) {
			const btn = document.getElementById('col+');
			btn.classList.toggle('on-off');
		}
		//turn off col-
		if(gridx == 10) {
			const btn = document.getElementById('col-');
			btn.classList.toggle('on-off');
		}
	}
}
function rowAdd() {
	if(!(gridy == 15)) {
		const el = document.getElementById('row');
		el.innerText = ++gridy;
		//turn on row-
		if(gridy == 11) {
			const btn = document.getElementById('row-');
			btn.classList.toggle('on-off');
		}
		//turn off row+
		if(gridy == 15) {
			const btn = document.getElementById('row+');
			btn.classList.toggle('on-off');
		}
	}
}
function rowSub() {
	if(!(gridy == 10)) {
		const el = document.getElementById('row');
		el.innerText = --gridy;
		//turn on row+
		if(gridy == 14) {
			const btn = document.getElementById('row+');
			btn.classList.toggle('on-off');
		}
		//turn off row-
		if(gridy == 10) {
			const btn = document.getElementById('row-');
			btn.classList.toggle('on-off');
		}
	}
}

//ship settings
function carAdd() {
	if(!(carrierNum == 3)) {
		const el = document.getElementById('car');
		el.innerText = ++carrierNum;
		//turn on car-
		if(carrierNum == 2) {
			const btn = document.getElementById('car-');
			btn.classList.toggle('on-off');
		}
		//turn off car+
		if(carrierNum == 3) {
			const btn = document.getElementById('car+');
			btn.classList.toggle('on-off');
		}
	}
}
function carSub() {
	if(!(carrierNum == 1)) {
		const el = document.getElementById('car');
		el.innerText = --carrierNum;
		//turn on car+
		if(carrierNum == 2) {
			const btn = document.getElementById('car+');
			btn.classList.toggle('on-off');
		}
		//turn off car-
		if(carrierNum == 1) {
			const btn = document.getElementById('car-');
			btn.classList.toggle('on-off');
		}
	}
}

function batleAdd() {
	if(!(battleNum == 3)) {
		const el = document.getElementById('batle');
		el.innerText = ++battleNum;
		//turn on batle-
		if(battleNum == 2) {
			const btn = document.getElementById('batle-');
			btn.classList.toggle('on-off');
		}
		//turn off batle+
		if(battleNum == 3) {
			const btn = document.getElementById('batle+');
			btn.classList.toggle('on-off');
		}
	}
}
function batleSub() {
	if(!(battleNum == 1)) {
		const el = document.getElementById('batle');
		el.innerText = --battleNum;
		//turn on batle+
		if(battleNum == 2) {
			const btn = document.getElementById('batle+');
			btn.classList.toggle('on-off');
		}
		//turn off batle-
		if(battleNum == 1) {
			const btn = document.getElementById('batle-');
			btn.classList.toggle('on-off');
		}
	}
}

function cruAdd() {
	if(!(cruiserNum == 3)) {
		const el = document.getElementById('cru');
		el.innerText = ++cruiserNum;
		//turn on cru-
		if(cruiserNum == 2) {
			const btn = document.getElementById('cru-');
			btn.classList.toggle('on-off');
		}
		//turn off cru+
		if(cruiserNum == 3) {
			const btn = document.getElementById('cru+');
			btn.classList.toggle('on-off');
		}
	}
}
function cruSub() {
	if(!(cruiserNum == 1)) {
		const el = document.getElementById('cru');
		el.innerText = --cruiserNum;
		//turn on cru+
		if(cruiserNum == 2) {
			const btn = document.getElementById('cru+');
			btn.classList.toggle('on-off');
		}
		//turn off cru-
		if(cruiserNum == 1) {
			const btn = document.getElementById('cru-');
			btn.classList.toggle('on-off');
		}
	}
}

function submAdd() {
	if(!(subNum == 3)) {
		const el = document.getElementById('sub');
		el.innerText = ++subNum;
		//turn on sub-
		if(subNum == 2) {
			const btn = document.getElementById('sub-');
			btn.classList.toggle('on-off');
		}
		//turn off sub+
		if(subNum == 3) {
			const btn = document.getElementById('sub+');
			btn.classList.toggle('on-off');
		}
	}
}
function submSub() {
	if(!(subNum == 1)) {
		const el = document.getElementById('sub');
		el.innerText = --subNum;
		//turn on sub+
		if(subNum == 2) {
			const btn = document.getElementById('sub+');
			btn.classList.toggle('on-off');
		}
		//turn off sub-
		if(subNum == 1) {
			const btn = document.getElementById('sub-');
			btn.classList.toggle('on-off');
		}
	}
}

function desAdd() {
	if(!(destroyerNum == 3)) {
		const el = document.getElementById('des');
		el.innerText = ++destroyerNum;
		//turn on des-
		if(destroyerNum == 2) {
			const btn = document.getElementById('des-');
			btn.classList.toggle('on-off');
		}
		//turn off des+
		if(destroyerNum == 3) {
			const btn = document.getElementById('des+');
			btn.classList.toggle('on-off');
		}
	}
}
function desSub() {
	if(!(destroyerNum == 1)) {
		const el = document.getElementById('des');
		el.innerText = --destroyerNum;
		//turn on des+
		if(destroyerNum == 2) {
			const btn = document.getElementById('des+');
			btn.classList.toggle('on-off');
		}
		//turn off des-
		if(destroyerNum == 1) {
			const btn = document.getElementById('des-');
			btn.classList.toggle('on-off');
		}
	}
}

const btnColAdd = document.getElementById('col+'),
btnColSub = document.getElementById('col-'),
btnRowAdd = document.getElementById('row+'),
btnRowSub = document.getElementById('row-'),
btnCarAdd = document.getElementById('car+'),
btnCarSub = document.getElementById('car-'),
btnBatleAdd = document.getElementById('batle+'),
btnBatleSub = document.getElementById('batle-'),
btnCruAdd = document.getElementById('cru+'),
btnCruSub = document.getElementById('cru-'),
btnSubmAdd = document.getElementById('sub+'),
btnSubmSub = document.getElementById('sub-'),
btnDesAdd = document.getElementById('des+'),
btnDesSub = document.getElementById('des-'),
btnClose = document.getElementById('close'),

btnHost = document.getElementById('btnHost'),
btnJoin = document.getElementById('btnJoin'),
btnSettings = document.getElementById('btnSettings'),
btnSur = document.getElementById('btnSur'),
btnNewGame = document.getElementById('btnNewGame'),
btnQuit = document.getElementById('btnQuit');

//event listeners
btnColAdd.addEventListener('click', colAdd);
btnColSub.addEventListener('click', colSub);

btnRowAdd.addEventListener('click', rowAdd);
btnRowSub.addEventListener('click', rowSub);

btnCarAdd.addEventListener('click', carAdd);
btnCarSub.addEventListener('click', carSub);

btnBatleAdd.addEventListener('click', batleAdd);
btnBatleSub.addEventListener('click', batleSub);

btnCruAdd.addEventListener('click', cruAdd);
btnCruSub.addEventListener('click', cruSub);

btnSubmAdd.addEventListener('click', submAdd);
btnSubmSub.addEventListener('click', submSub);

btnDesAdd.addEventListener('click', desAdd);
btnDesSub.addEventListener('click', desSub);

btnClose.addEventListener('click', showSettings);


btnHost.addEventListener('click', host);
btnJoin.addEventListener('click', join);
btnSettings.addEventListener('click', showSettings);
btnSur.addEventListener('click', endGame.bind(null, false));
btnNewGame.addEventListener('click', newGame);
btnQuit.addEventListener('click', quit);