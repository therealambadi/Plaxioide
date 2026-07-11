/*
 * PLC Logic Editor — bundle entry point.
 * Exports mountPlcEditor for use by the VS Code webview panel host.
 */

import { mountFnGenerator } from '../util/mountFnGenerator.js';
import { LogicTab } from './LogicTab.js';
import { PlcNavigator } from './PlcNavigator.js';
import { TagMonitorPanel } from './TagMonitorPanel.js';
import React from 'react';
import * as ReactDOM from 'react-dom/client';
export { clmToST, resolveTagDebugLeaf, buildTagIndexMap } from './clm/clmToST.js';

// Mounted in the left sidebar ViewPane (program list, tags, monitor status)
export const mountPlcNavigator = mountFnGenerator(PlcNavigator);

// Mounted in the center EditorPane (toolbar + LD/FBD/SFC canvas)
export const mountPlcEditor = mountFnGenerator(LogicTab);

// TagMonitorPanel — live variable value table
export const mountTagMonitor = (rootElement: HTMLElement) => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(TagMonitorPanel));
  return { dispose: () => root.unmount() };
};
