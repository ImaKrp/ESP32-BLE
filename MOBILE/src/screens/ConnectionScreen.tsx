import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useBle, ConnStatus } from "../ble/BleContext";
import { DEVICE_NAME, PAIR_PASSKEY } from "../ble/uuids";
import { Card } from "../ui/Card";
import { theme } from "../ui/theme";

const STATUS_LABEL: Record<ConnStatus, string> = {
  bluetoothOff: "Bluetooth desligado",
  noPermission: "Permissões ausentes",
  idle: "Pronto",
  scanning: "Escaneando…",
  found: "Dispositivo encontrado",
  connecting: "Conectando…",
  pairing: "Pareando (digite a senha)…",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro",
};

const STATUS_COLOR: Record<ConnStatus, string> = {
  bluetoothOff: theme.danger,
  noPermission: theme.danger,
  idle: theme.textDim,
  scanning: theme.warning,
  found: theme.primary,
  connecting: theme.warning,
  pairing: theme.warning,
  connected: theme.success,
  disconnected: theme.textDim,
  error: theme.danger,
};

const Btn: React.FC<{
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}> = ({ label, onPress, color = theme.primary, disabled }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.btn,
      { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
    ]}
  >
    <Text style={styles.btnText}>{label}</Text>
  </Pressable>
);

export const ConnectionScreen: React.FC = () => {
  const ble = useBle();
  const busy = ["scanning", "connecting", "pairing"].includes(ble.status);
  const connected = ble.status === "connected";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {
}

      <Card title="Status da conexão">
        <View style={styles.statusRow}>
          <View
            style={[styles.dot, { backgroundColor: STATUS_COLOR[ble.status] }]}
          />
          <Text style={styles.statusText}>{STATUS_LABEL[ble.status]}</Text>
          {busy ? <ActivityIndicator color={theme.primary} /> : null}
        </View>
        {ble.deviceName ? (
          <Text style={styles.sub}>Dispositivo: {ble.deviceName}</Text>
        ) : null}
        {ble.errorMsg ? <Text style={styles.error}>{ble.errorMsg}</Text> : null}
      </Card>

      <Card title="Conexão BLE">
        <Text style={styles.info}>
          Procurando por <Text style={styles.bold}>{DEVICE_NAME}</Text>. Ao
          conectar, o Android pedirá a senha de pareamento{" "}
          <Text style={styles.bold}>{PAIR_PASSKEY}</Text>.
        </Text>

        {!connected ? (
          <>
            <Btn
              label={ble.status === "scanning" ? "Escaneando…" : "Escanear"}
              onPress={ble.startScan}
              disabled={busy}
            />
            <Btn
              label="Conectar + Parear"
              onPress={ble.connect}
              color={theme.success}
              disabled={ble.status !== "found" && ble.status !== "error"}
            />
          </>
        ) : (
          <Btn
            label="Desconectar"
            onPress={ble.disconnect}
            color={theme.danger}
          />
        )}
      </Card>

      {
}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  statusText: { color: theme.text, fontSize: 18, fontWeight: "600", flex: 1 },
  sub: { color: theme.textDim, marginTop: 8 },
  error: { color: theme.danger, marginTop: 8 },
  info: { color: theme.textDim, marginBottom: 12, lineHeight: 20 },
  bold: { color: theme.text, fontWeight: "700" },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
