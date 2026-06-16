import { Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

/**
 * A trivial custom display object used to exercise the "Open in editor" feature:
 * right-clicking a Bunny node in the devtools scene tree should open THIS file.
 */
export class Bunny extends Sprite {
  constructor(texture: Texture) {
    super(texture);
  }
}
