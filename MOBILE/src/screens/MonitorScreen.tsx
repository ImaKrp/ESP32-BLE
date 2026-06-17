import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useBle} from '../ble/BleContext';
import {Card} from '../ui/Card';
import {LineChart} from '../ui/LineChart';
import {theme} from '../ui/theme';

const Stat: React.FC<{label: string; value: string; unit: string}> = ({
  label,
  value,
  unit,
}) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>
      {value}
      <Text style={styles.statUnit}>{unit}</Text>
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const MonitorScreen: React.FC = () => {
  const ble = useBle();
  const c = ble.current;
  const fahrenheit = ble.sys?.fahrenheit ?? false;

  const tempData = fahrenheit
    ? ble.tempSeries.map(s => (s.v * 9) / 5 + 32)
    : ble.tempSeries.map(s => s.v);
  const humData = ble.humSeries.map(s => s.v);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{paddingBottom: 32}}>
      <Card title="Leituras atuais">
        <View style={styles.row}>
          <Stat
            label="Temp"
            value={c ? c.tempC.toFixed(1) : '--'}
            unit="°C"
          />
          <Stat
            label="Temp"
            value={c ? c.tempF.toFixed(1) : '--'}
            unit="°F"
          />
          <Stat label="Umidade" value={c ? c.hum.toFixed(1) : '--'} unit="%" />
        </View>
      </Card>

      <Card
        title={`Temperatura · última hora (${fahrenheit ? '°F' : '°C'})`}>
        <LineChart
          data={tempData}
          color={theme.warning}
          unit={fahrenheit ? '°F' : '°C'}
        />
        <Text style={styles.note}>
          Unidade definida pelo Switch 4 do ESP32.
        </Text>
      </Card>

      <Card title="Umidade · última hora (%)">
        <LineChart data={humData} color={theme.primary} unit="%" />
      </Card>

      <Card title="Histórico do ESP32 (60 min)">
        <Text style={styles.subhead}>Temperatura média/min (°C)</Text>
        <LineChart
          data={ble.history?.temp ?? []}
          color={theme.warning}
          unit="°C"
          height={90}
        />
        <Text style={[styles.subhead, {marginTop: 12}]}>
          Umidade média/min (%)
        </Text>
        <LineChart
          data={ble.history?.hum ?? []}
          color={theme.primary}
          unit="%"
          height={90}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg},
  row: {flexDirection: 'row', justifyContent: 'space-between'},
  stat: {alignItems: 'center', flex: 1},
  statValue: {color: theme.text, fontSize: 30, fontWeight: '800'},
  statUnit: {color: theme.textDim, fontSize: 16, fontWeight: '600'},
  statLabel: {color: theme.textDim, marginTop: 4, fontSize: 13},
  note: {color: theme.textDim, fontSize: 12, marginTop: 8},
  subhead: {color: theme.textDim, fontSize: 13, marginBottom: 4},
});
