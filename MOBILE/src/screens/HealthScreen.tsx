import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useBle} from '../ble/BleContext';
import {Card} from '../ui/Card';
import {LineChart} from '../ui/LineChart';
import {theme} from '../ui/theme';

export const HealthScreen: React.FC = () => {
  const ble = useBle();
  const rssiData = ble.rssiSeries.map(s => s.v);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{paddingBottom: 32}}>
      <Card title="RSSI atual">
        <Text style={styles.big}>
          {ble.rssi != null ? `${ble.rssi}` : '--'}
          <Text style={styles.unit}> dBm</Text>
        </Text>
      </Card>

      <Card title="RSSI · últimos 60s">
        <LineChart data={rssiData} color={theme.success} unit="" minSpan={10} />
      </Card>

      <Card title="Notificações">
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.num}>{ble.notifLocalCount}</Text>
            <Text style={styles.label}>recebidas (app, 60s)</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.num}>{ble.notifRemoteCount}</Text>
            <Text style={styles.label}>enviadas (ESP32, 60s)</Text>
          </View>
        </View>
        <Text style={styles.note}>
          O contador do ESP32 é atualizado ao usar “Refresh” na tela de conexão.
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg},
  big: {color: theme.text, fontSize: 44, fontWeight: '800'},
  unit: {color: theme.textDim, fontSize: 18, fontWeight: '600'},
  row: {flexDirection: 'row', justifyContent: 'space-around'},
  col: {alignItems: 'center'},
  num: {color: theme.text, fontSize: 32, fontWeight: '800'},
  label: {color: theme.textDim, fontSize: 12, marginTop: 4},
  note: {color: theme.textDim, fontSize: 12, marginTop: 12, textAlign: 'center'},
});
