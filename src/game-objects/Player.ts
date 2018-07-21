import { Arrow } from './Arrow';
import { AbstractScene } from '../scenes/AbstractScene';
import { registry as REGISTRY_KEYS } from '../constants/registry';

const HIT_DELAY = 500;
const PLAYER_SPEED = 100;
const PLAYER_SHOOTING_TIME = 300;
const DISTANCE_BETWEEN_HEARTS = 15;
const PLAYER_RELOAD = 500;
const MAX_HP = 3;

export class Player {
  public gameObject: Phaser.Physics.Arcade.Sprite;
  private scene: AbstractScene;
  private maxHp: number;
  private orientation: 'up' | 'down' | 'left' | 'right';
  private lastTimeHit: number;
  private isLoading: boolean;
  private isShooting: boolean;
  private tomb: Phaser.GameObjects.Sprite;
  private hearts: Phaser.GameObjects.Sprite[];

  constructor(scene: AbstractScene, x: number, y: number) {
    this.scene = scene;

    const registryHp = this.scene.registry.get(REGISTRY_KEYS.PLAYER.HP);
    if (!registryHp) {
      this.scene.registry.set(REGISTRY_KEYS.PLAYER.HP, MAX_HP);
    }

    this.gameObject = scene.physics.add.sprite(x, y, 'player-idle-down', 0);
    this.orientation = 'down';
    this.lastTimeHit = new Date().getTime();
    this.gameObject.setCollideWorldBounds(true);
    this.gameObject.setOrigin(0.5, 0.7);
    this.gameObject.setSize(10, 10);
    this.gameObject.setDepth(10);
    this.isLoading = false;
    this.isShooting = false;
    this.tomb = null;

    this.hearts = [];
    this.initHearts();
  }

  public update(keyPressed) {
    if (!this.gameObject.active) {
      return;
    }
    this.gameObject.setVelocity(0);
    this.handleMovement(keyPressed);

    if (keyPressed.space) {
      this.punch();
    }

    const noKeyPressed = Object.values(keyPressed).filter(x => x).length === 0;
    if (noKeyPressed && !this.isLoading) {
      this.beIdle();
    }

    this.handleShootKey(keyPressed);
  }

  public canGetHit() {
    return new Date().getTime() - this.lastTimeHit > HIT_DELAY;
  }

  public loseHp() {
    this.addHp(-1);
    this.updateHearts();

    this.lastTimeHit = new Date().getTime();

    if (this.getHp() > 0) {
      return;
    }

    // Player dies
    if (!this.tomb) {
      this.tomb = this.scene.add.sprite(this.gameObject.x, this.gameObject.y, 'tomb').setScale(0.1);
    }
    this.gameObject.destroy();
  }

  private getHp(): number {
    return this.scene.registry.get(REGISTRY_KEYS.PLAYER.HP);
  }

  private setHp(newHp: number) {
    this.scene.registry.set(REGISTRY_KEYS.PLAYER.HP, newHp);
  }

  private addHp(hpToAdd: number) {
    const hp = this.scene.registry.get(REGISTRY_KEYS.PLAYER.HP);
    this.setHp(hp + hpToAdd);
  }

  private initHearts() {
    Array(MAX_HP)
      .fill(0)
      .map((_, i) => {
        return this.scene.add
          .sprite((i + 1) * DISTANCE_BETWEEN_HEARTS, DISTANCE_BETWEEN_HEARTS, 'heart-empty')
          .setScrollFactor(0)
          .setDepth(50);
      });

    this.hearts = Array(this.getHp())
      .fill(0)
      .map((_, i) => {
        return this.scene.add
          .sprite((i + 1) * DISTANCE_BETWEEN_HEARTS, DISTANCE_BETWEEN_HEARTS, 'heart')
          .setScrollFactor(0)
          .setDepth(100);
      });
  }

  private updateHearts() {
    this.hearts.map((heart, index) => {
      if (index >= this.getHp()) {
        heart.setAlpha(0);
      }
    });
  }

  private reload() {
    this.isLoading = true;
    this.scene.time.addEvent({
      delay: PLAYER_RELOAD,
      callback: this.readyToFire,
      callbackScope: this,
    });
  }

  private readyToFire() {
    this.isLoading = false;
  }

  private go(direction, shouldAnimate = true) {
    switch (direction) {
      case 'left':
        this.gameObject.setVelocityX(-PLAYER_SPEED);
        break;
      case 'right':
        this.gameObject.setVelocityX(PLAYER_SPEED);
        break;
      case 'up':
        this.gameObject.setVelocityY(-PLAYER_SPEED);
        break;
      case 'down':
        this.gameObject.setVelocityY(PLAYER_SPEED);
        break;
      default:
        break;
    }

    if (!shouldAnimate) {
      return;
    }

    this.gameObject.setFlipX(direction === 'left');
    this.orientation = direction;
    this.gameObject.play(`player-move-${direction}`, true);
  }

  private handleHorizontalMovement(keyPressed) {
    const isUpDownPressed = keyPressed.up || keyPressed.down;

    if (keyPressed.left) {
      this.go('left', !isUpDownPressed);
      return;
    }

    if (keyPressed.right) {
      this.go('right', !isUpDownPressed);
      return;
    }
  }

  private handleVerticalMovement(keyPressed) {
    if (keyPressed.up) {
      this.go('up');
    } else if (keyPressed.down) {
      this.go('down');
    }
  }

  private handleMovement(keyPressed) {
    if (this.isShooting) {
      return;
    }
    this.handleHorizontalMovement(keyPressed);
    this.handleVerticalMovement(keyPressed);
  }

  private punch() {
    const animSwitch = {
      down: { flip: false, anim: 'player-attack-down' },
      up: { flip: false, anim: 'player-attack-up' },
      left: { flip: true, anim: 'player-attack-side' },
      right: { flip: false, anim: 'player-attack-side' },
    };

    this.gameObject.setFlipX(animSwitch[this.orientation].flip);
    this.gameObject.play(animSwitch[this.orientation].anim, true);
  }

  private beIdle() {
    const animSwitch = {
      down: { flip: false, anim: 'player-idle-down' },
      up: { flip: false, anim: 'player-idle-up' },
      left: { flip: true, anim: 'player-idle-side' },
      right: { flip: false, anim: 'player-idle-side' },
    };
    this.gameObject.setFlipX(animSwitch[this.orientation].flip);
    this.gameObject.play(animSwitch[this.orientation].anim, true);
  }

  private endShoot = () => {
    this.isShooting = false;
  }

  private shoot() {
    this.isShooting = true;
    this.scene.time.addEvent({
      delay: PLAYER_SHOOTING_TIME,
      callback: this.endShoot,
      callbackScope: this,
    });

    const animSwitch = {
      down: { anim: 'player-attack-weapon-down' },
      up: { anim: 'player-attack-weapon-up' },
      left: { anim: 'player-attack-weapon-side' },
      right: { anim: 'player-attack-weapon-side' },
    };

    this.gameObject.play(animSwitch[this.orientation].anim, true);
    const arrow = new Arrow(this.scene, this, this.orientation);

    return arrow;
  }

  private handleShootKey(keyPressed) {
    if (keyPressed.shift) {
      if (this.isLoading) {
        return;
      }
      this.reload();
      const arrow = this.shoot();
      const arrowGameObject = arrow.gameObject;

      // TODO refactor this for performance
      this.scene.treants.map(treant =>
        this.scene.physics.add.collider(
          arrowGameObject,
          treant.gameObject,
          treant.treantLoseHp(arrowGameObject),
        ),
      );
    }
  }
}
