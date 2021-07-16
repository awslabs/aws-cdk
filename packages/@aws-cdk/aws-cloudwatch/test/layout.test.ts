import { Column, IWidget, Row, Spacer, TextWidget } from '../lib';

describe('Layout', () => {
  test('row has the height of the tallest element', () => {
    // WHEN
    const row = new Row(
      new Spacer({ width: 10, height: 1 }),
      new Spacer({ width: 10, height: 4 }),
    );

    // THEN
    expect(4).toEqual(row.height);
    expect(20).toEqual(row.width);


  });

  test('spacer has default height and width', () => {
    // WHEN
    const spacer = new Spacer();

    // THEN
    expect(1).toEqual(spacer.height);
    expect(1).toEqual(spacer.width);


  });

  test('column has the width of the tallest element', () => {
    // WHEN
    const col = new Column(
      new Spacer({ width: 1, height: 1 }),
      new Spacer({ width: 4, height: 4 }),
    );

    // THEN
    expect(4).toEqual(col.width);
    expect(5).toEqual(col.height);


  });

  test('row wraps to width of 24, taking tallest widget into account while wrapping', () => {
    // Try the tall box in all positions
    for (const heights of [[4, 1, 1], [1, 4, 1], [1, 1, 4]]) {
      // GIVEN
      const widgets = [
        new TextWidget({ width: 7, height: heights[0], markdown: 'a' }),
        new TextWidget({ width: 7, height: heights[1], markdown: 'b' }),
        new TextWidget({ width: 7, height: heights[2], markdown: 'c' }),
        new TextWidget({ width: 7, height: 1, markdown: 'd' }),
      ];

      // WHEN
      const row = new Row(...widgets);
      row.position(1000, 1000); // Check that we correctly offset all inner widgets

      // THEN
      expect(21).toEqual(row.width);
      expect(5).toEqual(row.height);

      function assertWidgetPos(x: number, y: number, w: IWidget) {
        const json = w.toJson()[0];
        expect(x).toEqual(json.x);
        expect(y).toEqual(json.y);
      }

      assertWidgetPos(1000, 1000, widgets[0]);
      assertWidgetPos(1007, 1000, widgets[1]);
      assertWidgetPos(1014, 1000, widgets[2]);
      assertWidgetPos(1000, 1004, widgets[3]);
    }


  });

  test('row can fit exactly 3 8-wide widgets without wrapping', () => {
    // Try the tall box in all positions
    for (const heights of [[4, 1, 1], [1, 4, 1], [1, 1, 4]]) {
      // WHEN
      const row = new Row(
        new TextWidget({ width: 8, height: heights[0], markdown: 'a' }),
        new TextWidget({ width: 8, height: heights[1], markdown: 'b' }),
        new TextWidget({ width: 8, height: heights[2], markdown: 'c' }),
      );

      // THEN
      expect(24).toEqual(row.width);
      expect(4).toEqual(row.height);
    }


  });
});
