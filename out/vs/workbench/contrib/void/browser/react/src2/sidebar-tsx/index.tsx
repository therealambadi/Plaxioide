/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in project root.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js';
import { Sidebar } from './Sidebar.js';
import { LandingChat, VOLT_SUBMIT_EVENT } from './LandingChat.js';

export const mountSidebar = mountFnGenerator(Sidebar);
export const mountLandingChat = mountFnGenerator(LandingChat);
export { VOLT_SUBMIT_EVENT };