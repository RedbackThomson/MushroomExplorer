import { WzMapleVersion } from '@tybys/wz';
import type { WzMapleVersionName } from './types';

const MAP: Record<WzMapleVersionName, WzMapleVersion> = {
  BMS: WzMapleVersion.BMS,
  GMS: WzMapleVersion.GMS,
  EMS: WzMapleVersion.EMS,
  CLASSIC: WzMapleVersion.CLASSIC,
};

export function toWzMapleVersion(name: WzMapleVersionName): WzMapleVersion {
  return MAP[name];
}
