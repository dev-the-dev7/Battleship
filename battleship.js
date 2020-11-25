//Copyright � 2020 Devin Vella
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

const placementContainer = document.querySelector('.ship-placement-container');
const shipContainer = document.querySelector('.ship-container');
const carrier = document.querySelector('.carrier');
const battleship = document.querySelector('.battleship');
const cruiser = document.querySelector('.cruiser');
const submarine = document.querySelector('.submarine');
const destroyer = document.querySelector('.destroyer');
const placementShips = [carrier, battleship, cruiser, submarine, destroyer];
const btnRandom = document.getElementById('btnRandom');
const btnRotate = document.getElementById('btnRotate');
const btnReset = document.getElementById('btnReset');
const btnConfirm = document.getElementById('btnConfirm');

const targetGrid = document.getElementById('target-grid');
const oceanGrid = document.getElementById('ocean-grid');

const btnClose = document.getElementById('close');
const btnHost = document.getElementById('btnHost');
const btnJoin = document.getElementById('btnJoin');
const btnSettings = document.getElementById('btnSettings');
const btnSur = document.getElementById('btnSur');
const btnNewGame = document.getElementById('btnNewGame');
const btnQuit = document.getElementById('btnQuit');

const settingsScreen = document.querySelector('.setting-screen');
const lblCol = document.getElementById('col');
const btnColAdd = document.getElementById('col+');
const btnColSub = document.getElementById('col-');
const lblRow = document.getElementById('row');
const btnRowAdd = document.getElementById('row+');
const btnRowSub = document.getElementById('row-');
const lblCar = document.getElementById('car');
const btnCarAdd = document.getElementById('car+');
const btnCarSub = document.getElementById('car-');
const lblBatle = document.getElementById('batle');
const btnBatleAdd = document.getElementById('batle+');
const btnBatleSub = document.getElementById('batle-');
const lblCru = document.getElementById('cru');
const btnCruAdd = document.getElementById('cru+');
const btnCruSub = document.getElementById('cru-');
const lblSubm = document.getElementById('sub');
const btnSubmAdd = document.getElementById('sub+');
const btnSubmSub = document.getElementById('sub-');
const lblDes = document.getElementById('des');
const btnDesAdd = document.getElementById('des+');
const btnDesSub = document.getElementById('des-');

let p1;
let p2;
let stats = new Stats;
let playflag = false;
let readyflag = false;
let onlineflag = false;
let width = 10;
let length = 10;
let selectedPart;
let draggedShip;
let shipNum;
let carrierNum = 1;
let battleNum = 1;
let cruiserNum = 1;
let subNum = 1;
let destroyerNum = 1;
let shipsPlaced = 0;
let carriersPlaced = 0;
let battleshipsPlaced = 0;
let cruisersPlaced = 0;
let submarinesPlaced = 0;
let destroyersPlaced = 0;

buildGrid(targetGrid, false);
buildGrid(oceanGrid, true);

//stats object
function Stats() {
	this.wins = 0;
	this.losses = 0;
	this.winRate = 0;
	this.hits = 0;
	this.shots = 0;
	this.accuracy = 0;

	this.addWin = function() {
		const win = document.getElementById('wins');

		++this.wins;
		win.innerText = 'Wins: ' + this.wins;
		this.getwinRate();
	}

	this.addLoss = function() {
		const los = document.getElementById('losses');

		++this.losses
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
	this.tiles = []; //store grid cells
}

//ship object
function Ship(shipId, shiptype, len, align) {
	this.shipId = shipId;
	this.shiptype = shiptype;
	this.len = len;
	this.align = align;
}

//setup game functions//
function buildGrid(grid, myGrid) {
	//add caption
	let cap = document.createElement('caption');
	if(myGrid) {
		p1 = new Player(); //create new player1 
		cap.innerText = 'YOUR FLEET';
	}
	else {
		p2 = new Player(); //create new player2
		cap.innerText = 'ENEMY FLEET';
	}
	grid.appendChild(cap);

	//add cells
	for(let y=-1; y<length; ++y) {
		//add row
		let tr = document.createElement('tr');
		for(let x=-1; x<width; ++x) {
			//x coordinates	heading(A-J)
			if(y==-1) {
				let th = document.createElement('th');
				if(x!=-1) {
					let letter = (x+10).toString(36);
					th.innerText = letter.toUpperCase();
				}
				tr.appendChild(th);
			}
			else {
				//y coordinates	heading(1-10)
				if(x==-1) {
					let th = document.createElement('th');
					th.innerText = y + 1;
					tr.appendChild(th);
				}
				//add cell
				else {
					let td = document.createElement('td');
					//store element
					td.id = y*width + x;
					if(myGrid) { 
						//add drop listener
						td.addEventListener('drop', dragDrop.bind(null));
						td.addEventListener('dragover', allowDrop.bind(null));
						p1.tiles.push(td);
					}
					else {
						//add onClick listener
						td.addEventListener('click', shoot.bind(null, td.id));
						p2.tiles.push(td);
					}
					tr.appendChild(td);
				}
			}
		}
		grid.appendChild(tr);
	}
}

function createShips(ships) {
	let total = 0;
	
	//for all of the aircraft carriers
	for(let i=0; i<carrierNum; ++i) ships[i] = new Ship(i, 'carrier', 5, Math.floor(Math.random()*2)); //create aircraft carrier
	total += carrierNum;

	//for all of the battleships
	for(let i=0; i<battleNum; ++i) ships[total+i] = new Ship(total+i, 'battleship', 4, Math.floor(Math.random()*2)); //create battleship
	total += battleNum;

	//for all of the cruiser
	for(let i=0; i<cruiserNum; ++i) ships[total+i] = new Ship(total+i, 'cruiser', 3, Math.floor(Math.random()*2)); //create cruiser
	total += cruiserNum;

	//for all of the submarine
	for(let i=0; i<subNum; ++i) ships[total+i] = new Ship(total+i, 'submarine', 3, Math.floor(Math.random()*2)); //create submarine
	total += subNum;

	//for all of the destroyer
	for(let i=0; i<destroyerNum; ++i) ships[total+i] = new Ship(total+i, 'destroyer', 2, Math.floor(Math.random()*2)); //create destroyer
}

function randomPlacement(ships, grid, player1) {
	//create ships//
	createShips(ships);
		
	//empty grid//
	grid.forEach(tile => {
		tile.removeAttribute('class'); //remove classes
		tile.removeAttribute('data-id'); //remove id
	});
		
	//random placement//
	ships.forEach(ship => {
		let taken = true, rangex = width, rangey = length, shipArea;
		//find empty spot for Ship//
		while (taken) {
			//get range of allowed placements (prevent ship from going off grid)
			if (ship.align == 0) rangex -= ship.len //horzontal alignment
			else rangey -= ship.len //vertical alignment
			//get random starting point
			let randomStart = Math.floor(Math.random()*rangey)*width + Math.floor(Math.random()*rangex);
			//get random starting area
			if (ship.align == 0) shipArea = grid.slice(randomStart, randomStart+ship.len);
			else shipArea = grid.filter((v, i) => i % width === randomStart % width && i >= randomStart && i <= (randomStart+width*(ship.len-1)));
			taken = shipArea.some(tile => tile.classList.contains('taken')); //check if spot is taken
		}
	
		//build ship//
		shipArea.forEach(tile => {
			tile.classList.add('taken'); //reserve space for ship
			if (player1) tile.classList.add('ship'); //place ship
			tile.setAttribute('data-id', ship.shipId); //store shipId
		});

		//turn off ships
		shipsPlaced = shipNum;
		placementShips.forEach(ship => turnOffShips(ship, shipsPlaced, shipNum));
	});
}

function turnOnShips() {
	//turn on ship placement
	placementShips.forEach(ship => {
		ship.classList.remove('off');
		ship.setAttribute('draggable', 'true');
	});

	//reset variables
	shipsPlaced = 0;
	carriersPlaced = 0;
	battleshipsPlaced = 0;
	cruisersPlaced = 0;
	submarinesPlaced = 0;
	destroyersPlaced = 0;
}

function turnOffShips(ship, shipsPlaced, shipNum) {
	if (shipsPlaced == shipNum) {
		ship.classList.add('off');
		ship.removeAttribute('draggable');
	}
}

function togglePlacementBtns() {
	btnRandom.classList.toggle('off');
	btnRotate.classList.toggle('off');
	btnReset.classList.toggle('off');
	btnConfirm.classList.toggle('off');
}

//game functions//
function shoot(index) {
	let cell = p2.tiles[index]
	if(playflag && !cell.classList.contains('ship') && !cell.classList.contains('x')) {
		stats.addShot();
		//hit
		if (cell.classList.contains('taken')) {
			stats.addHit();
			updateGrid(cell,2); //set cell to hit
			const shipId = cell.getAttribute('data-id');
			const ship = p2.ships[shipId];
			if (--ship.len == 0) sinkShip(p2,shipId,true); //if ship is detroyed sink ship
			if(playflag) computerMove(); //if game is not over switch turns
		}
		//miss
		else {
			updateGrid(cell,3,true); //set cell to miss
			computerMove();
		}
	}
}

function computerMove() {
	let selected = false, index;
	for (let pass=0;pass<2;++pass) {
		p1.tiles.forEach((tile, i) => {
			if (!selected && tile.classList.contains('hit')) {
				//if there is another cell in the direction set true
				let up = (i >= width);
				let dn = (i < width*(length-1));
				let lt = (!(i % width === 0));
				let rt = (!((i+(width-1)) % width === (width-1) % width));
				//if the cell is empty set true
				let eup = (up && checkIfEmpty(i-width));
				let edn = (dn && checkIfEmpty(i+width));
				let elt = (lt && checkIfEmpty(i-1));
				let ert = (rt && checkIfEmpty(i+1));
				//look for two hits in a row first
				if(pass == 0) {
					//if cell has a hit set true
					let hup = (up && p1.tiles[i-width].classList.contains('hit'));
					let hdn = (dn && p1.tiles[i+width].classList.contains('hit'));
					let hlt = (lt && p1.tiles[i-1].classList.contains('hit'));
					let hrt = (rt && p1.tiles[i+1].classList.contains('hit'));
			
					//select target
					if (elt && hrt) { index = i-1; selected=true; } //set target to left of hit
					else if (ert && hlt) { index = i+1; selected=true; } //set target to right of hit
					else if (eup && hdn) { index = i-width; selected=true; } //set target above hit
					else if (edn && hup) { index = i+width; selected=true; } //set target below hit
				}
				//if no other hits are around
				else {
					//select target
					if (elt) { index = i-1; selected=true; } //set target to left of hit
					else if (ert) { index = i+1; selected=true; } //set target to right of hit
					else if (eup) { index = i-width; selected=true; } //set target above hit
					else if (edn) { index = i+width; selected=true; } //set target below hit
				}
			}	
		});
	}
	//if no target was selected
	if (!selected) {
		//loop until selected cell is empty
		do {
			let y = Math.floor(Math.random() * length);
			let x = Math.floor(Math.random() * width/2)*2+y%2;
			index = y*width + x;
		} while(!checkIfEmpty(index));
	}
	let cell = p1.tiles[index];

	//hit
	if(cell.classList.contains('ship')) {
		updateGrid(cell,2); //set cell to hit
		let shipId = cell.getAttribute('data-id');
		let ship = p1.ships[shipId];
		if(--ship.len == 0) sinkShip(p1,shipId,false); //if ship is detroyed sink ship
	}
	//miss
	else updateGrid(cell,3,false); //set cell to miss

	function checkIfEmpty(index) {
		return !p1.tiles[index].classList.contains('hit') && !p1.tiles[index].classList.contains('x') && !p1.tiles[index].classList.contains('sunk');
	}
}

function updateGrid(cell, celltype) {
	if (celltype != 3) cell.classList.add('ship');
	if (celltype == 2) {
		cell.classList.add('hit');
		const div = document.createElement('div')
		div.classList.add('fire');
		cell.appendChild(div);
	}
	else if (celltype == 3) cell.classList.add('x');
	else if (celltype == 4) {
		cell.classList.remove('hit');
		cell.classList.add('sunk');
	}
}

function sinkShip(player, shipId, player1) {
	//sink each part with shipId
	player.tiles.forEach(tile => {if (tile.getAttribute('data-id') == shipId) updateGrid(tile,4)});
	if (player1) alert('You sank my '+player.ships[shipId].shiptype+'!');
	else alert('I sank your '+player.ships[shipId].shiptype+'!');
	
	//if all ships are destroyed end game
	if (--player.shipsLeft == 0) {
		if (player1) endGame(true);
		else endGame(false);
	}
}

function endGame(player1) {
	if (playflag == true) {
		//turn off grid
		targetGrid.classList.add('off');

		//end game message
		playflag = false;
		if (player1) {
			stats.addWin();
			alert('You win!');
		}
		else {
			stats.addLoss();
			alert('I win!');
			p2.tiles.forEach(tile => {if (tile.classList.contains('taken')) updateGrid(tile,1,)}); //show ships
		}

		//turn off btnSur
		btnSur.classList.add('off');
		//turn on btnNewGame
		btnNewGame.classList.remove('off');
	}
}

function showSettings() {
	if (readyflag == false) settingsScreen.classList.toggle('hide');
}

function multiplayer(host) {

}

//drop functions//
function allowDrop(e) {
	if (readyflag && draggedShip != undefined) e.preventDefault();
}
  
function dragDrop(e) {
	let shipClass = draggedShip.classList.item(1);
	let shipLength = (draggedShip.childNodes.length-1) / 2;
	let lastPartId;
	let alignment;
	let cell;
	let notAllowed = false;
		
	//get alignment
	if (draggedShip.classList.contains('vertical')) alignment = 1;
	else alignment = 0;

	//return if placement is not allowed
	if (alignment == 0) {
		lastPartId = shipLength-1 + parseInt(e.target.id) - selectedPart;
		for (let i=0; i < shipLength-1; ++i) {
			if (lastPartId % width == i) return notAllowed = true;
		}
	}
	else {
		lastPartId = width*(shipLength-1) + parseInt(e.target.id) - width*selectedPart;
		if (lastPartId < width*(shipLength-1) || lastPartId > width*length-1) return notAllowed = true;
	}
	if (notAllowed) return;

	//create ship//
	p1.ships[shipsPlaced] = new Ship(shipsPlaced, shipClass, shipLength, alignment, true);

	//place ship//
	for (let i=0; i < shipLength; ++i) {
		//get cell
		if (alignment == 0) cell = p1.tiles[parseInt(e.target.id) - selectedPart + i];
		else cell = p1.tiles[parseInt(e.target.id) - width*selectedPart + width*i];
		//place ship
		cell.classList.add('ship'); //place ship
		cell.setAttribute('data-id', shipsPlaced); //store shipId
	}
	++shipsPlaced;

	//turn off ship if there are none left
	if (shipClass == 'carrier') {
		++carriersPlaced;
		turnOffShips(draggedShip, carriersPlaced, carrierNum);
	}
	if (shipClass == 'battleship') {
		++battleshipsPlaced;
		turnOffShips(draggedShip, battleshipsPlaced, battleNum);
	}
	if (shipClass == 'cruiser') {
		++cruisersPlaced;
		turnOffShips(draggedShip, cruisersPlaced, cruiserNum);
	}
	if (shipClass == 'submarine') {
		++submarinesPlaced;
		turnOffShips(draggedShip, submarinesPlaced, subNum);
	}
	if (shipClass == 'destroyer') {
		++destroyersPlaced;
		turnOffShips(draggedShip, destroyersPlaced, destroyerNum);
	}
}

//event listeners//
//game controls
btnHost.addEventListener('click', multiplayer(true));
btnJoin.addEventListener('click', multiplayer(false));
btnSettings.addEventListener('click', showSettings);
btnSur.addEventListener('click', endGame.bind(null, false));
btnNewGame.addEventListener('click', () => {
	if(!playflag && !readyflag) {
		btnNewGame.classList.add('off'); //turn off btnNewGame
		btnSettings.classList.add('off'); //turn off btnSettings
		
		//destroy grids
		while(targetGrid.firstChild) targetGrid.removeChild(targetGrid.firstChild);
		while(oceanGrid.firstChild) oceanGrid.removeChild(oceanGrid.firstChild);

		//build game
		shipNum = carrierNum + battleNum + cruiserNum + subNum + destroyerNum;
		buildGrid(targetGrid, false);
		buildGrid(oceanGrid, true);

		//turn on ship placement
		turnOnShips();
		togglePlacementBtns();
		
		readyflag = true; //ready for ship placement
	}
});
btnQuit.addEventListener('click', () => {
	if(onlineflag) {
		//todo: disconnect from server
		onlineflag = false;
		playflag = false;
		//.removeEventListener
	}
});

//drag events
placementShips.forEach(ship => {
	ship.addEventListener('dragstart', e => draggedShip = e.target);
	ship.addEventListener('dragend', () => draggedShip = undefined);
	ship.addEventListener('mousedown', e => selectedPart = e.target.getAttribute('date-id'));
});

//placement controls
btnRandom.addEventListener('click', () => {if (readyflag) randomPlacement(p1.ships, p1.tiles, true)});
btnRotate.addEventListener('click', () => {
	if (readyflag) {
		placementShips.forEach(ship => ship.classList.toggle('vertical'));
		placementContainer.classList.toggle('horizontal');
	}
});
btnReset.addEventListener('click', () => {
	if (readyflag) {
		//empty grid
		p1.tiles.forEach(tile => {
			tile.removeAttribute('class'); //remove classes
			tile.removeAttribute('data-id'); //remove id
		});
	
		turnOnShips();
	}
});
btnConfirm.addEventListener('click', () => {
	if (readyflag && shipsPlaced == shipNum) {
		//turn off ship placement
		placementShips.forEach(ship => ship.setAttribute('draggable', 'false'));
		togglePlacementBtns();
		//player2 ship placement
		if(onlineflag) {}
		else randomPlacement(p2.ships, p2.tiles, false);
		//turn on control buttons
		targetGrid.classList.remove('off');
		btnSur.classList.remove('off');
		btnSettings.classList.remove('off');
		//start game
		readyflag = false;
		playflag = true;
	}
});

//grid settings
btnColAdd.addEventListener('click', () => {
	if (!(width == 16)) {
		lblCol.innerText = ++width;
		updateSettings(btnColAdd, btnColSub, 16, 11, width);
	}
});
btnColSub.addEventListener('click', () => {
	if(!(width == 10)) {
		lblCol.innerText = --width;
		updateSettings(btnColAdd, btnColSub, 15, 10, width);
	}
});

btnRowAdd.addEventListener('click', () => {
	if(!(length == 16)) {
		lblRow.innerText = ++length;
		updateSettings(btnRowAdd, btnRowSub, 16, 11, length);
	}
});
btnRowSub.addEventListener('click', () => {
	if(!(length == 10)) {
		lblRow.innerText = --length;
		updateSettings(btnRowAdd, btnRowSub, 15, 10, length);
	}
});

//ship settings
btnCarAdd.addEventListener('click', () => {
	if(!(carrierNum == 3)) {
		lblCar.innerText = ++carrierNum;
		updateSettings(btnCarAdd, btnCarSub, 3, 2, carrierNum);
	}
});
btnCarSub.addEventListener('click', () => {
	if(!(carrierNum == 1)) {
		lblCar.innerText = --carrierNum;
		updateSettings(btnCarAdd, btnCarSub, 2, 1, carrierNum);
	}
});

btnBatleAdd.addEventListener('click', () => {
	if(!(battleNum == 3)) {
		lblBatle.innerText = ++battleNum;
		updateSettings(btnBatleAdd, btnBatleSub, 3, 2, battleNum);
	}
});
btnBatleSub.addEventListener('click', () => {
	if(!(battleNum == 1)) {
		lblBatle.innerText = --battleNum;
		updateSettings(btnBatleAdd, btnBatleSub, 2, 1, battleNum);
	}
});

btnCruAdd.addEventListener('click', () => {
	if(!(cruiserNum == 3)) {
		lblCru.innerText = ++cruiserNum;
		updateSettings(btnCruAdd, btnCruSub, 3, 2, cruiserNum);
	}
});
btnCruSub.addEventListener('click', () => {
	if(!(cruiserNum == 1)) {
		lblCru.innerText = --cruiserNum;
		updateSettings(btnCruAdd, btnCruSub, 2, 1, cruiserNum);
	}
});

btnSubmAdd.addEventListener('click', () => {
	if(!(subNum == 3)) {
		lblSubm.innerText = ++subNum;
		updateSettings(btnSubmAdd, btnSubmSub, 3, 2, subNum);
	}
});
btnSubmSub.addEventListener('click', () => {
	if(!(subNum == 1)) {
		lblSubm.innerText = --subNum;
		updateSettings(btnSubmAdd, btnSubmSub, 2, 1, subNum);
	}
});

btnDesAdd.addEventListener('click', () => {
	if(!(destroyerNum == 3)) {
		lblDes.innerText = ++destroyerNum;
		updateSettings(btnDesAdd, btnDesSub, 3, 2, destroyerNum);
	}
});
btnDesSub.addEventListener('click', () => {
	if(!(destroyerNum == 1)) {
		lblDes.innerText = --destroyerNum;
		updateSettings(btnDesAdd, btnDesSub, 2, 1, destroyerNum);
	}
});

//close settings
btnClose.addEventListener('click', showSettings);

function updateSettings(btnAdd, btnSub, max, min, setting) {
	if(setting == max) btnAdd.classList.toggle('off'); //toggle add button
	if(setting == min) btnSub.classList.toggle('off'); //toggle sub button
}