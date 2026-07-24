const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Import Assets
const sp_civ = document.getElementById("civ_sp");
const sp_croc = document.getElementById("croc_sp");
const sp_bad = document.getElementById("bad_sp");
const sp_player = document.getElementById("player_sp");
const sp_flood = document.getElementById("flood_sp");

let framesDrawn = 0;

// Physics Settings
const ACCEL = 0.55
const FRICTION = 0.92;
const MAX_SPEED = 5; 
const GRAVITY = 0.25;
const JUMP_FORCE = -12;
const PLATFORM_LEVELS = [325, 475, 625]; // tweak these to feel right

let gameState = 'start';
let enableMovement = false;
let frameCount = 0;
let worldX = 0;

// Flood Engine
var floodX; 
var floodBaseSpeed; 

const keys = { left: false, right: false, down: false};
const player = {
	x: canvas.width, y: 100,
	spriteW: 186, totalFrames: 3,
	frameSrc: 0, currFrame: 0,
	w: 62, h: 60,
	vx: 0, vy: 0,
	onGround: false,
	hp: 3, rescues: 0, invuln: 0
};

let isPlayerDrawn = false;

let highScore = 0;
let rescueMilestone = 0;

let platforms = [];
let entities = []; 

function initGame() {
	document.getElementById('flood-bar').style.width = `0%`;
	Object.assign(player, { x: 400, y: 100, vx: 0, vy: 0, hp: 3, rescues: 0, invuln: 0 });
	worldX = 0; 
	floodX = -750; 
	floodBaseSpeed = 2.5;
	platforms = [[{}], [{ x: 0, y: 450, w: 1000, h: 475, angle: 0, color: '#805fa8'}], [{}]];
	entities = [];
	rescueMilestone = 0;
	generateLevel(850);
	gameState = 'playing';
	gameLoop();
	animate_player();
	framesDrawn = 0;
	
	document.getElementById('hi-score-notice').style.display = 'none';
	
	if (typeof(Storage) != "undefined") {
		console.log("Your browser supports Web storage, your highscores will be saved.");
		if (localStorage.highScore) highScore = localStorage.getItem("highScore");
		else {
			localStorage.setItem("highScore", 0);
			highScore = localStorage.getItem("highScore");
		}
	}
	else console.warn("Your browser has no Web storage support. Your highscores will not be saved.");
}

function createPop(toggleHP, toggleDmg) {
	const pop = document.createElement('div');
	if (toggleHP) {
		pop.className = 'hp-pop';
		pop.textContent = '+1 ❤️';
	}
	else {
		if (toggleDmg) {
			pop.className = 'dmg-pop';
			pop.textContent = '-1 💔';
		}
		else {
			pop.className = 'rescue-pop';
			pop.textContent = '+1 RESCUE';
		}
	}
	pop.style.left = player.x + 'px';
	pop.style.top = player.y + 'px';
	document.getElementById('game-container').appendChild(pop);
	setTimeout(() => pop.remove(), 800);
}

function generateLevel(startX) {
	let x = startX;

	for (let i = 0; i < 10; i++) {
		let gap = 200 + Math.random() * 150;
		let w = 350 + Math.random() * 150;
		let color;
		
		x += gap;
		
		// pick one of the 3 fixed heights
		let y = PLATFORM_LEVELS[Math.floor(Math.random() * PLATFORM_LEVELS.length)];
		
		if (y == PLATFORM_LEVELS[0]) color = '#70577c';
		else if (y == PLATFORM_LEVELS[1]) color = '#3d224a';
		else color = '#7b5ca2';

		let platform = { x, y, w, h: 800, angle: 0, color }; // no slope now
		
		switch (y) {
			case PLATFORM_LEVELS[0]:
				let platLvl1 = platforms[0];
				platLvl1.push(platform);
				platforms.splice(0, 1, platLvl1)
			break;
			
			case PLATFORM_LEVELS[1]:
				let platLvl2 = platforms[1];
				platLvl2.push(platform);
				platforms.splice(1, 1, platLvl2)
			break;
			
			case PLATFORM_LEVELS[2]:
				let platLvl3 = platforms[2];
				platLvl3.push(platform);
				platforms.splice(2, 1, platLvl3)
			break;
		}
		
		// Entities (same logic, just adjusted to new flat platforms)
		const rand = Math.random();
		
		let entiX = x + (w * 0.35);
		let entiDistX = entities.length > 0 ? Math.abs((entities[entities.length-1].x) - entiX) : 50;
		let entiDistY = entities.length > 0 ? entities[entities.length-1].y == y - 50 : false;
		
		if (entiDistX < 50 && entiDistY) entiX =+ 275;
		
		if (rand > 0.7) {
			entities.push({ x: entiX, y: y - 50, type: 'civ', collected: false, timer: 0 });
		} else if (rand > 0.5) {
			entities.push({ x: entiX, y: y - 30, type: 'croc', active: true });
		} else if (rand > 0.3) {
			entities.push({ x: entiX, y: y - 50, type: 'bad', active: true });
		}
	}
}

function addLives() {
	let goal = 25;
	
	if (rescueMilestone >= goal) {
		player.hp++;
		rescueMilestone -= goal;
		console.log("25 more have been rescued! +1HP");
		setTimeout(() => createPop(true, false), 100);
	}
}

function update() {
	if (player.invuln > 0) player.invuln--;

	if (keys.right) player.vx += ACCEL;
	else if (keys.left) player.vx -= ACCEL;
	else player.vx *= FRICTION;
  
	player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));
	player.vy += GRAVITY;
	player.y += player.vy;

	if (typeof(Storage) != "undefined") {
		if (player.rescues > highScore) {
			document.getElementById('hi-score-notice').style.display = 'inline';
			highScore = player.rescues;
		}
	}
	else highscore = 'Unsupported';
	
	addLives();
	
	player.onGround = false;
  
	platforms.forEach(level => {
		level.forEach(p => {
			let relX = (player.x + worldX + player.w/2) - p.x;
			if (relX > 0 && relX < p.w) {
			  let surfaceY = p.y + (relX * p.angle);
			  if (player.y + player.h > surfaceY && player.y + player.h < surfaceY + 40) {
				player.y = surfaceY - player.h; player.vy = 0; player.onGround = true;
				if (!enableMovement) {
					enableMovement = player.onGround;
					keys.down = false;
				}
			  }
			}
		});
	});

	worldX += player.vx;
	
	floodBaseSpeed += 0.0001;
	let playerWorldX = player.x + worldX;
	let distFromFlood = playerWorldX - floodX;
	let catchUp = distFromFlood > 500 ? (distFromFlood - 500) * 0.06 : 0;
	floodX += (floodBaseSpeed + catchUp);

	entities.forEach(e => {
		if (e.collected || e.active === false) return;
		let dist = Math.abs((player.x + worldX) - e.x);
		let verticalDist = Math.abs(player.y - e.y);

		if (dist < 50 && verticalDist < 60) {
			if (e.type === 'civ') {
				if (Math.abs(player.vx) < 5.0) {
					e.timer++;
					if (e.timer > 10) { player.rescues++; rescueMilestone++; createPop(false, false); e.collected = true; }
				} else { e.timer = 0; }
			} else if ((e.type === 'croc' || e.type === 'bad') && player.invuln === 0) {
				createPop(false, true);
				player.hp--;
				player.invuln = 120; 
				player.vx = -12; 
				player.vy = -5; 
			}
		}
	});

	if (playerWorldX < floodX || player.y > canvas.height || player.hp <= 0) {
		gameState = 'gameOver';
		enableMovement = false;
		keys.left = false;
		keys.right = false;
		keys.down = true;
		localStorage.setItem("highScore", highScore);
	}
	
	document.getElementById('warning-overlay').style.display = (distFromFlood < 400) ? 'flex' : 'none';
	if (platforms[1][platforms[1].length-1].x - worldX < canvas.width * 2) generateLevel(platforms[1][platforms[1].length-1].x + 200);
}

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.save();
	ctx.translate(-worldX, 0);
		
	platforms.forEach(level => {  
		level.forEach(p => {
			ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
			ctx.fillStyle = p.color; ctx.fillRect(0, 0, p.w, 800);
			ctx.restore();
		});
	});
	
	entities.forEach(e => {
		if (e.collected || e.active === false) return;
		
		if (e.type === 'civ') ctx.fillStyle = '#fbbf24';
		else if (e.type === 'croc') ctx.fillStyle = '#22c55e'; 
		else if (e.type === 'bad') ctx.fillStyle = '#78350f'; 
		
		switch (e.type) {
			case "civ":
				ctx.drawImage(sp_civ, e.x, e.y - 23, 50, 73);
				break;
			
			case "croc":
				ctx.drawImage(sp_croc, e.x, e.y - 20, 83, 50);
				break;
			
			case "bad":
				ctx.drawImage(sp_bad, e.x, e.y - 21, 63, 72);
				break;
		}
		
		if (e.type === 'civ' && e.timer > 0) {
			ctx.fillStyle = '#14283d'; ctx.fillRect(e.x, e.y - 50, 60, 10);
			ctx.fillStyle = '#fbbf24'; ctx.fillRect(e.x, e.y - 50, (e.timer/10)*60, 10);
		}
	});
	
	floodMvmnt();
	ctx.restore();
	
	document.getElementById('hp-display').textContent = 'HP: ' + '❤️'.repeat(player.hp);
	document.getElementById('score-display').textContent = 'RESCUES: ' + player.rescues;
	document.getElementById('hiscore').textContent = highScore;
	
	if (gameState == "playing") {
		let prox = 100 - (((player.x + worldX) - floodX) / 6);
		if (prox < 0) prox = 0;
		document.getElementById('flood-bar').style.width = `${prox}%`;
	}
	else document.getElementById('flood-bar').style.width = `0%`;
		
}

function animate_player() {
	if (gameState != "playing") {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		framesDrawn = 0;
		return;
	}
	
	ctx.restore();
	requestAnimationFrame(animate_player);
	
	player.currFrame = player.currFrame % player.totalFrames;
	player.frameSrc = player.currFrame * player.w
	ctx.drawImage(sp_player, player.frameSrc , 0, player.w, player.h, player.x, player.y, player.w, player.h);
	
	framesDrawn++;
	if (framesDrawn >= 8) {
		player.currFrame++;	
		framesDrawn = 0;
	}
}

function floodMvmnt() {
	let flood_w = canvas.height * (1580 / 1058);
	let flood_h = canvas.height;
		
	ctx.drawImage(sp_flood, floodX - (flood_w * .7), flood_h - canvas.height, flood_w, flood_h);
}

function gameLoop() {
	var CurrentFrame;
	  
	if (gameState === 'playing') { update(); draw(); requestAnimationFrame(gameLoop); }
	else if (gameState !== 'start') { 
		document.getElementById('menu-screen').style.display = 'flex'; 
		document.getElementById('instructions-screen').style.display = 'flex'; 
		if (gameState === 'gameOver') {
			document.getElementById('menu-screen').children[1].textContent = 'GAME OVER';
			document.getElementById('enter-button').textContent = 'TRY AGAIN';
			document.getElementById('gameover-scores').style.display = 'inline';
			document.getElementById('hiscore-menu').innerHTML = highScore;
			document.getElementById('final-score').innerHTML = player.rescues;
		}
	}
}

window.addEventListener('keydown', e => {
	if (enableMovement === false) return; // Ignores listener if movement is disabled
	
	if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
	if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
	if ((e.code === 'KeyS' || e.code === 'ArrowDown') && player.onGround) {
		if (Math.trunc(player.y + player.h) < PLATFORM_LEVELS[2] ) player.y += 50;
	}
	if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && player.onGround) { player.vy = JUMP_FORCE; player.onGround = false;}
});

window.addEventListener('keyup', e => {
	if (enableMovement === false) return; // Ignores listener if movement is disabled
  
	if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
	if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
});

document.getElementById('enter-button').addEventListener('click', () => { 
	document.getElementById('menu-screen').style.display = 'none'; 
});

document.getElementById('start-button').addEventListener('click', () => { 
	document.getElementById('instructions-screen').style.display = 'none'; 
	document.getElementById('start-button').style.display = 'inline-block'; 
	initGame(); 
});

window.addEventListener('resize', () => { 
	canvas.width = window.innerWidth; 
	canvas.height = window.innerHeight; 
});

window.dispatchEvent(new Event('resize'));