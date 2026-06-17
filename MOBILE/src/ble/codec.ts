import {Buffer} from 'buffer';

export const toBase64 = (bytes: number[]): string =>
  Buffer.from(bytes).toString('base64');

export const fromBase64 = (b64: string): Buffer => Buffer.from(b64, 'base64');

export interface CurrentData {
  tempC: number;
  tempF: number;
  hum: number;
}

export function decodeCurrent(b64: string): CurrentData | null {
  const buf = fromBase64(b64);
  if (buf.length < 12) return null;
  return {
    tempC: buf.readFloatLE(0),
    tempF: buf.readFloatLE(4),
    hum: buf.readFloatLE(8),
  };
}

export interface History {
  temp: number[];
  hum: number[];
}

export function decodeHistory(b64: string): History {
  const buf = fromBase64(b64);
  const temp: number[] = [];
  const hum: number[] = [];
  if (buf.length < 1) return {temp, hum};
  const count = Math.min(buf[0], 60);
  for (let i = 0; i < count; i++) {
    temp.push(buf.readInt16LE(1 + i * 2) / 100);
  }
  const humBase = 1 + 60 * 2;
  for (let i = 0; i < count; i++) {
    hum.push(buf.readInt16LE(humBase + i * 2) / 100);
  }
  return {temp, hum};
}

export function decodeLeds(b64: string): {led1: boolean; led2: boolean} {
  const buf = fromBase64(b64);
  const b = buf.length ? buf[0] : 0;
  return {led1: (b & 0x01) !== 0, led2: (b & 0x02) !== 0};
}

export function encodeLeds(led1: boolean, led2: boolean): string {
  return toBase64([(led1 ? 0x01 : 0) | (led2 ? 0x02 : 0)]);
}

export function encodeRgb(r: number, g: number, b: number): string {
  return toBase64([r & 0xff, g & 0xff, b & 0xff]);
}

export function decodeRssi(b64: string): number {
  const buf = fromBase64(b64);
  return buf.length ? buf.readInt8(0) : 0;
}

export function decodeNotifCount(b64: string): number {
  const buf = fromBase64(b64);
  return buf.length >= 2 ? buf.readUInt16LE(0) : 0;
}

export interface SysState {
  sw1: boolean;
  sw2: boolean;
  sw3: boolean;
  sw4: boolean;
  remoteLocked: boolean;
  fahrenheit: boolean;
  connected: boolean;
  lcdScreen: number;
}

export function decodeSysState(b64: string): SysState | null {
  const buf = fromBase64(b64);
  if (buf.length < 3) return null;
  const s = buf[0];
  const f = buf[1];
  return {
    sw1: (s & 0x01) !== 0,
    sw2: (s & 0x02) !== 0,
    sw3: (s & 0x04) !== 0,
    sw4: (s & 0x08) !== 0,
    remoteLocked: (f & 0x01) !== 0,
    fahrenheit: (f & 0x02) !== 0,
    connected: (f & 0x04) !== 0,
    lcdScreen: buf[2],
  };
}

export function encodeCmd(cmd: number): string {
  return toBase64([cmd & 0xff]);
}
