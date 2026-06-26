const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Import Assets
const sp_flood = document.getElementById("flood_sp");
const sp_civ = document.getElementById("civ_sp");
const sp_croc = document.getElementById("croc_sp");
const sp_bad = document.getElementById("bad_sp");
const sp_player = document.getElementById("player_sp");

// Animations
const croc_anim = {
	spriteW: 300, totalFrames: 4,
	frameSrc: 0, currFrame: 0,
	w: 83, h: 50,
};

let framesDrawn = 0;

// Physics Settings
const ACCEL = 0.55
const FRICTION = 0.92;
const MAX_SPEED = 5; 
const GRAVITY = 0.25;
const JUMP_FORCE = -12;
const PLATFORM_LEVELS = [300, 450, 600]; // tweak these to feel right

let gameState = 'start';
let enableMovement = false;
let frameCount = 0;
let worldX = 0;
let distanceToGoal = 100;

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
	Object.assign(player, { x: 400, y: 100, vx: 0, vy: 0, hp: 3, rescues: 0, invuln: 0 });
	worldX = 0; 
	distanceToGoal = 100;
	floodX = -750; 
	floodBaseSpeed = 0;
	platforms = [{ x: 0, y: 450, w: 1200, h: 500, angle: 0 }];
	entities = [];
	rescueMilestone = 0;
	generateLevel(1200);
	gameState = 'playing';
	gameLoop();
	animate_player();
	framesDrawn = 0;
	if (typeof(Storage) !== "undefined") {
		console.log("Your browser supports Web storage, your highscores will be saved.");
		if (localStorage.highScore) highScore = localStorage.getItem("highScore");
		else {
			localStorage.setItem("highScore", 0);
			highScore = localStorage.getItem("highScore");
		}
	}
	else
		console.warn("Your browser has no Web storage support, your highscores will not be saved.");
}

function createPop(toggleHP) {
	const pop = document.createElement('div');
	if (toggleHP) {
		pop.className = 'hp-pop';
		pop.textContent = '+1 ❤️';
	}
	else {
		pop.className = 'rescue-pop';
		pop.textContent = '+1 RESCUE';
	}
	pop.style.left = player.x + 'px';
	pop.style.top = player.y + 'px';
	document.getElementById('game-container').appendChild(pop);
	setTimeout(() => pop.remove(), 800);
}

function generateLevel(startX) {
	let x = startX;

	for (let i = 0; i < 10; i++) {
		let gap = 150 + Math.random() * 150;
		let w = 200 + Math.random() * 300;

		// pick one of the 3 fixed heights
		let y = PLATFORM_LEVELS[Math.floor(Math.random() * PLATFORM_LEVELS.length)];

		x += gap;

		let platform = { x, y, w, h: 800, angle: 0 }; // no slope now
		platforms.push(platform);

		// Entities (same logic, just adjusted to new flat platforms)
		const rand = Math.random();
		
		if (rand > 0.7) {
			entities.push({ x: x + w/2, y: y - 50, type: 'civ', collected: false, timer: 0 });
		} else if (rand > 0.5) {
			entities.push({ x: x + w/3, y: y - 30, type: 'croc', active: true });
		} else if (rand > 0.3) {
			entities.push({ x: x + (w * 0.7), y: y - 50, type: 'bad', active: true });
		}
	}
}

function addLives() {
	let goal = 25;
	
	if (rescueMilestone >= goal) {
		player.hp++;
		rescueMilestone -= goal;
		console.log("10 more have been rescued! +1HP");
		setTimeout(() => createPop(true), 100);
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

	if (player.rescues > highScore) highScore = player.rescues;
	addLives();
	
	player.onGround = false;
  
	platforms.forEach(p => {
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

	worldX += player.vx;
	distanceToGoal -= player.vx / 100;
	
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
				if (e.timer > 10) { player.rescues++; rescueMilestone++; createPop(false); e.collected = true; }
			} else { e.timer = 0; }
			} else if ((e.type === 'croc' || e.type === 'bad') && player.invuln === 0) {
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
	// if (distanceToGoal <= 0) gameState = 'win';

	document.getElementById('warning-overlay').style.display = (distFromFlood < 400) ? 'flex' : 'none';
	if (platforms[platforms.length-1].x - worldX < canvas.width * 2) generateLevel(platforms[platforms.length-1].x + 200);
}

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.save();
	ctx.translate(-worldX, 0);
	
	platforms.forEach(p => {  
		ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
		ctx.fillStyle = '#1a1a1a99'; ctx.fillRect(0, 0, p.w, 800);
		ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, p.w, 6);
		
		if (p.y == PLATFORM_LEVELS[1]) platforms.zIndex = 2;
		else if (p.y == PLATFORM_LEVELS[2]) platforms.zIndex = 3;
		
		ctx.restore();
	});
	
	entities.forEach(e => {
		if (e.collected || e.active === false) return;
		
		if (e.type === 'civ') ctx.fillStyle = '#fbbf24';
		else if (e.type === 'croc') ctx.fillStyle = '#22c55e'; 
		else if (e.type === 'bad') ctx.fillStyle = '#78350f'; 
		
		switch (e.type) {
			case "civ":
				ctx.drawImage(sp_civ, e.x - 15, e.y - 23, 50, 73);
				break;
			
			case "croc":
				// animate_croc(e); // WARNING: Dramatically drops performance on spawn
				ctx.drawImage(
					sp_croc,
					e.x - 15, e.y - 20,
					croc_anim.w, croc_anim.h
				);
				break;
			
			case "bad":
				ctx.drawImage(sp_bad, e.x - 15, e.y - 21, 63, 72);
				break;
		}
		
		if (e.type === 'civ' && e.timer > 0) {
			ctx.fillStyle = '#14283d'; ctx.fillRect(e.x - 20, e.y - 50, 60, 10);
			ctx.fillStyle = '#fbbf24'; ctx.fillRect(e.x - 20, e.y - 50, (e.timer/10)*60, 10);
		}
	});

	
	/* Old Wave */
	let grad = ctx.createLinearGradient(floodX - 400, 0, floodX, 0);
	grad.addColorStop(0, '#ff0000'); grad.addColorStop(1, '#ff0000');
	ctx.fillStyle = grad; ctx.fillRect(floodX - 3000, 0, 3000, canvas.height);
	ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath();
	ctx.moveTo(floodX, 0);
	for(let i=0; i<canvas.height; i+=25) ctx.lineTo(floodX + Math.sin((frameCount+i)*0.1)*10, i);
	ctx.stroke();
	
	ctx.restore();
	
	if (!(player.invuln % 4 > 2)) {
		// ctx.fillStyle = '#3b82f6';
		// ctx.fillRect(player.x, player.y, player.w, player.h);
		// ctx.strokeStyle = 'white'; ctx.strokeRect(player.x, player.y, player.w, player.h);
		// if (!isPlayerDrawn) animate_player();
	}

	document.getElementById('hp-display').textContent = 'HP: ' + '❤️'.repeat(player.hp);
	document.getElementById('score-display').textContent = 'RESCUES: ' + player.rescues;
	document.getElementById('hiscore').textContent = highScore;
	// document.getElementById('dist-display').textContent = `${Math.max(0, Math.floor(distanceToGoal))}m TO SAFETY`;
	let prox = Math.min(100, (1 - ((player.x + worldX) - floodX) / 800) * 100);
	document.getElementById('flood-bar').style.width = Math.max(0, prox) + '%';
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

function animate_croc(e) {
	requestAnimationFrame(animate_croc);
				
	croc_anim.currFrame = croc_anim.currFrame % croc_anim.totalFrames;
	croc_anim.frameSrc = croc_anim.currFrame * croc_anim.w
	ctx.drawImage(
		sp_croc, croc_anim.frameSrc, 0,
		croc_anim.w, croc_anim.h,
		e.x - 15, e.y - 15,
		croc_anim.w, croc_anim.h
	);
	
	if (framesDrawn >= 8) croc_anim.currFrame++;
}

function floodMvmnt() {
	let flood_w = canvas.height * (867 / 1058);
	let flood_h = canvas.height;
	ctx.drawImage(sp_flood, 0, 0, flood_w, flood_h);
	ctx.moveTo(floodX, 0);
}

function gameLoop() {
	var CurrentFrame;
	  
	if (gameState === 'playing') { update(); draw(); requestAnimationFrame(gameLoop); }
	else if (gameState !== 'start') { 
		document.getElementById('menu-screen').style.display = 'flex'; 
		if (gameState === 'gameOver') {
			document.querySelector('h1').textContent = 'GAME OVER';
			document.getElementById('start-button').textContent = 'TRY AGAIN';
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
	if (e.code === 'Space' && player.onGround) { player.vy = JUMP_FORCE; player.onGround = false;}
});

window.addEventListener('keyup', e => {
	if (enableMovement === false) return; // Ignores listener if movement is disabled
  
	if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
	if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
});

document.getElementById('start-button').addEventListener('click', () => { 
	document.getElementById('menu-screen').style.display = 'none'; 
	document.getElementById('start-button').style.display = 'inline-block'; 
	initGame(); 
});

window.addEventListener('resize', () => { 
	canvas.width = window.innerWidth; 
	canvas.height = window.innerHeight; 
});

window.dispatchEvent(new Event('resize'));