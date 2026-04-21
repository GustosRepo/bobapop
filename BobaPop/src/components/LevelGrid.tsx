import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LevelCard } from './LevelCard';
import { WorldTheme } from '../constants/themes';

interface Props {
  worldIndex: number;
  world: WorldTheme;
  unlockedUpTo: number;
  levelStars: Record<number, number>;
  levelHighScores?: Record<number, number>;
  onSelectLevel: (index: number) => void;
}

const { width: SW } = Dimensions.get('screen');
const CARD_GAP = 10;
export const CARD_SIZE = (SW - 48 - CARD_GAP * 4) / 5;

export const LevelGrid: React.FC<Props> = ({
  worldIndex,
  world,
  unlockedUpTo,
  levelStars,
  levelHighScores,
  onSelectLevel,
}) => {
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4].map((li) => {
        const globalIdx = worldIndex * 5 + li;
        const unlocked = globalIdx <= unlockedUpTo;
        const stars = levelStars[globalIdx] ?? 0;
        const mountDelay = worldIndex * 50 + li * 65;

        return (
          <LevelCard
            key={globalIdx}
            levelIndex={globalIdx}
            unlocked={unlocked}
            stars={stars}
            highScore={levelHighScores?.[globalIdx]}
            size={CARD_SIZE}
            world={world}
            mountDelay={mountDelay}
            onPress={() => onSelectLevel(globalIdx)}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
});
