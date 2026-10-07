import sharp from 'sharp';

/** A solid-colour JPEG of the given size, optionally with EXIF GPS + orientation (to prove they are stripped/applied). */
export async function makeJpeg(width: number, height: number, opts: { gps?: boolean; orientation?: number } = {}) {
  let image = sharp({ create: { width, height, channels: 3, background: '#c8102e' } }).jpeg({ quality: 90 });
  if (opts.gps) {
    image = image.withExif({
      IFD0: { Make: 'TestCam', Model: 'Field reporter' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '47/1 55/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '106/1 55/1 0/1' },
    });
  }
  if (opts.orientation) image = image.withMetadata({ orientation: opts.orientation });
  return new Uint8Array(await image.toBuffer());
}

export async function makePng(width: number, height: number) {
  return new Uint8Array(await sharp({ create: { width, height, channels: 4, background: '#1f4e9c' } }).png().toBuffer());
}
