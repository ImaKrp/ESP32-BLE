import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {useBle} from '../ble/BleContext';
import {Card} from '../ui/Card';
import {ColorPicker} from '../ui/ColorPicker';
import {theme} from '../ui/theme';

export const ControlScreen: React.FC = () => {
  const ble = useBle();
  const locked = ble.sys?.remoteLocked ?? false;
  const connected = ble.status === 'connected';

  const [rgb, setRgb] = useState({r: 0, g: 0, b: 255});

  const onColor = (r: number, g: number, b: number) => {
    console.log('Setting RGB to', r, g, b);
    setRgb({r, g, b});
    ble.setRgb(r, g, b);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{paddingBottom: 32}}>
      {locked ? (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>
            🔒 Controle remoto bloqueado pelo Switch 1. Os LEDs simples só podem
            ser alterados fisicamente.
          </Text>
        </View>
      ) : null}

      <Card title="LEDs simples">
        <View style={styles.ledRow}>
          <Text style={styles.ledLabel}>LED 1</Text>
          <Switch
            value={ble.leds.led1}
            disabled={!connected || locked}
            onValueChange={v => ble.setLeds(v, ble.leds.led2)}
            trackColor={{true: theme.success}}
          />
        </View>
        <View style={styles.ledRow}>
          <Text style={styles.ledLabel}>LED 2</Text>
          <Switch
            value={ble.leds.led2}
            disabled={!connected || locked}
            onValueChange={v => ble.setLeds(ble.leds.led1, v)}
            trackColor={{true: theme.success}}
          />
        </View>
        <Text style={styles.note}>
          Estado sincronizado com os Switches 2 e 3 do ESP32.
        </Text>
      </Card>

      <Card title="LED RGB · Color Picker">
        <ColorPicker r={rgb.r} g={rgb.g} b={rgb.b} onChange={onColor} />
      </Card>

      <Card title="Histórico min/máx">
        <Pressable
          onPress={ble.resetMinMax}
          disabled={!connected}
          style={({pressed}) => [
            styles.btn,
            {backgroundColor: theme.danger, opacity: connected ? (pressed ? 0.8 : 1) : 0.4},
          ]}>
          <Text style={styles.btnText}>Resetar mínimos e máximos</Text>
        </Pressable>
        <Pressable
          onPress={ble.nextScreen}
          disabled={!connected}
          style={({pressed}) => [
            styles.btn,
            {backgroundColor: theme.cardAlt, opacity: connected ? (pressed ? 0.8 : 1) : 0.4},
          ]}>
          <Text style={styles.btnText}>Avançar tela do LCD</Text>
        </Pressable>
      </Card>

      <Card title="Estado dos switches físicos">
        <SwitchRow label="Switch 1 (bloqueio remoto)" on={ble.sys?.sw1} />
        <SwitchRow label="Switch 2 (LED 1)" on={ble.sys?.sw2} />
        <SwitchRow label="Switch 3 (LED 2)" on={ble.sys?.sw3} />
        <SwitchRow
          label={`Switch 4 (gráfico ${ble.sys?.fahrenheit ? '°F' : '°C'})`}
          on={ble.sys?.sw4}
        />
      </Card>
    </ScrollView>
  );
};

const SwitchRow: React.FC<{label: string; on?: boolean}> = ({label, on}) => (
  <View style={styles.swRow}>
    <Text style={styles.ledLabel}>{label}</Text>
    <Text style={[styles.badge, {color: on ? theme.success : theme.textDim}]}>
      {on ? 'LIGADO' : 'desligado'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg},
  ledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  swRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  ledLabel: {color: theme.text, fontSize: 16},
  badge: {fontWeight: '700', fontSize: 13},
  note: {color: theme.textDim, fontSize: 12, marginTop: 8},
  btn: {paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10},
  btnText: {color: '#fff', fontWeight: '700'},
  lockBanner: {
    backgroundColor: '#3a2a13',
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  lockText: {color: theme.warning, lineHeight: 20},
});
