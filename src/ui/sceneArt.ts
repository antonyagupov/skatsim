import type Phaser from "phaser";
import {
  type LayoutProfile,
  pickLayoutProfile,
} from "./layoutProfile";

const ASPECT_EPS = 0.04;

/** Prefer `baseKey-mobile` on mobile when the texture is loaded. */
export function resolveSceneTexture(
  scene: Phaser.Scene,
  baseKey: string,
  profile?: LayoutProfile,
): string {
  const { width, height } = scene.scale;
  const resolved = profile ?? pickLayoutProfile(width, height);
  if (resolved === "mobile") {
    const mobileKey = `${baseKey}-mobile`;
    if (scene.textures.exists(mobileKey)) return mobileKey;
  }
  return baseKey;
}

/**
 * Cover-fit texture into a target rect (uniform scale + crop, no stretch squash).
 */
export function fitCoverImage(
  image: Phaser.GameObjects.Image,
  targetW: number,
  targetH: number,
  anchorY = 0.5,
): void {
  const frame = image.frame;
  const srcW = frame.realWidth || frame.width;
  const srcH = frame.realHeight || frame.height;
  if (srcW <= 0 || srcH <= 0) {
    image.setDisplaySize(targetW, targetH);
    return;
  }
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const cropW = Math.min(srcW, targetW / scale);
  const cropH = Math.min(srcH, targetH / scale);
  const cropX = Math.max(0, (srcW - cropW) / 2);
  const cropY = Math.max(0, (srcH - cropH) * anchorY);
  image.setCrop(cropX, cropY, cropW, cropH);
  image.setDisplaySize(targetW, targetH);
}

/**
 * Add a full-bleed (or sized) background: mobile art if present; cover-crop when aspects differ.
 */
export function addSceneBackground(
  scene: Phaser.Scene,
  baseKey: string,
  opts?: {
    profile?: LayoutProfile;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    /** Cover crop vertical anchor (0=top, 0.5=center). */
    coverAnchorY?: number;
    alpha?: number;
  },
): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null {
  const { width: sw, height: sh } = scene.scale;
  const profile = opts?.profile ?? pickLayoutProfile(sw, sh);
  const tw = opts?.width ?? sw;
  const th = opts?.height ?? sh;
  const x = opts?.x ?? tw / 2;
  const y = opts?.y ?? th / 2;
  const key = resolveSceneTexture(scene, baseKey, profile);

  if (!scene.textures.exists(key) && !scene.textures.exists(baseKey)) {
    return null;
  }

  const texKey = scene.textures.exists(key) ? key : baseKey;
  const img = scene.add.image(x, y, texKey);
  const frame = img.frame;
  const srcW = frame.realWidth || frame.width;
  const srcH = frame.realHeight || frame.height;
  const srcAspect = srcW > 0 && srcH > 0 ? srcW / srcH : tw / th;
  const tgtAspect = tw / th;
  const aspectMismatch = Math.abs(srcAspect - tgtAspect) > ASPECT_EPS;

  if (aspectMismatch) {
    fitCoverImage(img, tw, th, opts?.coverAnchorY ?? 0.45);
  } else {
    img.setDisplaySize(tw, th);
  }

  if (opts?.alpha != null) img.setAlpha(opts.alpha);
  return img;
}
