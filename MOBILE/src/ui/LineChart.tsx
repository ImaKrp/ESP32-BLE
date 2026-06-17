import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from './theme';

interface Props {
  data: number[];
  color?: string;
  height?: number;
  unit?: string;
  minSpan?: number;
}

export const LineChart: React.FC<Props> = ({
  data,
  color = theme.primary,
  height = 120,
  unit = '',
  minSpan = 2,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, {height}]}>
        <Text style={styles.emptyText}>Sem dados ainda…</Text>
      </View>
    );
  }
  let min = Math.min(...data);
  let max = Math.max(...data);
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  const span = max - min || 1;

  const maxBars = 80;
  const step = Math.max(1, Math.ceil(data.length / maxBars));
  const bars: number[] = [];
  for (let i = 0; i < data.length; i += step) bars.push(data[i]);

  return (
    <View>
      <View style={[styles.chart, {height}]}>
        {bars.map((v, i) => {
          const h = ((v - min) / span) * (height - 8) + 2;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {height: h, backgroundColor: color},
              ]}
            />
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>
          {min.toFixed(1)}
          {unit}
        </Text>
        <Text style={styles.axisText}>
          {max.toFixed(1)}
          {unit}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minWidth: 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisText: {color: theme.textDim, fontSize: 11},
  empty: {alignItems: 'center', justifyContent: 'center'},
  emptyText: {color: theme.textDim, fontSize: 13},
});
