/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sidebarpart.css';
import './sidebarActions.js';
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position as SideBarPosition } from '../../../services/layout/browser/layoutService.js';
import { SidebarFocusContext, ActiveViewletContext } from '../../../common/contextkeys.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { contrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { SIDE_BAR_TITLE_FOREGROUND, SIDE_BAR_TITLE_BORDER, SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND, SIDE_BAR_BORDER, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER } from '../../../common/theme.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { LayoutPriority } from '../../../../base/browser/ui/grid/grid.js';
import { assertIsDefined } from '../../../../base/common/types.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { AbstractPaneCompositePart, CompositeBarPosition } from '../paneCompositePart.js';
import { ActivityBarCompositeBar, ActivitybarPart } from '../activitybar/activitybarPart.js';
import { ActionsOrientation } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { HoverPosition } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { IPaneCompositeBarOptions } from '../paneCompositeBar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Action2, IMenuService, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Separator } from '../../../../base/common/actions.js';
import { ToggleActivityBarVisibilityActionId } from '../../actions/layoutActions.js';
import { localize2 } from '../../../../nls.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';

export class SidebarPart extends AbstractPaneCompositePart {

	static readonly activeViewletSettingsKey = 'workbench.sidebar.activeviewletid';

	//#region IView

	readonly minimumWidth: number = 170;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	override get snap(): boolean { return true; }

	readonly priority: LayoutPriority = LayoutPriority.Low;

	get preferredWidth(): number | undefined {
		const viewlet = this.getActivePaneComposite();

		if (!viewlet) {
			return;
		}

		const width = viewlet.getOptimalWidth();
		if (typeof width !== 'number') {
			return;
		}

		return Math.max(width, 300);
	}

	private readonly activityBarPart = this._register(this.instantiationService.createInstance(ActivitybarPart, this));

	//#endregion

	constructor(
		@INotificationService notificationService: INotificationService,
		@IStorageService storageService: IStorageService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IHoverService hoverService: IHoverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IMenuService menuService: IMenuService,
	) {
		super(
			Parts.SIDEBAR_PART,
			{ hasTitle: false, borderWidth: () => (this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder)) ? 1 : 0 },
			SidebarPart.activeViewletSettingsKey,
			ActiveViewletContext.bindTo(contextKeyService),
			SidebarFocusContext.bindTo(contextKeyService),
			'sideBar',
			'viewlet',
			SIDE_BAR_TITLE_FOREGROUND,
			SIDE_BAR_TITLE_BORDER,
			notificationService,
			storageService,
			contextMenuService,
			layoutService,
			keybindingService,
			hoverService,
			instantiationService,
			themeService,
			viewDescriptorService,
			contextKeyService,
			extensionService,
			menuService,
		);

		this.rememberActivityBarVisiblePosition();
		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
				this.onDidChangeActivityBarLocation();
			}
		}));

		this.registerActions();

		// PLC: when the active composite changes, re-run layout to show/hide Library panel
		this._register(this.onDidPaneCompositeOpen((_e) => {
			if (this._plcLastWidth) {
				this.layout(this._plcLastWidth, this._plcLastHeight!, this._plcLastTop!, this._plcLastLeft!);
			}
		}));
	}

	// PLC Library panel split state
	private _plcLastWidth: number | undefined;
	private _plcLastHeight: number | undefined;
	private _plcLastTop: number | undefined;
	private _plcLastLeft: number | undefined;
	private _plcSplitRatio: number | undefined;
	private _plcSash: HTMLElement | undefined;
	private _plcLibraryPanel: HTMLElement | undefined;
	private _plcDragging: boolean = false;

	private onDidChangeActivityBarLocation(): void {
		this.activityBarPart.hide();

		this.updateCompositeBar();

		const id = this.getActiveComposite()?.getId();
		if (id) {
			this.onTitleAreaUpdate(id);
		}

		if (this.shouldShowActivityBar()) {
			this.activityBarPart.show();
		}

		this.rememberActivityBarVisiblePosition();
	}

	override updateStyles(): void {
		super.updateStyles();

		const container = assertIsDefined(this.getContainer());

		container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || '';
		container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || '';

		const borderColor = this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder);
		const isPositionLeft = this.layoutService.getSideBarPosition() === SideBarPosition.LEFT;
		container.style.borderRightWidth = borderColor && isPositionLeft ? '1px' : '';
		container.style.borderRightStyle = borderColor && isPositionLeft ? 'solid' : '';
		container.style.borderRightColor = isPositionLeft ? borderColor || '' : '';
		container.style.borderLeftWidth = borderColor && !isPositionLeft ? '1px' : '';
		container.style.borderLeftStyle = borderColor && !isPositionLeft ? 'solid' : '';
		container.style.borderLeftColor = !isPositionLeft ? borderColor || '' : '';
		container.style.outlineColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? '';
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
			return;
		}

		this._plcLastWidth = width;
		this._plcLastHeight = height;
		this._plcLastTop = top;
		this._plcLastLeft = left;
		const activeId = this.getActiveComposite()?.getId();
		const isExplorer = activeId === 'workbench.view.explorer';

		// Lazily create Library panel elements on first Explorer layout
		if (isExplorer && !this._plcLibraryPanel) {
			this._plcInitLibrary();
			console.log('[PlcLibrary] init done, panel:', !!this._plcLibraryPanel, 'h:', height);
		}

		super.layout(width, height, top, left);

		if (isExplorer && this._plcLibraryPanel) {
			const splitRatio = this._plcSplitRatio || 0.55;
			const sashH = 4;
			const contentArea = this.getContentArea();
			if (!contentArea) { return; }
			const fullH = parseInt(contentArea.style.height) || contentArea.getBoundingClientRect().height;
			const topH = Math.max(80, Math.floor(fullH * splitRatio));
			const bottomH = Math.max(80, fullH - topH - sashH);

			// Constrain explorer viewlet
			const explorerEl = contentArea.querySelector('#workbench\\.view\\.explorer') as HTMLElement | null;
			if (explorerEl) {
				explorerEl.style.height = topH + 'px';
				explorerEl.style.maxHeight = topH + 'px';
				explorerEl.style.overflow = 'hidden';
			}

			// Re-layout composite with reduced height
			const composite = this.getActivePaneComposite();
			if (composite) {
				try { composite.layout({ width, height: topH }); } catch { /* ignore */ }
			}

			if (this._plcSash) {
				this._plcSash.style.top = topH + 'px';
				this._plcSash.style.display = 'block';
			}
			this._plcLibraryPanel.style.top = (topH + sashH) + 'px';
			this._plcLibraryPanel.style.height = bottomH + 'px';
			this._plcLibraryPanel.style.display = 'flex';
		} else {
			if (this._plcSash) { this._plcSash.style.display = 'none'; }
			if (this._plcLibraryPanel) { this._plcLibraryPanel.style.display = 'none'; }
			const contentArea = this.getContentArea();
			if (contentArea) {
				const explorerEl = contentArea.querySelector('#workbench\\.view\\.explorer') as HTMLElement | null;
				if (explorerEl) {
					explorerEl.style.height = '';
					explorerEl.style.maxHeight = '';
					explorerEl.style.overflow = '';
				}
			}
		}
	}

	private _plcInitLibrary(): void {
		const contentArea = this.getContentArea();
		if (!contentArea) { return; }
		contentArea.style.position = 'relative';
		contentArea.style.overflow = 'hidden';

		// Sash
		const sash = document.createElement('div');
		sash.style.cssText = 'position:absolute;left:0;width:100%;height:4px;cursor:ns-resize;background:transparent;z-index:100;transition:background 0.1s;display:none;';
		sash.addEventListener('mouseenter', () => { sash.style.background = 'var(--vscode-sash-hoverBorder,var(--vscode-focusBorder,#007fd4))'; });
		sash.addEventListener('mouseleave', () => { if (!this._plcDragging) { sash.style.background = 'transparent'; } });
		contentArea.appendChild(sash);
		this._plcSash = sash;

		// Library panel
		const panel = document.createElement('div');
		panel.style.cssText = 'position:absolute;left:0;width:100%;display:none;flex-direction:column;overflow:hidden;background:var(--vscode-sideBar-background);';
		contentArea.appendChild(panel);
		this._plcLibraryPanel = panel;
		this._plcSplitRatio = 0.55;
		this._plcDragging = false;

		// Content (React mount)
		const content = document.createElement('div');
		content.style.cssText = 'flex:1 1 0;overflow:hidden;display:flex;flex-direction:column;';
		panel.appendChild(content);

		// React mount will be handled by plcExplorerPanel.js which finds this element by id
		content.id = 'plc-library-mount-point';

		// Sash drag
		sash.addEventListener('mousedown', (e) => {
			e.preventDefault();
			this._plcDragging = true;
			const startY = e.clientY;
			const startRatio = this._plcSplitRatio!;
			sash.style.background = 'var(--vscode-sash-hoverBorder,var(--vscode-focusBorder,#007fd4))';
			const onMove = (e2: MouseEvent) => {
				const ca = this.getContentArea();
				const fullH = ca ? ca.getBoundingClientRect().height : 600;
				const delta = e2.clientY - startY;
				this._plcSplitRatio = Math.max(0.15, Math.min(0.85, startRatio + delta / fullH));
				if (this._plcLastWidth) {
					this.layout(this._plcLastWidth, this._plcLastHeight!, this._plcLastTop!, this._plcLastLeft!);
				}
			};
			const onUp = () => {
				this._plcDragging = false;
				sash.style.background = 'transparent';
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
		});
	}

	protected override getTitleAreaDropDownAnchorAlignment(): AnchorAlignment {
		return this.layoutService.getSideBarPosition() === SideBarPosition.LEFT ? AnchorAlignment.LEFT : AnchorAlignment.RIGHT;
	}

	protected override createCompositeBar(): ActivityBarCompositeBar {
		return this.instantiationService.createInstance(ActivityBarCompositeBar, this.getCompositeBarOptions(), this.partId, this, false);
	}

	protected getCompositeBarOptions(): IPaneCompositeBarOptions {
		return {
			partContainerClass: 'sidebar',
			pinnedViewContainersKey: ActivitybarPart.pinnedViewContainersKey,
			placeholderViewContainersKey: ActivitybarPart.placeholderViewContainersKey,
			viewContainersWorkspaceStateKey: ActivitybarPart.viewContainersWorkspaceStateKey,
			icon: true,
			orientation: ActionsOrientation.HORIZONTAL,
			recomputeSizes: true,
			activityHoverOptions: {
				position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW,
			},
			fillExtraContextMenuActions: actions => {
				if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
					const viewsSubmenuAction = this.getViewsSubmenuAction();
					if (viewsSubmenuAction) {
						actions.push(new Separator());
						actions.push(viewsSubmenuAction);
					}
				}
			},
			compositeSize: 0,
			iconSize: 16,
			overflowActionSize: 30,
			colors: theme => ({
				activeBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
				inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
				activeBorderBottomColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER),
				activeForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND),
				inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND),
				badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
				badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
				dragAndDropBorder: theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER)
			}),
			compact: true
		};
	}

	protected shouldShowCompositeBar(): boolean {
		return true;
	}

	private shouldShowActivityBar(): boolean {
		return false;
	}

	protected getCompositeBarPosition(): CompositeBarPosition {
		const activityBarPosition = this.configurationService.getValue<ActivityBarPosition>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		switch (activityBarPosition) {
			case ActivityBarPosition.TOP: return CompositeBarPosition.TOP;
			case ActivityBarPosition.BOTTOM: return CompositeBarPosition.BOTTOM;
			case ActivityBarPosition.HIDDEN:
			case ActivityBarPosition.DEFAULT: // noop
			default: return CompositeBarPosition.TITLE;
		}
	}

	private rememberActivityBarVisiblePosition(): void {
		const activityBarPosition = this.configurationService.getValue<string>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition !== ActivityBarPosition.HIDDEN) {
			this.storageService.store(LayoutSettings.ACTIVITY_BAR_LOCATION, activityBarPosition, StorageScope.PROFILE, StorageTarget.USER);
		}
	}

	private getRememberedActivityBarVisiblePosition(): ActivityBarPosition {
		const activityBarPosition = this.storageService.get(LayoutSettings.ACTIVITY_BAR_LOCATION, StorageScope.PROFILE);
		switch (activityBarPosition) {
			case ActivityBarPosition.TOP: return ActivityBarPosition.TOP;
			case ActivityBarPosition.BOTTOM: return ActivityBarPosition.BOTTOM;
			default: return ActivityBarPosition.DEFAULT;
		}
	}

	override getPinnedPaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getPinnedPaneCompositeIds() : this.activityBarPart.getPinnedPaneCompositeIds();
	}

	override getVisiblePaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getVisiblePaneCompositeIds() : this.activityBarPart.getVisiblePaneCompositeIds();
	}

	override getPaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getPaneCompositeIds() : this.activityBarPart.getPaneCompositeIds();
	}

	async focusActivityBar(): Promise<void> {
		if (this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN) {
			await this.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, this.getRememberedActivityBarVisiblePosition());

			this.onDidChangeActivityBarLocation();
		}

		if (this.shouldShowCompositeBar()) {
			this.focusCompositeBar();
		} else {
			if (!this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
				this.layoutService.setPartHidden(false, Parts.ACTIVITYBAR_PART);
			}

			this.activityBarPart.show(true);
		}
	}

	private registerActions(): void {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: ToggleActivityBarVisibilityActionId,
					title: localize2('toggleActivityBar', "Toggle Activity Bar Visibility"),
				});
			}
			run(): Promise<void> {
				const value = that.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN ? that.getRememberedActivityBarVisiblePosition() : ActivityBarPosition.HIDDEN;
				return that.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, value);
			}
		}));
	}

	toJSON(): object {
		return {
			type: Parts.SIDEBAR_PART
		};
	}
}
