/**
 * Yoga enums - simplified for minimal TUI
 */

export const Align = {
  Auto: 0,
  FlexStart: 1,
  Center: 2,
  FlexEnd: 3,
  Stretch: 4,
} as const;
export type Align = (typeof Align)[keyof typeof Align];

export const FlexDirection = {
  Column: 0,
  ColumnReverse: 1,
  Row: 2,
  RowReverse: 3,
} as const;
export type FlexDirection = (typeof FlexDirection)[keyof typeof FlexDirection];

export const Justify = {
  FlexStart: 0,
  Center: 1,
  FlexEnd: 2,
  SpaceBetween: 3,
} as const;
export type Justify = (typeof Justify)[keyof typeof Justify];