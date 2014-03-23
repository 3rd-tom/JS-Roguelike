// font size
var TILESIZE = 64; var ROWS = 40; var COLS = 40;
var vROWS = 9; var vCOLS = 13;
var ACTORS = 10; // number of actors per level, including player
var currentMap; // the structure of the map	
var maps; // Array of map arrays
var level; // What level the player is on
var levels; // How many levels all up
var screen;	// the ascii display, as a 2d array of characters
var overlay; // Fog of war overlay
var player; // a list of all actors, 0 is the player
var playerDisplay;
var playerCameraOffset;
var actorList;
var actorDisplay;	
var itemList;
var itemDisplay;
var roomArray; // Holds the information for the rooms on the map
var topDisplay;
var livingEnemies;
var actorMap; // points to each actor in its position, for quick searching
var itemMap;
var npcPhase = false;
var scoreArray;
var score = 0;
var aStarGraph;
var traceGroup; var traceY = 0; // Trace variables

// initialize phaser, call create() once done
var game = new Phaser.Game(vCOLS * TILESIZE, (vROWS * TILESIZE) + TILESIZE, Phaser.AUTO, null, {
	preload:onPreload, create: create, update:onUpdate
});
//******************************************************************************************************
//******************************************************************************************************
function onPreload() {
	traceGroup = new Phaser.Group(game);
	game.load.spritesheet("dungeonSheet","lib/ss001.png",64,64);
	game.load.spritesheet("numberSheet","lib/ss002.png",40,40);
	var loading = game.add.text(game.width / 2, game.height / 2, 'Loading...', { fill : '#fff', align: "center" });
	loading.anchor.setTo(0.5,0.5);
}
//******************************************************************************************************
//******************************************************************************************************
function onUpdate()	{	
	if(npcPhase){
		for (var a = 1; a < actorList.length; a++) {
			var enemy = actorList[a];
			if(enemy)aiAct(enemy);
		}
		checkItemHit();
		positionObjects();
		drawMap();
		npcPhase = false;
	}
}
//******************************************************************************************************
//******************************************************************************************************
function create() {
	game.input.keyboard.addCallbacks(null, onKeyUp, null); // init keyboard commands
	levels = 1;
	level = rn(0,levels - 1);
	trace("level " + level)
	maps = [];
	trace('flag 1');
	var tMap;
	while(maps.length < levels){
		trace("map loop")
		tMap = initMap();
		trace("tMap.length " + tMap.length)
		if(tMap.length > 0)maps.push(tMap)
	}
	trace("tMap[20][20] " + tMap[20][20])
	trace("out of loop")
	trace("maps.length " + maps.length)
	trace("maps[0] " + maps[0])
	trace("level " + level);
	//trace("maps[level]" + maps[level]);
	currentMap = maps[level];
	//currentMap = maps.pop();
	trace("flag 3")
	trace("cMap[20][20] " + currentMap[20][20])
	screen = initTiles(true);
	trace('flag 4');
	actorDisplay = [];
	
	initActors(); // initialize actors
	trace("player " + player);
	initItems();
	drawItems();
	
	drawActors(); // draw actors into the level
	overlay = initTiles(false);
	drawTopBar(); // draw UI top bar
	
	game.world.setBounds(-1000, -1000, (TILESIZE * COLS) + 2000, (TILESIZE * ROWS) + 2000);
	playerCameraOffset = game.add.sprite(playerDisplay.x + 32,playerDisplay.y, "dungeonSheet", 11);
	playerCameraOffset.visible = false;
	game.camera.follow(playerCameraOffset);
	trace('flag 5');
	
	positionObjects();
	drawMap();
	trace('flag 6');
}
//******************************************************************************************************
//******************************************************************************************************
function initTiles(isScreen){
	var a = [];
	for (var y = 0; y < ROWS; y++) {
		var newRow = [];
		a.push(newRow);
		for (var x = 0; x < COLS; x++){
			isScreen ? newRow.push(initCell(currentMap[y][x], x, y)) : newRow.push(initCell(-1, x, y))
		}
	}
	return a;
}
//******************************************************************************************************
//******************************************************************************************************
function initCell(chr, x, y) {
	var tileType = chr == 0 ? 3 : 8;
	var tileSprite = game.add.sprite(TILESIZE * x, (TILESIZE * y) + TILESIZE, "dungeonSheet",chr >= 0 ? tileType : 11);
	tileSprite.tileValue = chr;
	tileSprite.fogValue = 0;
	return tileSprite;
}
//******************************************************************************************************
//******************************************************************************************************
function drawMap(){
	for (var y = 0; y < ROWS; y++) {
		for (var x = 0; x < COLS; x++){
			var cell = screen[y][x];
			var overCell = overlay[y][x];
			// Is it in range of the player?
			var distance = Math.sqrt(Math.pow(x - player.x, 2) + Math.pow(y - player.y, 2))
			if(distance <= 3){
				overCell.visible = false;
				cell.fogValue = 2;
			} else {
				if(cell.fogValue == 2){
					overCell.visible = true;
					cell.fogValue = 1;
					overCell.animations.frame = 7;
				}	
			}	
		}	
	}	
}
//******************************************************************************************************
//******************************************************************************************************
function initMap() {
	//trace('flag map 1');
	var map = [];
	for (var y = 0; y < ROWS; y++) {
		var newRow = [];
		for (var x = 0; x < COLS; x++) {
			newRow.push(0);
		}
		map.push(newRow);
	}
	//trace('flag map 2');
	roomArray = [];
	var roomCount = 0;
	while(roomCount < 100){
		var roomCenter = genRoom(map, rn(1,COLS),rn(1,ROWS),rn(2,6), rn(2,6))
		if(roomCenter)
		{
			roomArray.push(roomCenter);
			roomCount = 0;
		} else {
			roomCount++;
		}
	}
	//trace('flag map 3');
	var madeConnections = [];
	
	for(var i = 0; i < roomArray.length; i++){
		var x1 = roomArray[i][0];
		var y1 = roomArray[i][1];
		// Grab the closest room
		var closestDistance = 99;
		var closestX;
		var closestY;
		for(var k = 0; k < roomArray.length; k++){
			var x2 = roomArray[k][0];
			var y2 = roomArray[k][1];
			
			var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
			if(distance < closestDistance && distance > 0){
				var made = false;
				for(var m = 0; m < madeConnections.length; m++){
					var c = madeConnections[m];
					if(c[0] == x1 && c[1] == y1 && c[2] == x2 && c[3] == y2)made = true;
					if(c[0] == x2 && c[1] == y2 && c[2] == x1 && c[3] == y1)made = true;
				}
				if(!made){
					closestDistance = distance;
					closestX = x2;
					closestY = y2;
				}
			}
		}
		madeConnections.push([x1,y1,closestX,closestY]);
		var xLength = x1 - closestX;
		var yLength = y1 - closestY; 
		
		if(xLength < 0)xLength *= -1;
		if(yLength < 0)yLength *= -1;
		
		if(x1 < closestX){
			for(var j = x1; j <= closestX; j++){
				map[y1][j] = 1;
			}
		} else {
			for(var j = x1; j >= closestX; j--){
				map[y1][j] = 1;
			}
		}
		if(y1 < closestY){
			for(var j = y1; j <= closestY; j++){
				map[j][closestX] = 1;
			}
		} else {
			for(var j = y1; j >= closestY; j--){
				map[j][closestX] = 1;
			}
		}
	} 
	//trace('flag map 4');
	var success = true;
	for(var i = 0; i < roomArray.length - 1; i++){
		aStarGraph = new Graph(map);
		var startX = roomArray[i][0];
		var startY = roomArray[i][1];
		var endX = roomArray[i + 1][0];
		var endY = roomArray[i + 1][1];
		
		var start = aStarGraph.nodes[startY][startX];
		var end = aStarGraph.nodes[endY][endX];
		var result = astar.search(aStarGraph.nodes, start, end);
		
		if(result.length == 0)success = false;
	}
	
	if(!success){
		trace("returning false")
		return [];
	}
	//trace('checkSurrounding');	
	//trace("map, " + map.length);
	/*for(var y in map){
		//trace("y loop")
		for(var x in map[y]){
			//trace("x loop")
			if(!checkSurrounding(map,y,x))map[y][x] = -1;
		}
	}*/
	trace('returning map');
	return map;
}
//******************************************************************************************************
//******************************************************************************************************
function checkSurrounding(map,y, x){
	trace("check called");
	y = parseInt(y);
	x = parseInt(x);
	var checkYs = [y];
	var checkXs = [x];
	if(y > 0)checkYs.push(y - 1);
	if(y < ROWS - 1)checkYs.push(y + 1);
	if(x > 0)checkXs.push(x - 1);
	if(x < COLS - 1)checkXs.push(x + 1);

	for(var a in checkYs){
		for(var b in checkXs){
			var tY = checkYs[a];
			var tX = checkXs[b];

			if(tY == y && tX == x)continue;
			if(map[tY][tX] > 0) return true;
		}
	}

	return false;
}
//******************************************************************************************************
//******************************************************************************************************
function randomInt(max) {
	return Math.floor(Math.random() * max);
}
//******************************************************************************************************
//******************************************************************************************************
function rn(min, max) {
	return Math.round(Math.random() * (max - min)) + min;
}
//******************************************************************************************************
//******************************************************************************************************
function initActors() {
	// create actors at random locations
	actorList = [];
	actorMap = {};
	for (var e = 0; e < ACTORS; e++) {
		var actor = {x: 0,y: 0,hp: e == 0 ? 3 : 1}; // create new actor
		do { // pick a random position that is both a floor and not occupied
			actor.y = randomInt(ROWS);
			actor.x = randomInt(COLS);
		} while (currentMap[actor.y][actor.x] <= 0 || actorMap[actor.y + "_" + actor.x] != null);
		// add references to the actor to the actors list & map
		actorMap[actor.y + "_" + actor.x] = actor;
		actorList.push(actor);
	}
	player = actorList[0]; // the player is the first actor in the list
	livingEnemies = ACTORS - 1;
}
//******************************************************************************************************
//******************************************************************************************************
function initItems(){
	// One item per room, currently scattered randomly around the map, need to put 1 item per room
	itemList = [];
	itemMap = {};
	for(var e = 0; e < roomArray.length; e++){
		var item = {x:0, y:0, type:"COIN", frame:12};
		itemList.push(item);
	}
	// add a fifth of the rooms as mushrooms
	for(e = 0; e < roomArray.length / 5; e++){
		item = {x:0, y:0, type:"MUSHROOM", frame:14};
		itemList.push(item);
	}
	// add lots of grass
	for(e = 0; e < roomArray.length * 2; e++){
		item = {x:0, y:0, type:"GRASS", frame:13};
		itemList.push(item);
	}
	
	var completeItems = itemList.length;
	while(completeItems > 0){
		var tX = rn(0, COLS - 1);
		var tY = rn(0, ROWS - 1);
		if(currentMap[tY][tX] <= 0)continue;
		item = itemList[completeItems - 1];
		item.x = tX;
		item.y = tY;
		itemMap[item.y + "_" + item.x] = item;
		completeItems--;
	}
}
//******************************************************************************************************
//******************************************************************************************************
function drawActors() {
	for (var a in actorList) {
		if (actorList[a] != null && actorList[a].hp > 0) {
			var tileType = a == 0 ? 1 : 10;
			var playerSprite = game.add.sprite(TILESIZE * actorList[a].x, (TILESIZE * actorList[a].y) + TILESIZE, "dungeonSheet", tileType);
			actorDisplay.push(playerSprite);
		}
	}
	playerDisplay = actorDisplay[0];
}
//******************************************************************************************************
//******************************************************************************************************
function drawItems() {
	itemDisplay = [];
	for (var a in itemList) {
		if (itemList[a] != null) {
			var tileType = itemList[a].frame;
			var playerSprite = game.add.sprite(TILESIZE * itemList[a].x, (TILESIZE * itemList[a].y) + TILESIZE, "dungeonSheet", tileType);
			itemDisplay.push(playerSprite);
}}}
//******************************************************************************************************
//******************************************************************************************************
function drawTopBar() {
	var startX = vCOLS * TILESIZE;
	topDisplay = [];
	for(var i = 0; i < vCOLS; i++){
		var bgTile = game.add.sprite(i * TILESIZE,0,"dungeonSheet",0);
		bgTile.fixedToCamera = true;
		bgTile.cameraOffset = new Phaser.Point(i * TILESIZE,0);
	}
	// Heart containers
	for(var a = 1; a <= actorList[0].hp; a++){
		var item = game.add.sprite(0, 0, "dungeonSheet",5);
		item.fixedToCamera = true;
		item.cameraOffset = new Phaser.Point(a * TILESIZE,0);
		item.FULL = true;
		topDisplay.unshift(item);
	}
	// Man icon
	item = game.add.sprite(0, 0, "dungeonSheet",4);
	item.fixedToCamera = true;
	item.cameraOffset = new Phaser.Point(0,0);
	topDisplay.unshift(item);
	
	item = game.add.sprite(0,0,"dungeonSheet",12);
	item.fixedToCamera = true;
	item.cameraOffset = new Phaser.Point(680,0);
	
	scoreArray = [];
	for(var i = 0; i < 3; i++){
		item = game.add.sprite(0,0,"numberSheet",0);
		item.fixedToCamera = true;
		item.cameraOffset = new Phaser.Point(730 + (i * 30),12);
		scoreArray.push(item);
	}
}
//******************************************************************************************************
//******************************************************************************************************
function positionObjects() {
	for(var a in itemList){
		if(itemList[a] == null && itemDisplay[a] != null){
			itemDisplay[a].kill();
		}else{
			itemDisplay[a].x = itemList[a].x * TILESIZE;
			itemDisplay[a].y = (itemList[a].y * TILESIZE) + TILESIZE;
		}
	}
	for(var a in actorList){
		if(actorList[a] == null && actorDisplay[a] != null){
			actorDisplay[a].kill();
		}else{
			actorDisplay[a].x = actorList[a].x * TILESIZE;
			actorDisplay[a].y = (actorList[a].y * TILESIZE) + TILESIZE;
		}
	}
	playerCameraOffset.x = playerDisplay.x + 32;
	playerCameraOffset.y = playerDisplay.y;
}
//******************************************************************************************************
//******************************************************************************************************
function canGo(actor,dir) {
	return 	actor.x+dir.x >= 0 &&
			actor.x+dir.x <= COLS - 1 &&
			actor.y+dir.y >= 0 &&
			actor.y+dir.y <= ROWS - 1 &&
			currentMap[actor.y+dir.y][actor.x +dir.x] == 1;
}
//******************************************************************************************************
//******************************************************************************************************
function moveTo(actor, dir) { // check if actor can move in the given direction
	if (!canGo(actor,dir)) 
		return false;
	var newKey = (actor.y + dir.y) +'_' + (actor.x + dir.x); // moves actor to the new location
	if (actorMap[newKey] != null) { // if the destination tile has an actor in it 
		if(actorMap[newKey] != player && actor != player)return true;
		//decrement hitpoints of the actor at the destination tile
		var victim = actorMap[newKey];
		hitActor(actor, victim, dir, newKey);
	} else {
		confirmMove(actor, dir);
	}
	return true;
}
//******************************************************************************************************
//******************************************************************************************************
function hitActor(attacker, victim, dir, newKey) {
	victim.hp--;
	if(victim == player){
		for(var id in topDisplay){
			var heart = topDisplay[id];
			if(heart.FULL == true){
				var point = heart.cameraOffset; 
				var pos = [heart.x, heart.y];
				heart.FULL = false;
				heart.kill();
				heart = game.add.sprite(pos[0],pos[1],"dungeonSheet",6);
				heart.fixedToCamera = true;
				heart.cameraOffset = point;
				heart.FULL = false;
				topDisplay[id] = heart;
				break;
	}	}	}
	// if it's dead remove its reference 
	if (victim.hp == 0) {
		actorMap[newKey]= null;
		actorList[actorList.indexOf(victim)]=null;
		if(victim!=player) {
			livingEnemies--;
			if (livingEnemies == 0) {
				// victory message
				var victory = game.add.text(playerDisplay.x, playerDisplay.y, 'Victory!\nCtrl+r to restart', { fill : '#2e2', align: "center" } );
				victory.anchor.setTo(0.5,0.5);
		}	}
		confirmMove(attacker, dir);
}	}
//******************************************************************************************************
//******************************************************************************************************
function confirmMove(actor, dir){
	// remove reference to the actor's old position
	actorMap[actor.y + '_' + actor.x]= null;
	// update position
	actor.y+=dir.y;
	actor.x+=dir.x;
	// add reference to the actor's new position
	actorMap[actor.y + '_' + actor.x]=actor;
}
//******************************************************************************************************
//******************************************************************************************************
function onKeyUp(event) { // act on player input
	if(player.hp < 1)return;
	if(!npcPhase){
		switch (event.keyCode) {
			case Phaser.Keyboard.LEFT: npcPhase = moveTo(player, {x:-1, y:0}); break;
			case Phaser.Keyboard.RIGHT: npcPhase = moveTo(player,{x:1, y:0}); break;
			case Phaser.Keyboard.UP: npcPhase = moveTo(player, {x:0, y:-1}); break;
			case Phaser.Keyboard.DOWN: npcPhase = moveTo(player, {x:0, y:1}); break;
			case Phaser.Keyboard.SPACEBAR: npcPhase = true; break;
		}
}	}
//******************************************************************************************************
//******************************************************************************************************
function aiAct(actor) {
	var directions = [ { x: -1, y:0 }, { x:1, y:0 }, { x:0, y: -1 }, { x:0, y:1 } ];	
	var startX = actor.x;
	var startY = actor.y;
	var endX = player.x;
	var endY = player.y;
	
	var start = aStarGraph.nodes[startY][startX];
	var end = aStarGraph.nodes[endY][endX];
	var result = astar.search(aStarGraph.nodes, start, end);
	
	if(result.length == 0 || result.length > 5){
		var check = 5;
		while (!moveTo(actor, directions[randomInt(directions.length)]) && check > 0) { check--; };
	}else{
		// Because of the way the map was generated, the X and Y values in the aStarGraph are inverted
		var xy = {x:result[0].y - actor.x, y:result[0].x - actor.y};
		if(!moveTo(actor, xy)){
			check = 5;
			while (!moveTo(actor, directions[randomInt(directions.length)]) && check > 0) { check--; };
		}
	}

	if (player.hp < 1) { // game over message
		var gameOver = game.add.text(playerDisplay.x, playerDisplay.y, 'Game Over\nCtrl+r to restart', { fill : '#e22', align: "center" } );
		gameOver.anchor.setTo(0.5,0.5);
	}	
}
//******************************************************************************************************
//******************************************************************************************************
function genRoom(map, xPos, yPos, width, height){
	//trace('genRoom 1');
	if(yPos + height >= ROWS - 1)return false;
	if(xPos + width >= COLS - 1)return false;
	var intersect = false;
	//trace('genRoom 2');
	for (var y = yPos - 1; y < yPos + height + 1; y++) {
		//trace('genRoom 2A');
		for (var x = xPos - 1; x < xPos + width + 1; x++) {
			//trace('genRoom 2B ' + y);
			//trace('map ' + map);
			//trace('map.length ' + map.length);
			if(y < 0 || y >= map.length)continue;
			//trace('genRoom 2Ba');
			if(x < 0 || x >= map[y].length)continue;
			//trace('genRoom 2Bb');
			if(map[y][x] != 0 && map[y][x] != null) return false;
			//trace('genRoom 2Bc');
	}	}
	//trace('genRoom 3');
	for (var y = yPos; y < yPos + height; y++) {
		for (var x = xPos; x < xPos + width; x++) {
			map[y][x] = 1;
	}	}
	//trace('genRoom 4');
	var roomCenter = [Math.floor(xPos + (width / 2)), Math.floor(yPos + (height / 2))];
	return roomCenter;
}
//******************************************************************************************************
//******************************************************************************************************
function checkItemHit(){
	var newKey = player.y +'_' + player.x;
	if(itemMap[newKey] != null){
		var item = itemMap[newKey];
		switch (item.type){
			case "COIN": 
				itemMap[newKey] = null;
				itemList[itemList.indexOf(item)]=null;
				grabCoin(); 
				break;
}	}	}
//******************************************************************************************************
//******************************************************************************************************
function grabCoin(){
	score++;
	var stringScore = score.toString();
	while(stringScore.length < 3)stringScore = "0" + stringScore;
	for(var i = 0; i < scoreArray.length; i++)
	{
		var item = scoreArray[i];
		item.animations.frame = parseInt(stringScore.charAt(i),10);
	}
}
//******************************************************************************************************
//******************************************************************************************************
function trace(e){
	if(traceY > 600){
		traceGroup.removeAll();
		traceY = 0;
	}
	game.add.text(0, traceY, e, { fill : '#fff', align: "left" }, traceGroup );
	traceY += 30;
}
//******************************************************************************************************
//******************************************************************************************************
// aStar and graph code
var astar={init:function(e){for(var t=0,n=e.length;t<n;t++){for(var r=0,i=e[t].length;r<i;r++){var s=e[t][r];s.f=0;s.g=0;s.h=0;s.cost=s.type;s.visited=false;s.closed=false;s.parent=null}}},heap:function(){return new BinaryHeap(function(e){return e.f})},search:function(e,t,n,r,i){astar.init(e);i=i||astar.manhattan;r=!!r;var s=astar.heap();s.push(t);while(s.size()>0){var o=s.pop();if(o===n){var u=o;var a=[];while(u.parent){a.push(u);u=u.parent}return a.reverse()}o.closed=true;var f=astar.neighbors(e,o,r);for(var l=0,c=f.length;l<c;l++){var h=f[l];if(h.closed||h.isWall()){continue}var p=o.g+h.cost;var d=h.visited;if(!d||p<h.g){h.visited=true;h.parent=o;h.h=h.h||i(h.pos,n.pos);h.g=p;h.f=h.g+h.h;if(!d){s.push(h)}else{s.rescoreElement(h)}}}}return[]},manhattan:function(e,t){var n=Math.abs(t.x-e.x);var r=Math.abs(t.y-e.y);return n+r},neighbors:function(e,t,n){var r=[];var i=t.x;var s=t.y;if(e[i-1]&&e[i-1][s]){r.push(e[i-1][s])}if(e[i+1]&&e[i+1][s]){r.push(e[i+1][s])}if(e[i]&&e[i][s-1]){r.push(e[i][s-1])}if(e[i]&&e[i][s+1]){r.push(e[i][s+1])}if(n){if(e[i-1]&&e[i-1][s-1]){r.push(e[i-1][s-1])}if(e[i+1]&&e[i+1][s-1]){r.push(e[i+1][s-1])}if(e[i-1]&&e[i-1][s+1]){r.push(e[i-1][s+1])}if(e[i+1]&&e[i+1][s+1]){r.push(e[i+1][s+1])}}return r}}
function Graph(e){var t=[];for(var n=0;n<e.length;n++){t[n]=[];for(var r=0,i=e[n];r<i.length;r++){t[n][r]=new GraphNode(n,r,i[r])}}this.input=e;this.nodes=t}function GraphNode(e,t,n){this.data={};this.x=e;this.y=t;this.pos={x:e,y:t};this.type=n}function BinaryHeap(e){this.content=[];this.scoreFunction=e}var GraphNodeType={OPEN:1,WALL:0};Graph.prototype.toString=function(){var e="\n";var t=this.nodes;var n,r,i,s;for(var o=0,u=t.length;o<u;o++){n="";r=t[o];for(i=0,s=r.length;i<s;i++){n+=r[i].type+" "}e=e+n+"\n"}return e};GraphNode.prototype.toString=function(){return"["+this.x+" "+this.y+"]"};GraphNode.prototype.isWall=function(){return this.type==GraphNodeType.WALL};BinaryHeap.prototype={push:function(e){this.content.push(e);this.sinkDown(this.content.length-1)},pop:function(){var e=this.content[0];var t=this.content.pop();if(this.content.length>0){this.content[0]=t;this.bubbleUp(0)}return e},remove:function(e){var t=this.content.indexOf(e);var n=this.content.pop();if(t!==this.content.length-1){this.content[t]=n;if(this.scoreFunction(n)<this.scoreFunction(e)){this.sinkDown(t)}else{this.bubbleUp(t)}}},size:function(){return this.content.length},rescoreElement:function(e){this.sinkDown(this.content.indexOf(e))},sinkDown:function(e){var t=this.content[e];while(e>0){var n=(e+1>>1)-1,r=this.content[n];if(this.scoreFunction(t)<this.scoreFunction(r)){this.content[n]=t;this.content[e]=r;e=n}else{break}}},bubbleUp:function(e){var t=this.content.length,n=this.content[e],r=this.scoreFunction(n);while(true){var i=e+1<<1,s=i-1;var o=null;if(s<t){var u=this.content[s],a=this.scoreFunction(u);if(a<r)o=s}if(i<t){var f=this.content[i],l=this.scoreFunction(f);if(l<(o===null?r:a)){o=i}}if(o!==null){this.content[e]=this.content[o];this.content[o]=n;e=o}else{break}}}}