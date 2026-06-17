import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PermissionsAndroid, Platform } from "react-native";

import type { BleManager, Device, Subscription } from "react-native-ble-plx";
import {
  CH_CURRENT,
  CH_HISTORY,
  CH_LEDS,
  CH_NOTIFCNT,
  CH_RSSI,
  CH_SYSCMD,
  CH_SYSSTATE,
  CMD_NEXT_SCREEN,
  CMD_RESET_MINMAX,
  DEVICE_NAME,
  SVC_ACT,
  SVC_CONN,
  SVC_ENV,
  SVC_SYS,
  CH_RGB,
} from "./uuids";
import {
  CurrentData,
  decodeCurrent,
  decodeHistory,
  decodeLeds,
  decodeNotifCount,
  decodeRssi,
  decodeSysState,
  encodeCmd,
  encodeLeds,
  encodeRgb,
  History,
  SysState,
} from "./codec";

export type ConnStatus =
  | "bluetoothOff"
  | "noPermission"
  | "idle"
  | "scanning"
  | "found"
  | "connecting"
  | "pairing"
  | "connected"
  | "disconnected"
  | "error";

export interface Sample {
  t: number;
  v: number;
}

interface BleContextValue {
  status: ConnStatus;
  errorMsg: string | null;
  deviceName: string | null;
  demoMode: boolean;
  current: CurrentData | null;
  leds: { led1: boolean; led2: boolean };
  sys: SysState | null;
  rssi: number | null;
  tempSeries: Sample[];
  humSeries: Sample[];
  rssiSeries: Sample[];
  notifLocalCount: number;
  notifRemoteCount: number;
  history: History | null;
  startScan: () => void;
  stopScan: () => void;
  connect: () => void;
  disconnect: () => void;
  startDemo: () => void;
  stopDemo: () => void;
  setLeds: (led1: boolean, led2: boolean) => void;
  setRgb: (r: number, g: number, b: number) => void;
  resetMinMax: () => void;
  nextScreen: () => void;
  refreshHistory: () => void;
}

const BleContext = createContext<BleContextValue | null>(null);
export const useBle = () => {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error("useBle deve ser usado dentro de <BleProvider>");
  return ctx;
};

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export const BleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {

  const managerRef = useRef<BleManager | null | undefined>(undefined);
  const getManager = useCallback((): BleManager | null => {
    if (managerRef.current === undefined) {
      try {

        const { BleManager: BM } = require("react-native-ble-plx");
        managerRef.current = new BM();
      } catch {
        managerRef.current = null;
      }
    }
    return managerRef.current ?? null;
  }, []);

  const deviceRef = useRef<Device | null>(null);
  const subsRef = useRef<Subscription[]>([]);
  const foundRef = useRef<Device | null>(null);
  const demoRef = useRef(false);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<ConnStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [current, setCurrent] = useState<CurrentData | null>(null);
  const [leds, setLedsState] = useState({ led1: false, led2: false });
  const [sys, setSys] = useState<SysState | null>(null);
  const [rssi, setRssi] = useState<number | null>(null);
  const [tempSeries, setTempSeries] = useState<Sample[]>([]);
  const [humSeries, setHumSeries] = useState<Sample[]>([]);
  const [rssiSeries, setRssiSeries] = useState<Sample[]>([]);
  const [notifLocalCount, setNotifLocalCount] = useState(0);
  const [notifRemoteCount, setNotifRemoteCount] = useState(0);
  const [history, setHistory] = useState<History | null>(null);

  const notifTimestamps = useRef<number[]>([]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    const api = Platform.Version as number;
    try {
      if (api >= 31) {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          res["android.permission.BLUETOOTH_SCAN"] === "granted" &&
          res["android.permission.BLUETOOTH_CONNECT"] === "granted"
        );
      }
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }, []);

  const pushSample = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Sample[]>>,
      v: number,
      windowMs: number,
    ) => {
      const now = Date.now();
      setter((prev) => {
        const next = [...prev, { t: now, v }];
        const cutoff = now - windowMs;
        return next.filter((s) => s.t >= cutoff);
      });
    },
    [],
  );

  const onCurrent = useCallback(
    (b64: string | null | undefined) => {
      if (!b64) return;
      const data = decodeCurrent(b64);
      if (!data) return;
      setCurrent(data);
      pushSample(setTempSeries, data.tempC, HOUR_MS);
      pushSample(setHumSeries, data.hum, HOUR_MS);
      const now = Date.now();
      notifTimestamps.current = notifTimestamps.current.filter(
        (t) => t >= now - MIN_MS,
      );
      notifTimestamps.current.push(now);
      setNotifLocalCount(notifTimestamps.current.length);
    },
    [pushSample],
  );

  const onRssi = useCallback(
    (b64: string | null | undefined) => {
      if (!b64) return;
      const v = decodeRssi(b64);
      setRssi(v);
      pushSample(setRssiSeries, v, MIN_MS);
    },
    [pushSample],
  );

  const onSys = useCallback((b64: string | null | undefined) => {
    if (!b64) return;
    const s = decodeSysState(b64);
    if (s) setSys(s);
  }, []);

  const stopScan = useCallback(() => {
    getManager()?.stopDeviceScan();
  }, [getManager]);

  const startScan = useCallback(async () => {
    setErrorMsg(null);
    const manager = getManager();
    if (!manager) {
      setStatus("error");
      setErrorMsg(
        'BLE indisponível neste ambiente (ex.: Expo Go). Use o "Modo de teste" para ver as telas.',
      );
      return;
    }
    const state = await manager.state();
    if (String(state) !== "PoweredOn") {
      setStatus("bluetoothOff");
      setErrorMsg("Ative o Bluetooth para continuar.");
      return;
    }
    const ok = await requestPermissions();
    if (!ok) {
      setStatus("noPermission");
      setErrorMsg("Permissoes de Bluetooth/Localizacao negadas.");
      return;
    }
    foundRef.current = null;
    setStatus("scanning");
    manager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err) {
        setStatus("error");
        setErrorMsg(err.message);
        return;
      }
      if (device && device.name === DEVICE_NAME) {
        foundRef.current = device;
        setDeviceName(device.name);
        setStatus("found");
        manager.stopDeviceScan();
      }
    });
    setTimeout(() => {
      if (foundRef.current === null) {
        manager.stopDeviceScan();
        setStatus((prev) => (prev === "scanning" ? "idle" : prev));
      }
    }, 12000);
  }, [getManager, requestPermissions]);

  const cleanupSubs = useCallback(() => {
    subsRef.current.forEach((s) => s.remove());
    subsRef.current = [];
  }, []);

  const disconnect = useCallback(async () => {
    cleanupSubs();
    const d = deviceRef.current;
    const manager = getManager();
    if (d && manager) {
      try {
        await manager.cancelDeviceConnection(d.id);
      } catch {}
    }
    deviceRef.current = null;
    setStatus("disconnected");
  }, [cleanupSubs, getManager]);

  const connect = useCallback(async () => {
    const manager = getManager();
    const target = foundRef.current;
    if (!manager) {
      setStatus("error");
      setErrorMsg('BLE indisponível neste ambiente. Use o "Modo de teste".');
      return;
    }
    if (!target) {
      setErrorMsg("Nenhum ESP32 encontrado. Escaneie primeiro.");
      return;
    }
    try {
      setStatus("connecting");
      let device = await manager.connectToDevice(target.id, { timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();
      try {
        await device.requestMTU(185);
      } catch {}

      setStatus("pairing");
      try {
        await device.readCharacteristicForService(SVC_ENV, CH_CURRENT);
      } catch (e: any) {
        await new Promise((r) => setTimeout(r, 1500));
        await device.readCharacteristicForService(SVC_ENV, CH_CURRENT);
      }

      deviceRef.current = device;
      setDeviceName(device.name ?? DEVICE_NAME);

      const disconnectSub = device.onDisconnected(() => {
        cleanupSubs();
        deviceRef.current = null;
        setStatus("disconnected");
        setCurrent(null);
        setRssi(null);
      });
      subsRef.current.push(disconnectSub);

      try {
        const ledc = await device.readCharacteristicForService(
          SVC_ACT,
          CH_LEDS,
        );
        if (ledc.value) setLedsState(decodeLeds(ledc.value));
      } catch {}
      try {
        const sysc = await device.readCharacteristicForService(
          SVC_SYS,
          CH_SYSSTATE,
        );
        if (sysc.value) onSys(sysc.value);
      } catch {}
      try {
        const h = await device.readCharacteristicForService(
          SVC_ENV,
          CH_HISTORY,
        );
        if (h.value) setHistory(decodeHistory(h.value));
      } catch {}

      subsRef.current.push(
        device.monitorCharacteristicForService(SVC_ENV, CH_CURRENT, (e, c) => {
          if (!e && c) onCurrent(c.value);
        }),
      );
      subsRef.current.push(
        device.monitorCharacteristicForService(SVC_CONN, CH_RSSI, (e, c) => {
          if (!e && c) onRssi(c.value);
        }),
      );
      subsRef.current.push(
        device.monitorCharacteristicForService(SVC_SYS, CH_SYSSTATE, (e, c) => {
          if (!e && c) onSys(c.value);
        }),
      );

      setStatus("connected");
    } catch (e: any) {
      const msg = (e?.message ?? "").toLowerCase();
      if (
        msg.includes("auth") ||
        msg.includes("encryp") ||
        msg.includes("pair")
      ) {
        setErrorMsg("Falha de pareamento. Verifique a senha (696969).");
      } else {
        setErrorMsg(e?.message ?? "Falha de conexao.");
      }
      setStatus("error");
      try {
        await manager.cancelDeviceConnection(target.id);
      } catch {}
    }
  }, [getManager, cleanupSubs, onCurrent, onRssi, onSys]);

  const stopDemo = useCallback(() => {
    demoRef.current = false;
    setDemoMode(false);
    if (demoTimer.current) {
      clearInterval(demoTimer.current);
      demoTimer.current = null;
    }
    setStatus("idle");
    setCurrent(null);
    setRssi(null);
    setTempSeries([]);
    setHumSeries([]);
    setRssiSeries([]);
    setHistory(null);
    setDeviceName(null);
    notifTimestamps.current = [];
    setNotifLocalCount(0);
    setNotifRemoteCount(0);
  }, []);

  const startDemo = useCallback(() => {
    try {
      getManager()?.stopDeviceScan();
    } catch {}
    demoRef.current = true;
    setDemoMode(true);
    setErrorMsg(null);
    setDeviceName("ESP32_TEMP_MONITOR (demo)");
    setStatus("connected");
    setLedsState({ led1: true, led2: false });
    setSys({
      sw1: false,
      sw2: true,
      sw3: false,
      sw4: false,
      remoteLocked: false,
      fahrenheit: false,
      connected: true,
      lcdScreen: 0,
    });

    const tempH: number[] = [];
    const humH: number[] = [];
    for (let i = 0; i < 60; i++) {
      tempH.push(+(24 + Math.sin(i / 6) * 3).toFixed(2));
      humH.push(+(55 + Math.cos(i / 8) * 8).toFixed(2));
    }
    setHistory({ temp: tempH, hum: humH });

    const now = Date.now();
    const ts: Sample[] = [];
    const hs: Sample[] = [];
    const rs: Sample[] = [];
    for (let i = 120; i > 0; i--) {
      const t = now - i * 1000;
      ts.push({ t, v: 24 + Math.sin(i / 10) * 3 });
      hs.push({ t, v: 55 + Math.cos(i / 12) * 8 });
    }
    for (let i = 60; i > 0; i--) {
      rs.push({ t: now - i * 1000, v: -60 + Math.round(Math.sin(i / 5) * 8) });
    }
    setTempSeries(ts);
    setHumSeries(hs);
    setRssiSeries(rs);

    if (demoTimer.current) clearInterval(demoTimer.current);
    let k = 0;
    demoTimer.current = setInterval(() => {
      k++;
      const tempC = 24 + Math.sin(k / 10) * 3 + (Math.random() - 0.5) * 0.3;
      const h = 55 + Math.cos(k / 12) * 8 + (Math.random() - 0.5) * 0.5;
      setCurrent({ tempC, tempF: (tempC * 9) / 5 + 32, hum: h });
      pushSample(setTempSeries, tempC, HOUR_MS);
      pushSample(setHumSeries, h, HOUR_MS);
      const r =
        -60 + Math.round(Math.sin(k / 5) * 8 + (Math.random() - 0.5) * 4);
      setRssi(r);
      pushSample(setRssiSeries, r, MIN_MS);
      const tnow = Date.now();
      notifTimestamps.current = notifTimestamps.current.filter(
        (x) => x >= tnow - MIN_MS,
      );
      notifTimestamps.current.push(tnow);
      setNotifLocalCount(notifTimestamps.current.length);
      setNotifRemoteCount(notifTimestamps.current.length);
    }, 1000);
  }, [getManager, pushSample]);

  const setLeds = useCallback(
    async (led1: boolean, led2: boolean) => {
      if (demoRef.current) {
        setLedsState({ led1, led2 });
        return;
      }
      const d = deviceRef.current;
      if (!d) return;
      if (sys?.remoteLocked) {
        setErrorMsg("Controle remoto bloqueado pelo Switch 1.");
        return;
      }
      try {
        await d.writeCharacteristicWithResponseForService(
          SVC_ACT,
          CH_LEDS,
          encodeLeds(led1, led2),
        );
        const c = await d.readCharacteristicForService(SVC_ACT, CH_LEDS);
        if (c.value) setLedsState(decodeLeds(c.value));
      } catch (e: any) {
        setErrorMsg("Escrita nos LEDs recusada.");
      }
    },
    [sys],
  );

  const rgbThrottle = useRef(0);
  const setRgb = useCallback(async (r: number, g: number, b: number) => {
    if (demoRef.current) return;
    const d = deviceRef.current;
    if (!d) return;
    const now = Date.now();
    if (now - rgbThrottle.current < 60) return;
    rgbThrottle.current = now;
    try {
      await d.writeCharacteristicWithoutResponseForService(
        SVC_ACT,
        CH_RGB,
        encodeRgb(r, g, b),
      );
    } catch {}
  }, []);

  const sendCmd = useCallback(async (cmd: number) => {
    const d = deviceRef.current;
    if (!d) return;
    try {
      await d.writeCharacteristicWithResponseForService(
        SVC_SYS,
        CH_SYSCMD,
        encodeCmd(cmd),
      );
    } catch {}
  }, []);

  const resetMinMax = useCallback(() => {
    if (demoRef.current) return;
    sendCmd(CMD_RESET_MINMAX);
  }, [sendCmd]);

  const nextScreen = useCallback(() => {
    if (demoRef.current) {
      setSys((s) => (s ? { ...s, lcdScreen: (s.lcdScreen + 1) % 5 } : s));
      return;
    }
    sendCmd(CMD_NEXT_SCREEN);
  }, [sendCmd]);

  const refreshHistory = useCallback(async () => {
    if (demoRef.current) return;
    const d = deviceRef.current;
    if (!d) return;
    try {
      const h = await d.readCharacteristicForService(SVC_ENV, CH_HISTORY);
      if (h.value) setHistory(decodeHistory(h.value));
      const n = await d.readCharacteristicForService(SVC_CONN, CH_NOTIFCNT);
      if (n.value) setNotifRemoteCount(decodeNotifCount(n.value));
    } catch {}
  }, []);

  useEffect(() => {
    let sub: Subscription | undefined;
    try {
      const manager = getManager();
      if (manager) {
        sub = manager.onStateChange((state) => {
          if (String(state) === "PoweredOff" && !demoRef.current) {
            setStatus("bluetoothOff");
            setErrorMsg("Bluetooth desligado.");
          }
        }, true);
      }
    } catch {}
    return () => {
      sub?.remove();
      cleanupSubs();
      if (demoTimer.current) clearInterval(demoTimer.current);
      try {
        managerRef.current?.destroy();
      } catch {}
    };

  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (demoRef.current) return;
      const now = Date.now();
      notifTimestamps.current = notifTimestamps.current.filter(
        (t) => t >= now - MIN_MS,
      );
      setNotifLocalCount(notifTimestamps.current.length);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<BleContextValue>(
    () => ({
      status,
      errorMsg,
      deviceName,
      demoMode,
      current,
      leds,
      sys,
      rssi,
      tempSeries,
      humSeries,
      rssiSeries,
      notifLocalCount,
      notifRemoteCount,
      history,
      startScan,
      stopScan,
      connect,
      disconnect,
      startDemo,
      stopDemo,
      setLeds,
      setRgb,
      resetMinMax,
      nextScreen,
      refreshHistory,
    }),
    [
      status,
      errorMsg,
      deviceName,
      demoMode,
      current,
      leds,
      sys,
      rssi,
      tempSeries,
      humSeries,
      rssiSeries,
      notifLocalCount,
      notifRemoteCount,
      history,
      startScan,
      stopScan,
      connect,
      disconnect,
      startDemo,
      stopDemo,
      setLeds,
      setRgb,
      resetMinMax,
      nextScreen,
      refreshHistory,
    ],
  );

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
};
