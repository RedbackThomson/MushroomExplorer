import { describe, it, expect } from 'vitest';
import {
  classify,
  datasetKind,
  normalizeImgRelPath,
  splitByKind,
  type RelFile,
} from './dropClassify';

const rel = (relPath: string): RelFile => ({ file: new File([], relPath), relPath });

describe('classify', () => {
  it('recognizes each kind by extension', () => {
    expect(classify('Item.wz')).toBe('wz');
    expect(classify('Item/Consume/0200/02000000.img')).toBe('img');
    expect(classify('library.scrolled-backup')).toBe('backup');
    expect(classify('notes.txt')).toBe('other');
  });
});

describe('datasetKind', () => {
  it('flags a mixed drop and resolves single-kind drops', () => {
    expect(datasetKind(splitByKind([rel('Item.wz'), rel('Mob/1.img')]))).toBe('mixed');
    expect(datasetKind(splitByKind([rel('Item.wz')]))).toBe('wz');
    expect(datasetKind(splitByKind([rel('Mob/1.img')]))).toBe('img');
    expect(datasetKind(splitByKind([rel('readme.txt')]))).toBe('none');
  });
});

describe('normalizeImgRelPath', () => {
  it('re-roots at the first recognized WZ folder, dropping a selected parent', () => {
    expect(normalizeImgRelPath('ExtractedData/Item/Consume/0200/02000000.img')).toBe(
      'Item/Consume/0200/02000000.img',
    );
    expect(normalizeImgRelPath('Map/Map/Map0/100000000.img')).toBe('Map/Map/Map0/100000000.img');
    expect(normalizeImgRelPath('String/Mob.img')).toBe('String/Mob.img');
  });

  it('leaves an unrecognized layout untouched', () => {
    expect(normalizeImgRelPath('weird/thing/x.img')).toBe('weird/thing/x.img');
  });
});
