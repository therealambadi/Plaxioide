/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export interface VisionAnnotation {
	labels: string[];
	objects: Array<{ name: string; score: number }>;
	text: string;
}

export interface IVisionService {
	readonly _serviceBrand: undefined;
	analyzeImage(base64: string, mimeType: string, project: string, region: string): Promise<VisionAnnotation | null>;
}

export const IVisionService = createDecorator<IVisionService>('visionService');

export class VisionService implements IVisionService {
	readonly _serviceBrand: undefined;
	private readonly _proxy: IVisionService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		this._proxy = ProxyChannel.toService<IVisionService>(mainProcessService.getChannel('void-channel-vision'));
	}

	analyzeImage(...params: Parameters<IVisionService['analyzeImage']>) {
		return this._proxy.analyzeImage(...params);
	}
}

registerSingleton(IVisionService, VisionService, InstantiationType.Delayed);
