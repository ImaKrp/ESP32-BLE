export const DEVICE_NAME = 'ESP32_TEMP_MONITOR';
export const PAIR_PASSKEY = '696969';

const base = (short: string) =>
  `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

export const SVC_ENV = base('181a');
export const CH_CURRENT = base('2a6e');
export const CH_HISTORY = '7b2f0101-9b8a-4a2c-91f4-8f6b4f1a0001';

export const SVC_ACT = '7b2f0001-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_LEDS = '7b2f0002-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_RGB = '7b2f0003-9b8a-4a2c-91f4-8f6b4f1a0001';

export const SVC_CONN = '7b2f1001-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_RSSI = '7b2f1002-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_NOTIFCNT = '7b2f1003-9b8a-4a2c-91f4-8f6b4f1a0001';

export const SVC_SYS = '7b2f2000-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_SYSSTATE = '7b2f2001-9b8a-4a2c-91f4-8f6b4f1a0001';
export const CH_SYSCMD = '7b2f2002-9b8a-4a2c-91f4-8f6b4f1a0001';

export const CMD_RESET_MINMAX = 0x01;
export const CMD_NEXT_SCREEN = 0x02;
export const CMD_REFRESH = 0x03;
