import React, { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BleProvider, useBle } from "./src/ble/BleContext";
import { ConnectionScreen } from "./src/screens/ConnectionScreen";
import { MonitorScreen } from "./src/screens/MonitorScreen";
import { ControlScreen } from "./src/screens/ControlScreen";
import { HealthScreen } from "./src/screens/HealthScreen";
import { theme } from "./src/ui/theme";

type Tab = "conn" | "monitor" | "control" | "health";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "conn", label: "Conexão", icon: "🔗" },
  { key: "monitor", label: "Monitor", icon: "🌡️" },
  { key: "control", label: "Controle", icon: "🎛️" },
  { key: "health", label: "Sinal", icon: "📶" },
];

const Header: React.FC = () => {
  const ble = useBle();
  const connected = ble.status === "connected";
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>ESP32 Temp Monitor</Text>
      <View
        style={[
          styles.headerDot,
          { backgroundColor: connected ? theme.success : theme.textDim },
        ]}
      />
    </View>
  );
};

const Shell: React.FC = () => {
  const [tab, setTab] = useState<Tab>("conn");
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <Header />
      <View style={styles.content}>
        {tab === "conn" && <ConnectionScreen />}
        {tab === "monitor" && <MonitorScreen />}
        {tab === "control" && <ControlScreen />}
        {tab === "health" && <HealthScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? theme.primary : theme.textDim },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const App: React.FC = () => (
  <BleProvider>
    <Shell />
  </BleProvider>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 18, fontWeight: "800", flex: 1 },
  headerDot: { width: 12, height: 12, borderRadius: 6 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.card,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabIcon: { fontSize: 20 },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
});

export default App;
