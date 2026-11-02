/**
 * Tests for turning rows into a spreadsheet file.
 */

import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header and one line per row, ending lines the way spreadsheets expect', () => {
    expect(toCsv(['Model', 'Hours'], [['Jordan Ellis', 2], ['Riley Park', 1.25]]))
      .toBe('Model,Hours\r\nJordan Ellis,2\r\nRiley Park,1.25\r\n');
  });

  it('quotes values with commas, quotes or line breaks', () => {
    expect(toCsv(['Class'], [['Drawing, Advanced'], ['The "Big" Class'], ['Two\nlines']]))
      .toBe('Class\r\n"Drawing, Advanced"\r\n"The ""Big"" Class"\r\n"Two\nlines"\r\n');
  });

  it("keeps a value that starts like a formula from running as one in a spreadsheet", () => {
    expect(toCsv(['Class'], [['=SUM(A1)'], ['+1'], ['-x'], ['@x']]))
      .toBe("Class\r\n'=SUM(A1)\r\n'+1\r\n'-x\r\n'@x\r\n");
  });

  it('writes empty cells for missing values', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\r\n,\r\n');
  });
});
