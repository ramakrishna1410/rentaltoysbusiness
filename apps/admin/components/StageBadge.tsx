import { Text } from 'react-native';
import { STAGE_LABELS, type ToyStage } from '@rentaltoys/shared';

export const STAGE_COLORS: Record<ToyStage, string> = {
  PROCUREMENT: '#8E7CC3',
  STORAGE: '#2E9E5B',
  IN_TRANSIT: '#F0A500',
  WITH_CUSTOMER: '#3D5AFE',
  SANITATION: '#2BB3A3',
  DAMAGE: '#D64545',
  SCRAP: '#555555',
};

export function StageBadge({ stage, big }: { stage: ToyStage; big?: boolean }) {
  return (
    <Text
      style={{
        alignSelf: 'flex-start',
        backgroundColor: STAGE_COLORS[stage],
        color: '#fff',
        fontWeight: '800',
        paddingHorizontal: big ? 14 : 8,
        paddingVertical: big ? 6 : 3,
        borderRadius: 999,
        fontSize: big ? 16 : 12,
        overflow: 'hidden',
      }}
    >
      {STAGE_LABELS[stage]}
    </Text>
  );
}
