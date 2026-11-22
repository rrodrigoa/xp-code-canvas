import {describe,it,expect} from 'vitest';
import {cursorWithinSymbol} from '../../src/shared/sourceNavigation';
const span={startLine:7,startCharacter:4,endLine:12,endCharacter:9};
describe('source cursor guard',()=>{
 it('allows precise selection and first-line column zero fallback',()=>{
   expect(cursorWithinSymbol({line:10,character:24},span)).toBe(true);
   expect(cursorWithinSymbol({line:7,character:0},span)).toBe(true);
 });
 it('rejects stale/invalid positions and out-of-range end columns',()=>{
   expect(cursorWithinSymbol({line:13,character:0},span)).toBe(false);
   expect(cursorWithinSymbol({line:12,character:10},span)).toBe(false);
   expect(cursorWithinSymbol({line:8,character:-1},span)).toBe(false);
   expect(cursorWithinSymbol({line:NaN,character:3},span)).toBe(false);
 });
});
