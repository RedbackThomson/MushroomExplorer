import {
  WzObjectType,
  WzPropertyType,
  type WzObject,
  WzStringProperty,
  WzIntProperty,
  WzShortProperty,
  WzLongProperty,
  WzFloatProperty,
  WzDoubleProperty,
  WzVectorProperty,
  WzCanvasProperty,
  WzSubProperty,
  WzUOLProperty,
  WzBinaryProperty,
  WzLuaProperty,
  WzNullProperty,
  WzConvexProperty,
  WzImage,
  WzDirectory,
  WzFile,
  type WzImageProperty,
} from '@tybys/wz';
import type { WzNodeInfo, WzNodeKind, WzPropertyKind } from './types';

function propertyKindOf(prop: WzImageProperty): WzPropertyKind {
  if (prop instanceof WzStringProperty) return 'string';
  if (prop instanceof WzIntProperty) return 'int';
  if (prop instanceof WzShortProperty) return 'short';
  if (prop instanceof WzLongProperty) return 'long';
  if (prop instanceof WzFloatProperty) return 'float';
  if (prop instanceof WzDoubleProperty) return 'double';
  if (prop instanceof WzVectorProperty) return 'vector';
  if (prop instanceof WzCanvasProperty) return 'canvas';
  if (prop instanceof WzSubProperty) return 'sub';
  if (prop instanceof WzUOLProperty) return 'uol';
  if (prop instanceof WzBinaryProperty) return 'binary';
  if (prop instanceof WzLuaProperty) return 'lua';
  if (prop instanceof WzConvexProperty) return 'convex';
  if (prop instanceof WzNullProperty) return 'null';
  return 'unknown';
}

function scalarOf(prop: WzImageProperty, kind: WzPropertyKind): string | number | null | undefined {
  switch (kind) {
    case 'string':
    case 'int':
    case 'short':
    case 'float':
    case 'double':
      return (prop as { wzValue: string | number }).wzValue;
    case 'long': {
      const v = (prop as { wzValue: bigint | number }).wzValue;
      return typeof v === 'bigint' ? v.toString() : v;
    }
    case 'uol': {
      const v = (prop as { wzValue: string }).wzValue;
      return typeof v === 'string' ? v : null;
    }
    case 'vector': {
      const v = (prop as { wzValue: { x: number; y: number } | string }).wzValue;
      return typeof v === 'string' ? v : v ? `${v.x},${v.y}` : null;
    }
    default:
      return undefined;
  }
}

function kindOf(obj: WzObject): WzNodeKind {
  switch (obj.objectType) {
    case WzObjectType.File:
      return 'file';
    case WzObjectType.Directory:
      return 'directory';
    case WzObjectType.Image:
      return 'image';
    case WzObjectType.Property:
    case WzObjectType.List:
      return 'property';
    default:
      return 'property';
  }
}

function hasChildren(obj: WzObject): boolean {
  if (obj instanceof WzFile) return obj.wzDirectory !== null;
  if (obj instanceof WzDirectory) {
    return obj.wzDirectories.size > 0 || obj.wzImages.size > 0;
  }
  if (obj instanceof WzImage) {
    // Images are lazy-parsed; accessing wzProperties before parseImage()
    // throws. Assume non-empty until the consumer asks for children, at which
    // point listChildren() will parse and the real count becomes available.
    return obj.parsed ? obj.wzProperties.size > 0 : true;
  }
  if (obj instanceof WzSubProperty || obj instanceof WzConvexProperty) {
    return (obj as unknown as { wzProperties: Set<unknown> }).wzProperties.size > 0;
  }
  return false;
}

export function toNodeInfo(obj: WzObject, fullPath: string): WzNodeInfo {
  const kind = kindOf(obj);
  const info: WzNodeInfo = {
    name: obj.name,
    fullPath,
    kind,
    hasChildren: hasChildren(obj),
  };
  if (kind === 'property') {
    const prop = obj as WzImageProperty;
    const propKind = propertyKindOf(prop);
    info.propertyKind = propKind;
    const scalar = scalarOf(prop, propKind);
    if (scalar !== undefined) info.scalar = scalar;
  }
  return info;
}

export {
  WzObjectType,
  WzPropertyType,
  WzFile,
  WzDirectory,
  WzImage,
  WzSubProperty,
  WzConvexProperty,
};
