import sharp from "sharp";
import { createRng } from "./rng";

// Turns a clean render into a "phone photo": skewed, on a table, slightly soft,
// with sensor noise and heavy JPEG compression (06, "Receipt generation").
const TABLE = { r: 138, g: 128, b: 116 };

export async function toPhonePhoto(
  png: Buffer,
  opts: { width: number; height: number; angle: number; noiseSeed: number },
): Promise<Buffer> {
  const rotated = await sharp(png)
    .flatten({ background: "#ffffff" })
    .rotate(opts.angle, { background: TABLE })
    .toBuffer();

  const { data, info } = await sharp(rotated)
    .resize(opts.width, opts.height, { fit: "contain", background: TABLE })
    .modulate({ brightness: 0.93 })
    .blur(0.6)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rng = createRng(opts.noiseSeed);
  for (let i = 0; i < data.length; i++) {
    // Sum of uniforms approximates Gaussian noise, roughly +/- 12 levels.
    const noise = (rng() + rng() + rng() - 1.5) * 16;
    data[i] = Math.max(0, Math.min(255, Math.round((data[i] ?? 0) + noise)));
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .jpeg({ quality: 60 })
    .toBuffer();
}
