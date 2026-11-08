// 技能动画（设计文档 §13）：方块粒子 + 弹道；每技能必配
// playMoveAnim(game, move, from, targetOrPlayer, onHit)
const TYPE_COLORS = {
  normal: 0xE8E8D8, fire: 0xF08030, water: 0x6890F0, grass: 0x78C850,
  electric: 0xF8D030, rock: 0xB8A038, poison: 0xA040A0, ghost: 0x705898,
  ice: 0x98D8D8, psychic: 0xF85888,
};

export function projectileTo(game, mesh, from, to, dur, onArrive) {
  mesh.position.copy(from);
  game.combat.projectiles.push({
    mesh, t: 0, dur,
    update(t) {
      // 抛物线
      const h = Math.sin(t * Math.PI) * 1.2;
      mesh.position.lerpVectors(from, to, t);
      mesh.position.y += h;
      mesh.rotation.y += 0.2;
    },
    onArrive,
  });
}

function spawnTrail(game, from, to, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const t = i / count;
    game.particles.spawn(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t + 0.3,
      from.z + (to.z - from.z) * t,
      { color, count: 2, spread: 0.4, up: 0.5, life: 0.35, gravity: 0 });
  }
}

function makeBoltMesh(color) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color }));
  g.add(core);
  return g;
}

// target 为 Creature / Player / null
export function playMoveAnim(game, move, from, target, onHit) {
  const color = TYPE_COLORS[move.type] || 0xffffff;
  const targetPos = target
    ? (target.pos ? target.pos.clone().setY(target.pos.y + 0.7) : null)
    : null;
  const anim = move.anim || 'tackle';

  const finish = () => {
    if (targetPos) {
      game.particles.spawn(targetPos.x, targetPos.y, targetPos.z,
        { color, count: 16, spread: 2.8, up: 2.5, life: 0.5 });
    }
    onHit?.();
  };

  // 近战：攻击方前冲（此处简化为短延迟命中+冲击粒子）
  const melee = move.range <= 3;
  if (melee) {
    game.combat.projectiles.push({
      t: 0, dur: 0.22, update() {}, onArrive: finish,
    });
    if (targetPos) spawnTrail(game, from, targetPos, color, 4);
    return;
  }

  // 远程弹道：按属性给不同弹体表现
  const mesh = makeBoltMesh(color);
  game.scene.add(mesh);
  const dur = Math.max(0.18, from.distanceTo(targetPos || from) * 0.045);
  if (targetPos) {
    projectileTo(game, mesh, from, targetPos, dur, () => { game.scene.remove(mesh); finish(); });
  } else {
    game.scene.remove(mesh);
    onHit?.();
  }

  // 特殊动画附加表现
  switch (anim) {
    case 'thunderwave': {   // 环状电弧扩散
      for (let a = 0; a < Math.PI * 2; a += 0.5) {
        game.particles.spawn(from.x + Math.cos(a) * 0.8, from.y + 0.2, from.z + Math.sin(a) * 0.8,
          { color: 0xF8D030, count: 2, spread: 0.2, up: 0.4, life: 0.4, gravity: 0 });
      }
      break;
    }
    case 'willowisp': {     // 蓝紫鬼火
      for (let i = 0; i < 3; i++) {
        game.particles.spawn(from.x, from.y + 0.4 + i * 0.2, from.z,
          { color: 0x8888F8, count: 5, spread: 1, up: 1, life: 0.8, gravity: -0.5 });
      }
      break;
    }
    case 'hypnosis': {      // 紫色波纹
      game.particles.spawn(from.x, from.y + 0.5, from.z, { color: 0xA868D8, count: 12, spread: 1.2, up: 0.3, life: 0.8, gravity: 0 });
      break;
    }
    case 'thunder': {       // 落雷：目标头顶垂直电柱
      if (targetPos) {
        for (let y = 0; y < 6; y++) {
          game.particles.spawn(targetPos.x, targetPos.y + y * 0.8, targetPos.z,
            { color: 0xF8E858, count: 3, spread: 0.5, up: 0, life: 0.3, gravity: 0 });
        }
      }
      break;
    }
  }
}

// 进化动画粒子（§13）
export function evolutionParticles(game, pos) {
  game.particles.spawn(pos.x, pos.y + 1, pos.z, { color: 0xffffff, count: 30, spread: 2, up: 3, life: 1.2, gravity: -0.5 });
  game.particles.spawn(pos.x, pos.y + 1, pos.z, { color: 0xFCDC5F, count: 24, spread: 3, up: 4, life: 1.4, gravity: 2 });
}

// 治疗动画粒子
export function healParticles(game, pos) {
  game.particles.spawn(pos.x, pos.y + 0.5, pos.z, { color: 0x7AEF7A, count: 18, spread: 1, up: 2, life: 1, gravity: -1.5 });
}
