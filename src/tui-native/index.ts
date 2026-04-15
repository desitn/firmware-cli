/**
 * TUI components index
 */

import React from 'react';
export { useInput, useApp } from './input';
export { render } from './render';
export { colors, cursor, colorText } from './ansi';

// Box component - container
export function Box(props: { children?: React.ReactNode; flexDirection?: 'row' | 'column'; padding?: number; margin?: number; marginTop?: number; marginBottom?: number; marginY?: number; borderStyle?: 'single' | 'double'; borderColor?: string }): React.ReactElement {
  return React.createElement('box', props, props.children);
}

// Text component - styled text
export function Text(props: { children?: React.ReactNode; color?: string; bold?: boolean; dimColor?: boolean }): React.ReactElement {
  return React.createElement('text', props, props.children);
}

// SelectInput component
interface SelectItem { label: string; value: string }
export function SelectInput(props: { items: SelectItem[]; onSelect: (item: SelectItem) => void }): React.ReactElement {
  return React.createElement('select', props);
}

// Spinner component
export function Spinner(props: { type?: string; color?: string }): React.ReactElement {
  return React.createElement('spinner', props);
}

// TextInput component
export function TextInput(props: { value: string; onChange: (value: string) => void; onSubmit?: (value: string) => void }): React.ReactElement {
  return React.createElement('input', props);
}