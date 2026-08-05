var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { findLast } from "../../../../base/common/arraysFind.js";
import { assertNever } from "../../../../base/common/assert.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { memoize } from "../../../../base/common/decorators.js";
import { createMatches } from "../../../../base/common/filters.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { basenameOrAuthority } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { EditorOpenSource, TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchCompressibleObjectTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { TestCommandId, Testing } from "../common/constants.js";
import { onObservableChange } from "../common/observableUtils.js";
import { BypassedFileCoverage, FileCoverage, getTotalCoveragePercent } from "../common/testCoverage.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { TestId } from "../common/testId.js";
import { TestingContextKeys } from "../common/testingContextKeys.js";
import { DetailType, TestResultState } from "../common/testTypes.js";
import * as coverUtils from "./codeCoverageDisplayUtils.js";
import { testingStatesToIcons, testingWasCovered } from "./icons.js";
import { ManagedTestCoverageBars } from "./testCoverageBars.js";
var CoverageSortOrder = /* @__PURE__ */ ((CoverageSortOrder2) => {
  CoverageSortOrder2[CoverageSortOrder2["Coverage"] = 0] = "Coverage";
  CoverageSortOrder2[CoverageSortOrder2["Location"] = 1] = "Location";
  CoverageSortOrder2[CoverageSortOrder2["Name"] = 2] = "Name";
  return CoverageSortOrder2;
})(CoverageSortOrder || {});
let TestCoverageView = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, coverageService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.coverageService = coverageService;
    this.tree = new MutableDisposable();
    this.sortOrder = observableValue("sortOrder", 1 /* Location */);
  }
  renderBody(container) {
    super.renderBody(container);
    const labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
    this._register(autorun((reader) => {
      const coverage = this.coverageService.selected.read(reader);
      if (coverage) {
        const t = this.tree.value ??= this.instantiationService.createInstance(TestCoverageTree, container, labels, this.sortOrder);
        t.setInput(coverage, this.coverageService.filterToTest.read(reader));
      } else {
        this.tree.clear();
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.value?.layout(height, width);
  }
};
TestCoverageView = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ITestCoverageService)
], TestCoverageView);
let fnNodeId = 0;
class DeclarationCoverageNode {
  constructor(uri, data, details) {
    this.uri = uri;
    this.data = data;
    this.id = String(fnNodeId++);
    this.containedDetails = /* @__PURE__ */ new Set();
    this.children = [];
    if (data.location instanceof Range) {
      for (const detail of details) {
        if (this.contains(detail.location)) {
          this.containedDetails.add(detail);
        }
      }
    }
  }
  get hits() {
    return this.data.count;
  }
  get label() {
    return this.data.name;
  }
  get location() {
    return this.data.location;
  }
  get tpc() {
    const attr = this.attributableCoverage();
    return attr && getTotalCoveragePercent(attr.statement, attr.branch, void 0);
  }
  /** Gets whether this function has a defined range and contains the given range. */
  contains(location) {
    const own = this.data.location;
    return own instanceof Range && (location instanceof Range ? own.containsRange(location) : own.containsPosition(location));
  }
  attributableCoverage() {
    const { location, count } = this.data;
    if (!(location instanceof Range) || !count) {
      return;
    }
    const statement = { covered: 0, total: 0 };
    const branch = { covered: 0, total: 0 };
    for (const detail of this.containedDetails) {
      if (detail.type !== DetailType.Statement) {
        continue;
      }
      statement.covered += detail.count ? 1 : 0;
      statement.total++;
      if (detail.branches) {
        for (const { count: count2 } of detail.branches) {
          branch.covered += count2 ? 1 : 0;
          branch.total++;
        }
      }
    }
    return { statement, branch };
  }
}
__decorateClass([
  memoize
], DeclarationCoverageNode.prototype, "attributableCoverage", 1);
class RevealUncoveredDeclarations {
  constructor(n) {
    this.n = n;
    this.id = String(fnNodeId++);
  }
  get label() {
    return localize("functionsWithoutCoverage", "{0} declarations without coverage...", this.n);
  }
}
class CurrentlyFilteredTo {
  constructor(testItem) {
    this.testItem = testItem;
    this.id = String(fnNodeId++);
  }
  get label() {
    return localize("filteredToTest", 'Showing coverage for "{0}"', this.testItem.label);
  }
}
class LoadingDetails {
  constructor() {
    this.id = String(fnNodeId++);
    this.label = localize("loadingCoverageDetails", "Loading Coverage Details...");
  }
}
const isFileCoverage = (c) => typeof c === "object" && "value" in c;
const isDeclarationCoverage = (c) => c instanceof DeclarationCoverageNode;
const shouldShowDeclDetailsOnExpand = (c) => isFileCoverage(c) && c.value instanceof FileCoverage && !!c.value.declaration?.total;
let TestCoverageTree = class extends Disposable {
  constructor(container, labels, sortOrder, instantiationService, editorService, commandService) {
    super();
    this.inputDisposables = this._register(new DisposableStore());
    container.classList.add("testing-stdtree");
    this.tree = instantiationService.createInstance(
      WorkbenchCompressibleObjectTree,
      "TestCoverageView",
      container,
      new TestCoverageTreeListDelegate(),
      [
        instantiationService.createInstance(FileCoverageRenderer, labels),
        instantiationService.createInstance(DeclarationCoverageRenderer),
        instantiationService.createInstance(BasicRenderer),
        instantiationService.createInstance(CurrentlyFilteredToRenderer)
      ],
      {
        expandOnlyOnTwistieClick: true,
        sorter: new Sorter(sortOrder),
        keyboardNavigationLabelProvider: {
          getCompressedNodeKeyboardNavigationLabel(elements) {
            return elements.map((e) => this.getKeyboardNavigationLabel(e)).join("/");
          },
          getKeyboardNavigationLabel(e) {
            return isFileCoverage(e) ? basenameOrAuthority(e.value.uri) : e.label;
          }
        },
        accessibilityProvider: {
          getAriaLabel(element) {
            if (isFileCoverage(element)) {
              const name = basenameOrAuthority(element.value.uri);
              return localize("testCoverageItemLabel", "{0} coverage: {0}%", name, (element.value.tpc * 100).toFixed(2));
            } else {
              return element.label;
            }
          },
          getWidgetAriaLabel() {
            return localize("testCoverageTreeLabel", "Test Coverage Explorer");
          }
        },
        identityProvider: new TestCoverageIdentityProvider()
      }
    );
    this._register(autorun((reader) => {
      sortOrder.read(reader);
      this.tree.resort(null, true);
    }));
    this._register(this.tree);
    this._register(this.tree.onDidChangeCollapseState((e) => {
      const el = e.node.element;
      if (!e.node.collapsed && !e.node.children.length && el && shouldShowDeclDetailsOnExpand(el)) {
        if (el.value.hasSynchronousDetails) {
          this.tree.setChildren(el, [{ element: new LoadingDetails(), incompressible: true }]);
        }
        el.value.details().then((details) => this.updateWithDetails(el, details));
      }
    }));
    this._register(this.tree.onDidOpen((e) => {
      let resource;
      let selection;
      if (e.element) {
        if (isFileCoverage(e.element) && !e.element.children?.size) {
          resource = e.element.value.uri;
        } else if (isDeclarationCoverage(e.element)) {
          resource = e.element.uri;
          selection = e.element.location;
        } else if (e.element instanceof CurrentlyFilteredTo) {
          commandService.executeCommand(TestCommandId.CoverageFilterToTest);
          return;
        }
      }
      if (!resource) {
        return;
      }
      editorService.openEditor({
        resource,
        options: {
          selection: selection instanceof Position ? Range.fromPositions(selection, selection) : selection,
          revealIfOpened: true,
          selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport,
          preserveFocus: e.editorOptions.preserveFocus,
          pinned: e.editorOptions.pinned,
          source: EditorOpenSource.USER
        }
      }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
    }));
  }
  setInput(coverage, showOnlyTest) {
    this.inputDisposables.clear();
    let tree = coverage.tree;
    if (showOnlyTest) {
      tree = coverage.filterTreeForTest(showOnlyTest);
    }
    const files = [];
    for (let node of tree.nodes) {
      while (!(node.value instanceof FileCoverage) && node.children?.size === 1) {
        node = Iterable.first(node.children.values());
      }
      files.push(node);
    }
    const toChild = (value) => {
      const isFile = !value.children?.size;
      return {
        element: value,
        incompressible: isFile,
        collapsed: isFile,
        // directories can be expanded, and items with function info can be expanded
        collapsible: !isFile || !!value.value?.declaration?.total,
        children: value.children && Iterable.map(value.children?.values(), toChild)
      };
    };
    this.inputDisposables.add(onObservableChange(coverage.didAddCoverage, (nodes) => {
      const toRender = findLast(nodes, (n) => this.tree.hasElement(n));
      if (toRender) {
        this.tree.setChildren(
          toRender,
          Iterable.map(toRender.children?.values() || [], toChild),
          { diffIdentityProvider: { getId: (el) => el.value.id } }
        );
      }
    }));
    let children = Iterable.map(files, toChild);
    const filteredTo = showOnlyTest && coverage.result.getTestById(showOnlyTest.toString());
    if (filteredTo) {
      children = Iterable.concat(
        Iterable.single({
          element: new CurrentlyFilteredTo(filteredTo),
          incompressible: true
        }),
        children
      );
    }
    this.tree.setChildren(null, children);
  }
  layout(height, width) {
    this.tree.layout(height, width);
  }
  updateWithDetails(el, details) {
    if (!this.tree.hasElement(el)) {
      return;
    }
    const decl = [];
    for (const fn of details) {
      if (fn.type !== DetailType.Declaration) {
        continue;
      }
      let arr = decl;
      while (true) {
        const parent = arr.find((p) => p.containedDetails.has(fn));
        if (parent) {
          arr = parent.children;
        } else {
          break;
        }
      }
      arr.push(new DeclarationCoverageNode(el.value.uri, fn, details));
    }
    const makeChild = (fn) => ({
      element: fn,
      incompressible: true,
      collapsed: true,
      collapsible: fn.children.length > 0,
      children: fn.children.map(makeChild)
    });
    this.tree.setChildren(el, decl.map(makeChild));
  }
};
TestCoverageTree = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, ICommandService)
], TestCoverageTree);
class TestCoverageTreeListDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    if (isFileCoverage(element)) {
      return FileCoverageRenderer.ID;
    }
    if (isDeclarationCoverage(element)) {
      return DeclarationCoverageRenderer.ID;
    }
    if (element instanceof LoadingDetails || element instanceof RevealUncoveredDeclarations) {
      return BasicRenderer.ID;
    }
    if (element instanceof CurrentlyFilteredTo) {
      return CurrentlyFilteredToRenderer.ID;
    }
    assertNever(element);
  }
}
class Sorter {
  constructor(order) {
    this.order = order;
  }
  compare(a, b) {
    const order = this.order.get();
    if (isFileCoverage(a) && isFileCoverage(b)) {
      switch (order) {
        case 1 /* Location */:
        case 2 /* Name */:
          return a.value.uri.toString().localeCompare(b.value.uri.toString());
        case 0 /* Coverage */:
          return b.value.tpc - a.value.tpc;
      }
    } else if (isDeclarationCoverage(a) && isDeclarationCoverage(b)) {
      switch (order) {
        case 1 /* Location */:
          return Position.compare(
            a.location instanceof Range ? a.location.getStartPosition() : a.location,
            b.location instanceof Range ? b.location.getStartPosition() : b.location
          );
        case 2 /* Name */:
          return a.label.localeCompare(b.label);
        case 0 /* Coverage */: {
          const attrA = a.tpc;
          const attrB = b.tpc;
          return attrA !== void 0 && attrB !== void 0 && attrB - attrA || +b.hits - +a.hits || a.label.localeCompare(b.label);
        }
      }
    } else {
      return 0;
    }
  }
}
let CurrentlyFilteredToRenderer = class {
  constructor(menuService, contextKeyService) {
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.templateId = CurrentlyFilteredToRenderer.ID;
  }
  renderCompressedElements(node, index, templateData, height) {
    this.renderInner(node.element.elements[node.element.elements.length - 1], templateData);
  }
  renderTemplate(container) {
    container.classList.add("testing-stdtree-container");
    const label = dom.append(container, dom.$(".label"));
    const menu = this.menuService.getMenuActions(MenuId.TestCoverageFilterItem, this.contextKeyService, {
      shouldForwardArgs: true
    });
    const actions = new ActionBar(container);
    actions.push(getActionBarActions(menu, "inline").primary, { icon: true, label: false });
    actions.domNode.style.display = "block";
    return { label, actions };
  }
  renderElement(element, index, templateData, height) {
    this.renderInner(element.element, templateData);
  }
  disposeTemplate(templateData) {
    templateData.actions.dispose();
  }
  renderInner(element, container) {
    container.label.innerText = element.label;
  }
};
CurrentlyFilteredToRenderer.ID = "C";
CurrentlyFilteredToRenderer = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IContextKeyService)
], CurrentlyFilteredToRenderer);
let FileCoverageRenderer = class {
  constructor(labels, labelService, instantiationService) {
    this.labels = labels;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.templateId = FileCoverageRenderer.ID;
  }
  /** @inheritdoc */
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    container.classList.add("testing-stdtree-container", "test-coverage-list-item");
    return {
      container,
      bars: templateDisposables.add(this.instantiationService.createInstance(ManagedTestCoverageBars, { compact: false, container })),
      label: templateDisposables.add(this.labels.create(container, {
        supportHighlights: true
      })),
      elementsDisposables: templateDisposables.add(new DisposableStore()),
      templateDisposables
    };
  }
  /** @inheritdoc */
  renderElement(node, _index, templateData) {
    this.doRender(node.element, templateData, node.filterData);
  }
  /** @inheritdoc */
  renderCompressedElements(node, _index, templateData) {
    this.doRender(node.element.elements, templateData, node.filterData);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  /** @inheritdoc */
  doRender(element, templateData, filterData) {
    templateData.elementsDisposables.clear();
    const stat = element instanceof Array ? element[element.length - 1] : element;
    const file = stat.value;
    const name = element instanceof Array ? element.map((e) => basenameOrAuthority(e.value.uri)) : basenameOrAuthority(file.uri);
    if (file instanceof BypassedFileCoverage) {
      templateData.bars.setCoverageInfo(void 0);
    } else {
      templateData.elementsDisposables.add(autorun((reader) => {
        stat.value?.didChange.read(reader);
        templateData.bars.setCoverageInfo(file);
      }));
      templateData.bars.setCoverageInfo(file);
    }
    templateData.label.setResource({ resource: file.uri, name }, {
      fileKind: stat.children?.size ? FileKind.FOLDER : FileKind.FILE,
      matches: createMatches(filterData),
      separator: this.labelService.getSeparator(file.uri.scheme, file.uri.authority),
      extraClasses: ["label"]
    });
  }
};
FileCoverageRenderer.ID = "F";
FileCoverageRenderer = __decorateClass([
  __decorateParam(1, ILabelService),
  __decorateParam(2, IInstantiationService)
], FileCoverageRenderer);
let DeclarationCoverageRenderer = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this.templateId = DeclarationCoverageRenderer.ID;
  }
  /** @inheritdoc */
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    container.classList.add("test-coverage-list-item", "testing-stdtree-container");
    const icon = dom.append(container, dom.$(".state"));
    const label = dom.append(container, dom.$(".label"));
    return {
      container,
      bars: templateDisposables.add(this.instantiationService.createInstance(ManagedTestCoverageBars, { compact: false, container })),
      templateDisposables,
      icon,
      label
    };
  }
  /** @inheritdoc */
  renderElement(node, _index, templateData) {
    this.doRender(node.element, templateData, node.filterData);
  }
  /** @inheritdoc */
  renderCompressedElements(node, _index, templateData) {
    this.doRender(node.element.elements[node.element.elements.length - 1], templateData, node.filterData);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  /** @inheritdoc */
  doRender(element, templateData, _filterData) {
    const covered = !!element.hits;
    const icon = covered ? testingWasCovered : testingStatesToIcons.get(TestResultState.Unset);
    templateData.container.classList.toggle("not-covered", !covered);
    templateData.icon.className = `computed-state ${ThemeIcon.asClassName(icon)}`;
    templateData.label.innerText = element.label;
    templateData.bars.setCoverageInfo(element.attributableCoverage());
  }
};
DeclarationCoverageRenderer.ID = "N";
DeclarationCoverageRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], DeclarationCoverageRenderer);
const _BasicRenderer = class _BasicRenderer {
  constructor() {
    this.templateId = _BasicRenderer.ID;
  }
  renderCompressedElements(node, _index, container) {
    this.renderInner(node.element.elements[node.element.elements.length - 1], container);
  }
  renderTemplate(container) {
    return container;
  }
  renderElement(node, index, container) {
    this.renderInner(node.element, container);
  }
  disposeTemplate() {
  }
  renderInner(element, container) {
    container.innerText = element.label;
  }
};
_BasicRenderer.ID = "B";
let BasicRenderer = _BasicRenderer;
class TestCoverageIdentityProvider {
  getId(element) {
    return isFileCoverage(element) ? element.value.uri.toString() : element.id;
  }
}
registerAction2(class TestCoverageChangePerTestFilterAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CoverageFilterToTest,
      category: Categories.Test,
      title: localize2("testing.changeCoverageFilter", "Filter Coverage by Test"),
      icon: Codicon.filter,
      toggled: {
        icon: Codicon.filterFilled,
        condition: TestingContextKeys.isCoverageFilteredToTest
      },
      menu: [
        { id: MenuId.CommandPalette, when: TestingContextKeys.hasPerTestCoverage },
        { id: MenuId.TestCoverageFilterItem, group: "inline" },
        {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.and(TestingContextKeys.hasPerTestCoverage, ContextKeyExpr.equals("view", Testing.CoverageViewId)),
          group: "navigation"
        }
      ]
    });
  }
  run(accessor) {
    const coverageService = accessor.get(ITestCoverageService);
    const quickInputService = accessor.get(IQuickInputService);
    const coverage = coverageService.selected.get();
    if (!coverage) {
      return;
    }
    const tests = [...coverage.allPerTestIDs()].map(TestId.fromString);
    const commonPrefix = TestId.getLengthOfCommonPrefix(tests.length, (i) => tests[i]);
    const result = coverage.result;
    const previousSelection = coverageService.filterToTest.get();
    const previousSelectionStr = previousSelection?.toString();
    const items = [
      { label: coverUtils.labels.allTests, id: void 0 },
      { type: "separator" },
      ...tests.map((testId) => ({ label: coverUtils.getLabelForItem(result, testId, commonPrefix), testId }))
    ];
    quickInputService.pick(items, {
      activeItem: items.find((item) => "testId" in item && item.testId?.toString() === previousSelectionStr),
      placeHolder: coverUtils.labels.pickShowCoverage,
      onDidFocus: (entry) => {
        coverageService.filterToTest.set(entry.testId, void 0);
      }
    }).then((selected) => {
      coverageService.filterToTest.set(selected ? selected.testId : previousSelection, void 0);
    });
  }
});
registerAction2(class TestCoverageChangeSortingAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.CoverageViewChangeSorting,
      viewId: Testing.CoverageViewId,
      title: localize2("testing.changeCoverageSort", "Change Sort Order"),
      icon: Codicon.sortPrecedence,
      menu: {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.equals("view", Testing.CoverageViewId),
        group: "navigation"
      }
    });
  }
  runInView(accessor, view) {
    const disposables = new DisposableStore();
    const quickInput = disposables.add(accessor.get(IQuickInputService).createQuickPick());
    const items = [
      { label: localize("testing.coverageSortByLocation", "Sort by Location"), value: 1 /* Location */, description: localize("testing.coverageSortByLocationDescription", "Files are sorted alphabetically, declarations are sorted by position") },
      { label: localize("testing.coverageSortByCoverage", "Sort by Coverage"), value: 0 /* Coverage */, description: localize("testing.coverageSortByCoverageDescription", "Files and declarations are sorted by total coverage") },
      { label: localize("testing.coverageSortByName", "Sort by Name"), value: 2 /* Name */, description: localize("testing.coverageSortByNameDescription", "Files and declarations are sorted alphabetically") }
    ];
    quickInput.placeholder = localize("testing.coverageSortPlaceholder", "Sort the Test Coverage view...");
    quickInput.items = items;
    quickInput.show();
    disposables.add(quickInput.onDidHide(() => disposables.dispose()));
    disposables.add(quickInput.onDidAccept(() => {
      const picked = quickInput.selectedItems[0]?.value;
      if (picked !== void 0) {
        view.sortOrder.set(picked, void 0);
        quickInput.dispose();
      }
    }));
  }
});
export {
  TestCoverageView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdENvdmVyYWdlVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzZWRUcmVlRWxlbWVudCwgSUNvbXByZXNzZWRUcmVlTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSVRyZWVOb2RlLCBJVHJlZVNvcnRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgZmluZExhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IGFzc2VydE5ldmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlLCBjcmVhdGVNYXRjaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIGF1dG9ydW4sIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSVByZWZpeFRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJlZml4VHJlZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZU9yQXV0aG9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IGdldEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3BlblNvdXJjZSwgVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hDb21wcmVzc2libGVPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZUxhYmVsLCBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IElWaWV3UGFuZU9wdGlvbnMsIFZpZXdBY3Rpb24sIFZpZXdQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEFDVElWRV9HUk9VUCwgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbW1hbmRJZCwgVGVzdGluZyB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgb25PYnNlcnZhYmxlQ2hhbmdlIH0gZnJvbSAnLi4vY29tbW9uL29ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBCeXBhc3NlZEZpbGVDb3ZlcmFnZSwgQ29tcHV0ZWRGaWxlQ292ZXJhZ2UsIEZpbGVDb3ZlcmFnZSwgVGVzdENvdmVyYWdlLCBnZXRUb3RhbENvdmVyYWdlUGVyY2VudCB9IGZyb20gJy4uL2NvbW1vbi90ZXN0Q292ZXJhZ2UuanMnO1xuaW1wb3J0IHsgSVRlc3RDb3ZlcmFnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdENvdmVyYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ292ZXJhZ2VEZXRhaWxzLCBEZXRhaWxUeXBlLCBJQ292ZXJhZ2VDb3VudCwgSURlY2xhcmF0aW9uQ292ZXJhZ2UsIElUZXN0SXRlbSwgVGVzdFJlc3VsdFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RUeXBlcy5qcyc7XG5pbXBvcnQgKiBhcyBjb3ZlclV0aWxzIGZyb20gJy4vY29kZUNvdmVyYWdlRGlzcGxheVV0aWxzLmpzJztcbmltcG9ydCB7IHRlc3RpbmdTdGF0ZXNUb0ljb25zLCB0ZXN0aW5nV2FzQ292ZXJlZCB9IGZyb20gJy4vaWNvbnMuanMnO1xuaW1wb3J0IHsgQ292ZXJhZ2VCYXJTb3VyY2UsIE1hbmFnZWRUZXN0Q292ZXJhZ2VCYXJzIH0gZnJvbSAnLi90ZXN0Q292ZXJhZ2VCYXJzLmpzJztcblxuY29uc3QgZW51bSBDb3ZlcmFnZVNvcnRPcmRlciB7XG5cdENvdmVyYWdlLFxuXHRMb2NhdGlvbixcblx0TmFtZSxcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RDb3ZlcmFnZVZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgdHJlZSA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxUZXN0Q292ZXJhZ2VUcmVlPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgc29ydE9yZGVyID0gb2JzZXJ2YWJsZVZhbHVlKCdzb3J0T3JkZXInLCBDb3ZlcmFnZVNvcnRPcmRlci5Mb2NhdGlvbik7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVRlc3RDb3ZlcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb3ZlcmFnZVNlcnZpY2U6IElUZXN0Q292ZXJhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihvcHRpb25zLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHRjb25zdCBsYWJlbHMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWxzLCB7IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogdGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5IH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGNvdmVyYWdlID0gdGhpcy5jb3ZlcmFnZVNlcnZpY2Uuc2VsZWN0ZWQucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGNvdmVyYWdlKSB7XG5cdFx0XHRcdGNvbnN0IHQgPSAodGhpcy50cmVlLnZhbHVlID8/PSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb3ZlcmFnZVRyZWUsIGNvbnRhaW5lciwgbGFiZWxzLCB0aGlzLnNvcnRPcmRlcikpO1xuXHRcdFx0XHR0LnNldElucHV0KGNvdmVyYWdlLCB0aGlzLmNvdmVyYWdlU2VydmljZS5maWx0ZXJUb1Rlc3QucmVhZChyZWFkZXIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudHJlZS5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLnRyZWUudmFsdWU/LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxufVxuXG5sZXQgZm5Ob2RlSWQgPSAwO1xuXG5jbGFzcyBEZWNsYXJhdGlvbkNvdmVyYWdlTm9kZSB7XG5cdHB1YmxpYyByZWFkb25seSBpZCA9IFN0cmluZyhmbk5vZGVJZCsrKTtcblx0cHVibGljIHJlYWRvbmx5IGNvbnRhaW5lZERldGFpbHMgPSBuZXcgU2V0PENvdmVyYWdlRGV0YWlscz4oKTtcblx0cHVibGljIHJlYWRvbmx5IGNoaWxkcmVuOiBEZWNsYXJhdGlvbkNvdmVyYWdlTm9kZVtdID0gW107XG5cblx0cHVibGljIGdldCBoaXRzKCkge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuY291bnQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLmRhdGEubmFtZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbG9jYXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5sb2NhdGlvbjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdHBjKCkge1xuXHRcdGNvbnN0IGF0dHIgPSB0aGlzLmF0dHJpYnV0YWJsZUNvdmVyYWdlKCk7XG5cdFx0cmV0dXJuIGF0dHIgJiYgZ2V0VG90YWxDb3ZlcmFnZVBlcmNlbnQoYXR0ci5zdGF0ZW1lbnQsIGF0dHIuYnJhbmNoLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHVyaTogVVJJLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGF0YTogSURlY2xhcmF0aW9uQ292ZXJhZ2UsXG5cdFx0ZGV0YWlsczogcmVhZG9ubHkgQ292ZXJhZ2VEZXRhaWxzW10sXG5cdCkge1xuXHRcdGlmIChkYXRhLmxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UpIHtcblx0XHRcdGZvciAoY29uc3QgZGV0YWlsIG9mIGRldGFpbHMpIHtcblx0XHRcdFx0aWYgKHRoaXMuY29udGFpbnMoZGV0YWlsLmxvY2F0aW9uKSkge1xuXHRcdFx0XHRcdHRoaXMuY29udGFpbmVkRGV0YWlscy5hZGQoZGV0YWlsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKiBHZXRzIHdoZXRoZXIgdGhpcyBmdW5jdGlvbiBoYXMgYSBkZWZpbmVkIHJhbmdlIGFuZCBjb250YWlucyB0aGUgZ2l2ZW4gcmFuZ2UuICovXG5cdHB1YmxpYyBjb250YWlucyhsb2NhdGlvbjogUmFuZ2UgfCBQb3NpdGlvbikge1xuXHRcdGNvbnN0IG93biA9IHRoaXMuZGF0YS5sb2NhdGlvbjtcblx0XHRyZXR1cm4gb3duIGluc3RhbmNlb2YgUmFuZ2UgJiYgKGxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UgPyBvd24uY29udGFpbnNSYW5nZShsb2NhdGlvbikgOiBvd24uY29udGFpbnNQb3NpdGlvbihsb2NhdGlvbikpO1xuXHR9XG5cblx0LyoqXG5cdCAqIElmIHRoZSBmdW5jdGlvbiBkZWZpbmVzIGEgcmFuZ2UsIHdlIGNhbiBsb29rIGF0IHN0YXRlbWVudHMgd2l0aGluIHRoZVxuXHQgKiBmdW5jdGlvbiB0byBnZXQgdG90YWwgY292ZXJhZ2UgZm9yIHRoZSBmdW5jdGlvbiwgcmF0aGVyIHRoYW4gYSBib29sZWFuXG5cdCAqIHllcy9uby5cblx0ICovXG5cdEBtZW1vaXplXG5cdHB1YmxpYyBhdHRyaWJ1dGFibGVDb3ZlcmFnZSgpIHtcblx0XHRjb25zdCB7IGxvY2F0aW9uLCBjb3VudCB9ID0gdGhpcy5kYXRhO1xuXHRcdGlmICghKGxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UpIHx8ICFjb3VudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXRlbWVudDogSUNvdmVyYWdlQ291bnQgPSB7IGNvdmVyZWQ6IDAsIHRvdGFsOiAwIH07XG5cdFx0Y29uc3QgYnJhbmNoOiBJQ292ZXJhZ2VDb3VudCA9IHsgY292ZXJlZDogMCwgdG90YWw6IDAgfTtcblx0XHRmb3IgKGNvbnN0IGRldGFpbCBvZiB0aGlzLmNvbnRhaW5lZERldGFpbHMpIHtcblx0XHRcdGlmIChkZXRhaWwudHlwZSAhPT0gRGV0YWlsVHlwZS5TdGF0ZW1lbnQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHN0YXRlbWVudC5jb3ZlcmVkICs9IGRldGFpbC5jb3VudCA/IDEgOiAwO1xuXHRcdFx0c3RhdGVtZW50LnRvdGFsKys7XG5cdFx0XHRpZiAoZGV0YWlsLmJyYW5jaGVzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgeyBjb3VudCB9IG9mIGRldGFpbC5icmFuY2hlcykge1xuXHRcdFx0XHRcdGJyYW5jaC5jb3ZlcmVkICs9IGNvdW50ID8gMSA6IDA7XG5cdFx0XHRcdFx0YnJhbmNoLnRvdGFsKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBzdGF0ZW1lbnQsIGJyYW5jaCB9IHNhdGlzZmllcyBDb3ZlcmFnZUJhclNvdXJjZTtcblx0fVxufVxuXG5jbGFzcyBSZXZlYWxVbmNvdmVyZWREZWNsYXJhdGlvbnMge1xuXHRwdWJsaWMgcmVhZG9ubHkgaWQgPSBTdHJpbmcoZm5Ob2RlSWQrKyk7XG5cblx0cHVibGljIGdldCBsYWJlbCgpIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2Z1bmN0aW9uc1dpdGhvdXRDb3ZlcmFnZScsIFwiezB9IGRlY2xhcmF0aW9ucyB3aXRob3V0IGNvdmVyYWdlLi4uXCIsIHRoaXMubik7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgbjogbnVtYmVyKSB7IH1cbn1cblxuY2xhc3MgQ3VycmVudGx5RmlsdGVyZWRUbyB7XG5cdHB1YmxpYyByZWFkb25seSBpZCA9IFN0cmluZyhmbk5vZGVJZCsrKTtcblxuXHRwdWJsaWMgZ2V0IGxhYmVsKCkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnZmlsdGVyZWRUb1Rlc3QnLCBcIlNob3dpbmcgY292ZXJhZ2UgZm9yIFxcXCJ7MH1cXFwiXCIsIHRoaXMudGVzdEl0ZW0ubGFiZWwpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHRlc3RJdGVtOiBJVGVzdEl0ZW0pIHsgfVxufVxuXG5jbGFzcyBMb2FkaW5nRGV0YWlscyB7XG5cdHB1YmxpYyByZWFkb25seSBpZCA9IFN0cmluZyhmbk5vZGVJZCsrKTtcblx0cHVibGljIHJlYWRvbmx5IGxhYmVsID0gbG9jYWxpemUoJ2xvYWRpbmdDb3ZlcmFnZURldGFpbHMnLCBcIkxvYWRpbmcgQ292ZXJhZ2UgRGV0YWlscy4uLlwiKTtcbn1cblxuLyoqIFR5cGUgb2Ygbm9kZXMgcmV0dXJuZWQgZnJvbSB7QGxpbmsgVGVzdENvdmVyYWdlfS4gTm90ZTogdmFsdWUgaXMgKmFsd2F5cyogZGVmaW5lZC4gKi9cbnR5cGUgVGVzdENvdmVyYWdlRmlsZU5vZGUgPSBJUHJlZml4VHJlZU5vZGU8Q29tcHV0ZWRGaWxlQ292ZXJhZ2UgfCBGaWxlQ292ZXJhZ2U+O1xudHlwZSBDb3ZlcmFnZVRyZWVFbGVtZW50ID0gVGVzdENvdmVyYWdlRmlsZU5vZGUgfCBEZWNsYXJhdGlvbkNvdmVyYWdlTm9kZSB8IExvYWRpbmdEZXRhaWxzIHwgUmV2ZWFsVW5jb3ZlcmVkRGVjbGFyYXRpb25zIHwgQ3VycmVudGx5RmlsdGVyZWRUbztcblxuY29uc3QgaXNGaWxlQ292ZXJhZ2UgPSAoYzogQ292ZXJhZ2VUcmVlRWxlbWVudCk6IGMgaXMgVGVzdENvdmVyYWdlRmlsZU5vZGUgPT4gdHlwZW9mIGMgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gYztcbmNvbnN0IGlzRGVjbGFyYXRpb25Db3ZlcmFnZSA9IChjOiBDb3ZlcmFnZVRyZWVFbGVtZW50KTogYyBpcyBEZWNsYXJhdGlvbkNvdmVyYWdlTm9kZSA9PiBjIGluc3RhbmNlb2YgRGVjbGFyYXRpb25Db3ZlcmFnZU5vZGU7XG5jb25zdCBzaG91bGRTaG93RGVjbERldGFpbHNPbkV4cGFuZCA9IChjOiBDb3ZlcmFnZVRyZWVFbGVtZW50KTogYyBpcyBJUHJlZml4VHJlZU5vZGU8RmlsZUNvdmVyYWdlPiA9PlxuXHRpc0ZpbGVDb3ZlcmFnZShjKSAmJiBjLnZhbHVlIGluc3RhbmNlb2YgRmlsZUNvdmVyYWdlICYmICEhYy52YWx1ZS5kZWNsYXJhdGlvbj8udG90YWw7XG5cbmNsYXNzIFRlc3RDb3ZlcmFnZVRyZWUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSB0cmVlOiBXb3JrYmVuY2hDb21wcmVzc2libGVPYmplY3RUcmVlPENvdmVyYWdlVHJlZUVsZW1lbnQsIHZvaWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGlucHV0RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0bGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRzb3J0T3JkZXI6IElPYnNlcnZhYmxlPENvdmVyYWdlU29ydE9yZGVyPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd0ZXN0aW5nLXN0ZHRyZWUnKTtcblxuXHRcdHRoaXMudHJlZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxDb3ZlcmFnZVRyZWVFbGVtZW50LCB2b2lkPixcblx0XHRcdCdUZXN0Q292ZXJhZ2VWaWV3Jyxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdG5ldyBUZXN0Q292ZXJhZ2VUcmVlTGlzdERlbGVnYXRlKCksXG5cdFx0XHRbXG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVDb3ZlcmFnZVJlbmRlcmVyLCBsYWJlbHMpLFxuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWNsYXJhdGlvbkNvdmVyYWdlUmVuZGVyZXIpLFxuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCYXNpY1JlbmRlcmVyKSxcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3VycmVudGx5RmlsdGVyZWRUb1JlbmRlcmVyKSxcblx0XHRcdF0sXG5cdFx0XHR7XG5cdFx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljazogdHJ1ZSxcblx0XHRcdFx0c29ydGVyOiBuZXcgU29ydGVyKHNvcnRPcmRlciksXG5cdFx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRDb21wcmVzc2VkTm9kZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnRzOiBDb3ZlcmFnZVRyZWVFbGVtZW50W10pIHtcblx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50cy5tYXAoZSA9PiB0aGlzLmdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGUpKS5qb2luKCcvJyk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlOiBDb3ZlcmFnZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXNGaWxlQ292ZXJhZ2UoZSlcblx0XHRcdFx0XHRcdFx0PyBiYXNlbmFtZU9yQXV0aG9yaXR5KGUudmFsdWUhLnVyaSlcblx0XHRcdFx0XHRcdFx0OiBlLmxhYmVsO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbChlbGVtZW50OiBDb3ZlcmFnZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRpZiAoaXNGaWxlQ292ZXJhZ2UoZWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbmFtZSA9IGJhc2VuYW1lT3JBdXRob3JpdHkoZWxlbWVudC52YWx1ZSEudXJpKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0Q292ZXJhZ2VJdGVtTGFiZWwnLCBcInswfSBjb3ZlcmFnZTogezB9JVwiLCBuYW1lLCAoZWxlbWVudC52YWx1ZSEudHBjICogMTAwKS50b0ZpeGVkKDIpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmxhYmVsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0Q292ZXJhZ2VUcmVlTGFiZWwnLCBcIlRlc3QgQ292ZXJhZ2UgRXhwbG9yZXJcIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiBuZXcgVGVzdENvdmVyYWdlSWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRzb3J0T3JkZXIucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy50cmVlLnJlc29ydChudWxsLCB0cnVlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGUoZSA9PiB7XG5cdFx0XHRjb25zdCBlbCA9IGUubm9kZS5lbGVtZW50O1xuXHRcdFx0aWYgKCFlLm5vZGUuY29sbGFwc2VkICYmICFlLm5vZGUuY2hpbGRyZW4ubGVuZ3RoICYmIGVsICYmIHNob3VsZFNob3dEZWNsRGV0YWlsc09uRXhwYW5kKGVsKSkge1xuXHRcdFx0XHRpZiAoZWwudmFsdWUhLmhhc1N5bmNocm9ub3VzRGV0YWlscykge1xuXHRcdFx0XHRcdHRoaXMudHJlZS5zZXRDaGlsZHJlbihlbCwgW3sgZWxlbWVudDogbmV3IExvYWRpbmdEZXRhaWxzKCksIGluY29tcHJlc3NpYmxlOiB0cnVlIH1dKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGVsLnZhbHVlIS5kZXRhaWxzKCkudGhlbihkZXRhaWxzID0+IHRoaXMudXBkYXRlV2l0aERldGFpbHMoZWwsIGRldGFpbHMpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkT3BlbihlID0+IHtcblx0XHRcdGxldCByZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHNlbGVjdGlvbjogUmFuZ2UgfCBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChlLmVsZW1lbnQpIHtcblx0XHRcdFx0aWYgKGlzRmlsZUNvdmVyYWdlKGUuZWxlbWVudCkgJiYgIWUuZWxlbWVudC5jaGlsZHJlbj8uc2l6ZSkge1xuXHRcdFx0XHRcdHJlc291cmNlID0gZS5lbGVtZW50LnZhbHVlIS51cmk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNEZWNsYXJhdGlvbkNvdmVyYWdlKGUuZWxlbWVudCkpIHtcblx0XHRcdFx0XHRyZXNvdXJjZSA9IGUuZWxlbWVudC51cmk7XG5cdFx0XHRcdFx0c2VsZWN0aW9uID0gZS5lbGVtZW50LmxvY2F0aW9uO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGUuZWxlbWVudCBpbnN0YW5jZW9mIEN1cnJlbnRseUZpbHRlcmVkVG8pIHtcblx0XHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChUZXN0Q29tbWFuZElkLkNvdmVyYWdlRmlsdGVyVG9UZXN0KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbjogc2VsZWN0aW9uIGluc3RhbmNlb2YgUG9zaXRpb24gPyBSYW5nZS5mcm9tUG9zaXRpb25zKHNlbGVjdGlvbiwgc2VsZWN0aW9uKSA6IHNlbGVjdGlvbixcblx0XHRcdFx0XHRyZXZlYWxJZk9wZW5lZDogdHJ1ZSxcblx0XHRcdFx0XHRzZWxlY3Rpb25SZXZlYWxUeXBlOiBUZXh0RWRpdG9yU2VsZWN0aW9uUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRcdFx0cHJlc2VydmVGb2N1czogZS5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMsXG5cdFx0XHRcdFx0cGlubmVkOiBlLmVkaXRvck9wdGlvbnMucGlubmVkLFxuXHRcdFx0XHRcdHNvdXJjZTogRWRpdG9yT3BlblNvdXJjZS5VU0VSLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSwgZS5zaWRlQnlTaWRlID8gU0lERV9HUk9VUCA6IEFDVElWRV9HUk9VUCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHNldElucHV0KGNvdmVyYWdlOiBUZXN0Q292ZXJhZ2UsIHNob3dPbmx5VGVzdD86IFRlc3RJZCkge1xuXHRcdHRoaXMuaW5wdXREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0bGV0IHRyZWUgPSBjb3ZlcmFnZS50cmVlO1xuXG5cdFx0Ly8gRmlsdGVyIHRvIG9ubHkgYSB0ZXN0LCBnZW5lcmF0ZSBhIG5ldyB0cmVlIHdpdGggb25seSB0aG9zZSBpdGVtcyBzZWxlY3RlZFxuXHRcdGlmIChzaG93T25seVRlc3QpIHtcblx0XHRcdHRyZWUgPSBjb3ZlcmFnZS5maWx0ZXJUcmVlRm9yVGVzdChzaG93T25seVRlc3QpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVzOiBUZXN0Q292ZXJhZ2VGaWxlTm9kZVtdID0gW107XG5cdFx0Zm9yIChsZXQgbm9kZSBvZiB0cmVlLm5vZGVzKSB7XG5cdFx0XHQvLyB3aGVuIHNob3dpbmcgaW5pdGlhbCBjaGlsZHJlbiwgb25seSBzaG93IGZyb20gdGhlIGZpcnN0IGZpbGUgb3IgdGVlXG5cdFx0XHR3aGlsZSAoIShub2RlLnZhbHVlIGluc3RhbmNlb2YgRmlsZUNvdmVyYWdlKSAmJiBub2RlLmNoaWxkcmVuPy5zaXplID09PSAxKSB7XG5cdFx0XHRcdG5vZGUgPSBJdGVyYWJsZS5maXJzdChub2RlLmNoaWxkcmVuLnZhbHVlcygpKSE7XG5cdFx0XHR9XG5cdFx0XHRmaWxlcy5wdXNoKG5vZGUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvQ2hpbGQgPSAodmFsdWU6IFRlc3RDb3ZlcmFnZUZpbGVOb2RlKTogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxDb3ZlcmFnZVRyZWVFbGVtZW50PiA9PiB7XG5cdFx0XHRjb25zdCBpc0ZpbGUgPSAhdmFsdWUuY2hpbGRyZW4/LnNpemU7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlbGVtZW50OiB2YWx1ZSxcblx0XHRcdFx0aW5jb21wcmVzc2libGU6IGlzRmlsZSxcblx0XHRcdFx0Y29sbGFwc2VkOiBpc0ZpbGUsXG5cdFx0XHRcdC8vIGRpcmVjdG9yaWVzIGNhbiBiZSBleHBhbmRlZCwgYW5kIGl0ZW1zIHdpdGggZnVuY3Rpb24gaW5mbyBjYW4gYmUgZXhwYW5kZWRcblx0XHRcdFx0Y29sbGFwc2libGU6ICFpc0ZpbGUgfHwgISF2YWx1ZS52YWx1ZT8uZGVjbGFyYXRpb24/LnRvdGFsLFxuXHRcdFx0XHRjaGlsZHJlbjogdmFsdWUuY2hpbGRyZW4gJiYgSXRlcmFibGUubWFwKHZhbHVlLmNoaWxkcmVuPy52YWx1ZXMoKSwgdG9DaGlsZClcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdHRoaXMuaW5wdXREaXNwb3NhYmxlcy5hZGQob25PYnNlcnZhYmxlQ2hhbmdlKGNvdmVyYWdlLmRpZEFkZENvdmVyYWdlLCBub2RlcyA9PiB7XG5cdFx0XHRjb25zdCB0b1JlbmRlciA9IGZpbmRMYXN0KG5vZGVzLCBuID0+IHRoaXMudHJlZS5oYXNFbGVtZW50KG4pKTtcblx0XHRcdGlmICh0b1JlbmRlcikge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Q2hpbGRyZW4oXG5cdFx0XHRcdFx0dG9SZW5kZXIsXG5cdFx0XHRcdFx0SXRlcmFibGUubWFwKHRvUmVuZGVyLmNoaWxkcmVuPy52YWx1ZXMoKSB8fCBbXSwgdG9DaGlsZCksXG5cdFx0XHRcdFx0eyBkaWZmSWRlbnRpdHlQcm92aWRlcjogeyBnZXRJZDogZWwgPT4gKGVsIGFzIFRlc3RDb3ZlcmFnZUZpbGVOb2RlKS52YWx1ZSEuaWQgfSB9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGNoaWxkcmVuID0gSXRlcmFibGUubWFwKGZpbGVzLCB0b0NoaWxkKTtcblx0XHRjb25zdCBmaWx0ZXJlZFRvID0gc2hvd09ubHlUZXN0ICYmIGNvdmVyYWdlLnJlc3VsdC5nZXRUZXN0QnlJZChzaG93T25seVRlc3QudG9TdHJpbmcoKSk7XG5cdFx0aWYgKGZpbHRlcmVkVG8pIHtcblx0XHRcdGNoaWxkcmVuID0gSXRlcmFibGUuY29uY2F0KFxuXHRcdFx0XHRJdGVyYWJsZS5zaW5nbGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxDb3ZlcmFnZVRyZWVFbGVtZW50Pj4oe1xuXHRcdFx0XHRcdGVsZW1lbnQ6IG5ldyBDdXJyZW50bHlGaWx0ZXJlZFRvKGZpbHRlcmVkVG8pLFxuXHRcdFx0XHRcdGluY29tcHJlc3NpYmxlOiB0cnVlLFxuXHRcdFx0XHR9KSxcblx0XHRcdFx0Y2hpbGRyZW4sXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHRoaXMudHJlZS5zZXRDaGlsZHJlbihudWxsLCBjaGlsZHJlbik7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKSB7XG5cdFx0dGhpcy50cmVlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlV2l0aERldGFpbHMoZWw6IElQcmVmaXhUcmVlTm9kZTxGaWxlQ292ZXJhZ2U+LCBkZXRhaWxzOiByZWFkb25seSBDb3ZlcmFnZURldGFpbHNbXSkge1xuXHRcdGlmICghdGhpcy50cmVlLmhhc0VsZW1lbnQoZWwpKSB7XG5cdFx0XHRyZXR1cm47IC8vIGF2b2lkIGFueSBpc3N1ZXMgaWYgdGhlIHRyZWUgY2hhbmdlcyBpbiB0aGUgbWVhbndoaWxlXG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVjbDogRGVjbGFyYXRpb25Db3ZlcmFnZU5vZGVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZm4gb2YgZGV0YWlscykge1xuXHRcdFx0aWYgKGZuLnR5cGUgIT09IERldGFpbFR5cGUuRGVjbGFyYXRpb24pIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBhcnIgPSBkZWNsO1xuXHRcdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gYXJyLmZpbmQocCA9PiBwLmNvbnRhaW5lZERldGFpbHMuaGFzKGZuKSk7XG5cdFx0XHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdFx0XHRhcnIgPSBwYXJlbnQuY2hpbGRyZW47XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXJyLnB1c2gobmV3IERlY2xhcmF0aW9uQ292ZXJhZ2VOb2RlKGVsLnZhbHVlIS51cmksIGZuLCBkZXRhaWxzKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWFrZUNoaWxkID0gKGZuOiBEZWNsYXJhdGlvbkNvdmVyYWdlTm9kZSk6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8Q292ZXJhZ2VUcmVlRWxlbWVudD4gPT4gKHtcblx0XHRcdGVsZW1lbnQ6IGZuLFxuXHRcdFx0aW5jb21wcmVzc2libGU6IHRydWUsXG5cdFx0XHRjb2xsYXBzZWQ6IHRydWUsXG5cdFx0XHRjb2xsYXBzaWJsZTogZm4uY2hpbGRyZW4ubGVuZ3RoID4gMCxcblx0XHRcdGNoaWxkcmVuOiBmbi5jaGlsZHJlbi5tYXAobWFrZUNoaWxkKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy50cmVlLnNldENoaWxkcmVuKGVsLCBkZWNsLm1hcChtYWtlQ2hpbGQpKTtcblx0fVxufVxuXG5jbGFzcyBUZXN0Q292ZXJhZ2VUcmVlTGlzdERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8Q292ZXJhZ2VUcmVlRWxlbWVudD4ge1xuXHRnZXRIZWlnaHQoZWxlbWVudDogQ292ZXJhZ2VUcmVlRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDIyO1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBDb3ZlcmFnZVRyZWVFbGVtZW50KTogc3RyaW5nIHtcblx0XHRpZiAoaXNGaWxlQ292ZXJhZ2UoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBGaWxlQ292ZXJhZ2VSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGlzRGVjbGFyYXRpb25Db3ZlcmFnZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIERlY2xhcmF0aW9uQ292ZXJhZ2VSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBMb2FkaW5nRGV0YWlscyB8fCBlbGVtZW50IGluc3RhbmNlb2YgUmV2ZWFsVW5jb3ZlcmVkRGVjbGFyYXRpb25zKSB7XG5cdFx0XHRyZXR1cm4gQmFzaWNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBDdXJyZW50bHlGaWx0ZXJlZFRvKSB7XG5cdFx0XHRyZXR1cm4gQ3VycmVudGx5RmlsdGVyZWRUb1JlbmRlcmVyLklEO1xuXHRcdH1cblx0XHRhc3NlcnROZXZlcihlbGVtZW50KTtcblx0fVxufVxuXG5jbGFzcyBTb3J0ZXIgaW1wbGVtZW50cyBJVHJlZVNvcnRlcjxDb3ZlcmFnZVRyZWVFbGVtZW50PiB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3JkZXI6IElPYnNlcnZhYmxlPENvdmVyYWdlU29ydE9yZGVyPikgeyB9XG5cdGNvbXBhcmUoYTogQ292ZXJhZ2VUcmVlRWxlbWVudCwgYjogQ292ZXJhZ2VUcmVlRWxlbWVudCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgb3JkZXIgPSB0aGlzLm9yZGVyLmdldCgpO1xuXHRcdGlmIChpc0ZpbGVDb3ZlcmFnZShhKSAmJiBpc0ZpbGVDb3ZlcmFnZShiKSkge1xuXHRcdFx0c3dpdGNoIChvcmRlcikge1xuXHRcdFx0XHRjYXNlIENvdmVyYWdlU29ydE9yZGVyLkxvY2F0aW9uOlxuXHRcdFx0XHRjYXNlIENvdmVyYWdlU29ydE9yZGVyLk5hbWU6XG5cdFx0XHRcdFx0cmV0dXJuIGEudmFsdWUhLnVyaS50b1N0cmluZygpLmxvY2FsZUNvbXBhcmUoYi52YWx1ZSEudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRjYXNlIENvdmVyYWdlU29ydE9yZGVyLkNvdmVyYWdlOlxuXHRcdFx0XHRcdHJldHVybiBiLnZhbHVlIS50cGMgLSBhLnZhbHVlIS50cGM7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChpc0RlY2xhcmF0aW9uQ292ZXJhZ2UoYSkgJiYgaXNEZWNsYXJhdGlvbkNvdmVyYWdlKGIpKSB7XG5cdFx0XHRzd2l0Y2ggKG9yZGVyKSB7XG5cdFx0XHRcdGNhc2UgQ292ZXJhZ2VTb3J0T3JkZXIuTG9jYXRpb246XG5cdFx0XHRcdFx0cmV0dXJuIFBvc2l0aW9uLmNvbXBhcmUoXG5cdFx0XHRcdFx0XHRhLmxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UgPyBhLmxvY2F0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSA6IGEubG9jYXRpb24sXG5cdFx0XHRcdFx0XHRiLmxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UgPyBiLmxvY2F0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSA6IGIubG9jYXRpb24sXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0Y2FzZSBDb3ZlcmFnZVNvcnRPcmRlci5OYW1lOlxuXHRcdFx0XHRcdHJldHVybiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCk7XG5cdFx0XHRcdGNhc2UgQ292ZXJhZ2VTb3J0T3JkZXIuQ292ZXJhZ2U6IHtcblx0XHRcdFx0XHRjb25zdCBhdHRyQSA9IGEudHBjO1xuXHRcdFx0XHRcdGNvbnN0IGF0dHJCID0gYi50cGM7XG5cdFx0XHRcdFx0cmV0dXJuIChhdHRyQSAhPT0gdW5kZWZpbmVkICYmIGF0dHJCICE9PSB1bmRlZmluZWQgJiYgYXR0ckIgLSBhdHRyQSlcblx0XHRcdFx0XHRcdHx8ICgrYi5oaXRzIC0gK2EuaGl0cylcblx0XHRcdFx0XHRcdHx8IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIElGaWx0ZXJlZFRvVGVtcGxhdGUge1xuXHRsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdGFjdGlvbnM6IEFjdGlvbkJhcjtcbn1cblxuY2xhc3MgQ3VycmVudGx5RmlsdGVyZWRUb1JlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxDb3ZlcmFnZVRyZWVFbGVtZW50LCBGdXp6eVNjb3JlLCBJRmlsdGVyZWRUb1RlbXBsYXRlPiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnQyc7XG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gQ3VycmVudGx5RmlsdGVyZWRUb1JlbmRlcmVyLklEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxDb3ZlcmFnZVRyZWVFbGVtZW50PiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZpbHRlcmVkVG9UZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcklubmVyKG5vZGUuZWxlbWVudC5lbGVtZW50c1tub2RlLmVsZW1lbnQuZWxlbWVudHMubGVuZ3RoIC0gMV0gYXMgQ3VycmVudGx5RmlsdGVyZWRUbywgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRmlsdGVyZWRUb1RlbXBsYXRlIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGVzdGluZy1zdGR0cmVlLWNvbnRhaW5lcicpO1xuXHRcdGNvbnN0IGxhYmVsID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcubGFiZWwnKSk7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLlRlc3RDb3ZlcmFnZUZpbHRlckl0ZW0sIHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHtcblx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IG5ldyBBY3Rpb25CYXIoY29udGFpbmVyKTtcblx0XHRhY3Rpb25zLnB1c2goZ2V0QWN0aW9uQmFyQWN0aW9ucyhtZW51LCAnaW5saW5lJykucHJpbWFyeSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0YWN0aW9ucy5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG5cdFx0cmV0dXJuIHsgbGFiZWwsIGFjdGlvbnMgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPENvdmVyYWdlVHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGaWx0ZXJlZFRvVGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJJbm5lcihlbGVtZW50LmVsZW1lbnQgYXMgQ3VycmVudGx5RmlsdGVyZWRUbywgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElGaWx0ZXJlZFRvVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9ucy5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcklubmVyKGVsZW1lbnQ6IEN1cnJlbnRseUZpbHRlcmVkVG8sIGNvbnRhaW5lcjogSUZpbHRlcmVkVG9UZW1wbGF0ZSkge1xuXHRcdGNvbnRhaW5lci5sYWJlbC5pbm5lclRleHQgPSBlbGVtZW50LmxhYmVsO1xuXHR9XG59XG5cbmludGVyZmFjZSBGaWxlVGVtcGxhdGVEYXRhIHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0YmFyczogTWFuYWdlZFRlc3RDb3ZlcmFnZUJhcnM7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0ZWxlbWVudHNEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRsYWJlbDogSVJlc291cmNlTGFiZWw7XG59XG5cbmNsYXNzIEZpbGVDb3ZlcmFnZVJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxDb3ZlcmFnZVRyZWVFbGVtZW50LCBGdXp6eVNjb3JlLCBGaWxlVGVtcGxhdGVEYXRhPiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnRic7XG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gRmlsZUNvdmVyYWdlUmVuZGVyZXIuSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IEZpbGVUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHRlbXBsYXRlRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Rlc3Rpbmctc3RkdHJlZS1jb250YWluZXInLCAndGVzdC1jb3ZlcmFnZS1saXN0LWl0ZW0nKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRiYXJzOiB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hbmFnZWRUZXN0Q292ZXJhZ2VCYXJzLCB7IGNvbXBhY3Q6IGZhbHNlLCBjb250YWluZXIgfSkpLFxuXHRcdFx0bGFiZWw6IHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHRoaXMubGFiZWxzLmNyZWF0ZShjb250YWluZXIsIHtcblx0XHRcdFx0c3VwcG9ydEhpZ2hsaWdodHM6IHRydWUsXG5cdFx0XHR9KSksXG5cdFx0XHRlbGVtZW50c0Rpc3Bvc2FibGVzOiB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcyxcblx0XHR9O1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyByZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxDb3ZlcmFnZVRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogRmlsZVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuZG9SZW5kZXIobm9kZS5lbGVtZW50IGFzIFRlc3RDb3ZlcmFnZUZpbGVOb2RlLCB0ZW1wbGF0ZURhdGEsIG5vZGUuZmlsdGVyRGF0YSk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxDb3ZlcmFnZVRyZWVFbGVtZW50PiwgRnV6enlTY29yZT4sIF9pbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IEZpbGVUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0aGlzLmRvUmVuZGVyKG5vZGUuZWxlbWVudC5lbGVtZW50cywgdGVtcGxhdGVEYXRhLCBub2RlLmZpbHRlckRhdGEpO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IEZpbGVUZW1wbGF0ZURhdGEpIHtcblx0XHR0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHJpdmF0ZSBkb1JlbmRlcihlbGVtZW50OiBDb3ZlcmFnZVRyZWVFbGVtZW50IHwgQ292ZXJhZ2VUcmVlRWxlbWVudFtdLCB0ZW1wbGF0ZURhdGE6IEZpbGVUZW1wbGF0ZURhdGEsIGZpbHRlckRhdGE6IEZ1enp5U2NvcmUgfCB1bmRlZmluZWQpIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudHNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Y29uc3Qgc3RhdCA9IChlbGVtZW50IGluc3RhbmNlb2YgQXJyYXkgPyBlbGVtZW50W2VsZW1lbnQubGVuZ3RoIC0gMV0gOiBlbGVtZW50KSBhcyBUZXN0Q292ZXJhZ2VGaWxlTm9kZTtcblx0XHRjb25zdCBmaWxlID0gc3RhdC52YWx1ZSE7XG5cdFx0Y29uc3QgbmFtZSA9IGVsZW1lbnQgaW5zdGFuY2VvZiBBcnJheSA/IGVsZW1lbnQubWFwKGUgPT4gYmFzZW5hbWVPckF1dGhvcml0eSgoZSBhcyBUZXN0Q292ZXJhZ2VGaWxlTm9kZSkudmFsdWUhLnVyaSkpIDogYmFzZW5hbWVPckF1dGhvcml0eShmaWxlLnVyaSk7XG5cdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBCeXBhc3NlZEZpbGVDb3ZlcmFnZSkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmJhcnMuc2V0Q292ZXJhZ2VJbmZvKHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50c0Rpc3Bvc2FibGVzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdHN0YXQudmFsdWU/LmRpZENoYW5nZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5iYXJzLnNldENvdmVyYWdlSW5mbyhmaWxlKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGVtcGxhdGVEYXRhLmJhcnMuc2V0Q292ZXJhZ2VJbmZvKGZpbGUpO1xuXHRcdH1cblxuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRSZXNvdXJjZSh7IHJlc291cmNlOiBmaWxlLnVyaSwgbmFtZSB9LCB7XG5cdFx0XHRmaWxlS2luZDogc3RhdC5jaGlsZHJlbj8uc2l6ZSA/IEZpbGVLaW5kLkZPTERFUiA6IEZpbGVLaW5kLkZJTEUsXG5cdFx0XHRtYXRjaGVzOiBjcmVhdGVNYXRjaGVzKGZpbHRlckRhdGEpLFxuXHRcdFx0c2VwYXJhdG9yOiB0aGlzLmxhYmVsU2VydmljZS5nZXRTZXBhcmF0b3IoZmlsZS51cmkuc2NoZW1lLCBmaWxlLnVyaS5hdXRob3JpdHkpLFxuXHRcdFx0ZXh0cmFDbGFzc2VzOiBbJ2xhYmVsJ10sXG5cdFx0fSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIERlY2xhcmF0aW9uVGVtcGxhdGVEYXRhIHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0YmFyczogTWFuYWdlZFRlc3RDb3ZlcmFnZUJhcnM7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0aWNvbjogSFRNTEVsZW1lbnQ7XG5cdGxhYmVsOiBIVE1MRWxlbWVudDtcbn1cblxuY2xhc3MgRGVjbGFyYXRpb25Db3ZlcmFnZVJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxDb3ZlcmFnZVRyZWVFbGVtZW50LCBGdXp6eVNjb3JlLCBEZWNsYXJhdGlvblRlbXBsYXRlRGF0YT4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ04nO1xuXHRwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVJZCA9IERlY2xhcmF0aW9uQ292ZXJhZ2VSZW5kZXJlci5JRDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBEZWNsYXJhdGlvblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgdGVtcGxhdGVEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGVzdC1jb3ZlcmFnZS1saXN0LWl0ZW0nLCAndGVzdGluZy1zdGR0cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0Y29uc3QgaWNvbiA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnN0YXRlJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcubGFiZWwnKSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0YmFyczogdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYW5hZ2VkVGVzdENvdmVyYWdlQmFycywgeyBjb21wYWN0OiBmYWxzZSwgY29udGFpbmVyIH0pKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMsXG5cdFx0XHRpY29uLFxuXHRcdFx0bGFiZWwsXG5cdFx0fTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8Q292ZXJhZ2VUcmVlRWxlbWVudCwgRnV6enlTY29yZT4sIF9pbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IERlY2xhcmF0aW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5kb1JlbmRlcihub2RlLmVsZW1lbnQgYXMgRGVjbGFyYXRpb25Db3ZlcmFnZU5vZGUsIHRlbXBsYXRlRGF0YSwgbm9kZS5maWx0ZXJEYXRhKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPENvdmVyYWdlVHJlZUVsZW1lbnQ+LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogRGVjbGFyYXRpb25UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0aGlzLmRvUmVuZGVyKG5vZGUuZWxlbWVudC5lbGVtZW50c1tub2RlLmVsZW1lbnQuZWxlbWVudHMubGVuZ3RoIC0gMV0gYXMgRGVjbGFyYXRpb25Db3ZlcmFnZU5vZGUsIHRlbXBsYXRlRGF0YSwgbm9kZS5maWx0ZXJEYXRhKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBEZWNsYXJhdGlvblRlbXBsYXRlRGF0YSkge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwcml2YXRlIGRvUmVuZGVyKGVsZW1lbnQ6IERlY2xhcmF0aW9uQ292ZXJhZ2VOb2RlLCB0ZW1wbGF0ZURhdGE6IERlY2xhcmF0aW9uVGVtcGxhdGVEYXRhLCBfZmlsdGVyRGF0YTogRnV6enlTY29yZSB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IGNvdmVyZWQgPSAhIWVsZW1lbnQuaGl0cztcblx0XHRjb25zdCBpY29uID0gY292ZXJlZCA/IHRlc3RpbmdXYXNDb3ZlcmVkIDogdGVzdGluZ1N0YXRlc1RvSWNvbnMuZ2V0KFRlc3RSZXN1bHRTdGF0ZS5VbnNldCk7XG5cdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdub3QtY292ZXJlZCcsICFjb3ZlcmVkKTtcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5jbGFzc05hbWUgPSBgY29tcHV0ZWQtc3RhdGUgJHtUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbiEpfWA7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmlubmVyVGV4dCA9IGVsZW1lbnQubGFiZWw7XG5cdFx0dGVtcGxhdGVEYXRhLmJhcnMuc2V0Q292ZXJhZ2VJbmZvKGVsZW1lbnQuYXR0cmlidXRhYmxlQ292ZXJhZ2UoKSk7XG5cdH1cbn1cblxuY2xhc3MgQmFzaWNSZW5kZXJlciBpbXBsZW1lbnRzIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8Q292ZXJhZ2VUcmVlRWxlbWVudCwgRnV6enlTY29yZSwgSFRNTEVsZW1lbnQ+IHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdCJztcblx0cHVibGljIHJlYWRvbmx5IHRlbXBsYXRlSWQgPSBCYXNpY1JlbmRlcmVyLklEO1xuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxDb3ZlcmFnZVRyZWVFbGVtZW50PiwgRnV6enlTY29yZT4sIF9pbmRleDogbnVtYmVyLCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJJbm5lcihub2RlLmVsZW1lbnQuZWxlbWVudHNbbm9kZS5lbGVtZW50LmVsZW1lbnRzLmxlbmd0aCAtIDFdLCBjb250YWluZXIpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8Q292ZXJhZ2VUcmVlRWxlbWVudCwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcklubmVyKG5vZGUuZWxlbWVudCwgY29udGFpbmVyKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSgpOiB2b2lkIHtcblx0XHQvLyBuby1vcFxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJJbm5lcihlbGVtZW50OiBDb3ZlcmFnZVRyZWVFbGVtZW50LCBjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyLmlubmVyVGV4dCA9IChlbGVtZW50IGFzIFJldmVhbFVuY292ZXJlZERlY2xhcmF0aW9ucyB8IExvYWRpbmdEZXRhaWxzKS5sYWJlbDtcblx0fVxufVxuXG5jbGFzcyBUZXN0Q292ZXJhZ2VJZGVudGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUlkZW50aXR5UHJvdmlkZXI8Q292ZXJhZ2VUcmVlRWxlbWVudD4ge1xuXHRwdWJsaWMgZ2V0SWQoZWxlbWVudDogQ292ZXJhZ2VUcmVlRWxlbWVudCkge1xuXHRcdHJldHVybiBpc0ZpbGVDb3ZlcmFnZShlbGVtZW50KVxuXHRcdFx0PyBlbGVtZW50LnZhbHVlIS51cmkudG9TdHJpbmcoKVxuXHRcdFx0OiBlbGVtZW50LmlkO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUZXN0Q292ZXJhZ2VDaGFuZ2VQZXJUZXN0RmlsdGVyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlRmlsdGVyVG9UZXN0LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVGVzdCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuY2hhbmdlQ292ZXJhZ2VGaWx0ZXInLCAnRmlsdGVyIENvdmVyYWdlIGJ5IFRlc3QnKSxcblx0XHRcdGljb246IENvZGljb24uZmlsdGVyLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRpY29uOiBDb2RpY29uLmZpbHRlckZpbGxlZCxcblx0XHRcdFx0Y29uZGl0aW9uOiBUZXN0aW5nQ29udGV4dEtleXMuaXNDb3ZlcmFnZUZpbHRlcmVkVG9UZXN0LFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLCB3aGVuOiBUZXN0aW5nQ29udGV4dEtleXMuaGFzUGVyVGVzdENvdmVyYWdlIH0sXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5UZXN0Q292ZXJhZ2VGaWx0ZXJJdGVtLCBncm91cDogJ2lubGluZScgfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXN0aW5nQ29udGV4dEtleXMuaGFzUGVyVGVzdENvdmVyYWdlLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkNvdmVyYWdlVmlld0lkKSksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvdmVyYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdENvdmVyYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb3ZlcmFnZSA9IGNvdmVyYWdlU2VydmljZS5zZWxlY3RlZC5nZXQoKTtcblx0XHRpZiAoIWNvdmVyYWdlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVzdHMgPSBbLi4uY292ZXJhZ2UuYWxsUGVyVGVzdElEcygpXS5tYXAoVGVzdElkLmZyb21TdHJpbmcpO1xuXHRcdGNvbnN0IGNvbW1vblByZWZpeCA9IFRlc3RJZC5nZXRMZW5ndGhPZkNvbW1vblByZWZpeCh0ZXN0cy5sZW5ndGgsIGkgPT4gdGVzdHNbaV0pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGNvdmVyYWdlLnJlc3VsdDtcblx0XHRjb25zdCBwcmV2aW91c1NlbGVjdGlvbiA9IGNvdmVyYWdlU2VydmljZS5maWx0ZXJUb1Rlc3QuZ2V0KCk7XG5cdFx0Y29uc3QgcHJldmlvdXNTZWxlY3Rpb25TdHIgPSBwcmV2aW91c1NlbGVjdGlvbj8udG9TdHJpbmcoKTtcblxuXHRcdHR5cGUgVEl0ZW0gPSB7IGxhYmVsOiBzdHJpbmc7IHRlc3RJZD86IFRlc3RJZCB9O1xuXG5cdFx0Y29uc3QgaXRlbXM6IFF1aWNrUGlja0lucHV0PFRJdGVtPltdID0gW1xuXHRcdFx0eyBsYWJlbDogY292ZXJVdGlscy5sYWJlbHMuYWxsVGVzdHMsIGlkOiB1bmRlZmluZWQgfSxcblx0XHRcdHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcblx0XHRcdC4uLnRlc3RzLm1hcCh0ZXN0SWQgPT4gKHsgbGFiZWw6IGNvdmVyVXRpbHMuZ2V0TGFiZWxGb3JJdGVtKHJlc3VsdCwgdGVzdElkLCBjb21tb25QcmVmaXgpLCB0ZXN0SWQgfSkpLFxuXHRcdF07XG5cblx0XHRxdWlja0lucHV0U2VydmljZS5waWNrKGl0ZW1zLCB7XG5cdFx0XHRhY3RpdmVJdGVtOiBpdGVtcy5maW5kKChpdGVtKTogaXRlbSBpcyBUSXRlbSA9PiAndGVzdElkJyBpbiBpdGVtICYmIGl0ZW0udGVzdElkPy50b1N0cmluZygpID09PSBwcmV2aW91c1NlbGVjdGlvblN0ciksXG5cdFx0XHRwbGFjZUhvbGRlcjogY292ZXJVdGlscy5sYWJlbHMucGlja1Nob3dDb3ZlcmFnZSxcblx0XHRcdG9uRGlkRm9jdXM6IChlbnRyeSkgPT4ge1xuXHRcdFx0XHRjb3ZlcmFnZVNlcnZpY2UuZmlsdGVyVG9UZXN0LnNldChlbnRyeS50ZXN0SWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9LFxuXHRcdH0pLnRoZW4oc2VsZWN0ZWQgPT4ge1xuXHRcdFx0Y292ZXJhZ2VTZXJ2aWNlLmZpbHRlclRvVGVzdC5zZXQoc2VsZWN0ZWQgPyBzZWxlY3RlZC50ZXN0SWQgOiBwcmV2aW91c1NlbGVjdGlvbiwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUZXN0Q292ZXJhZ2VDaGFuZ2VTb3J0aW5nQWN0aW9uIGV4dGVuZHMgVmlld0FjdGlvbjxUZXN0Q292ZXJhZ2VWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlVmlld0NoYW5nZVNvcnRpbmcsXG5cdFx0XHR2aWV3SWQ6IFRlc3RpbmcuQ292ZXJhZ2VWaWV3SWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmNoYW5nZUNvdmVyYWdlU29ydCcsICdDaGFuZ2UgU29ydCBPcmRlcicpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5zb3J0UHJlY2VkZW5jZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRlc3RpbmcuQ292ZXJhZ2VWaWV3SWQpLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuSW5WaWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBUZXN0Q292ZXJhZ2VWaWV3KSB7XG5cdFx0dHlwZSBJdGVtID0gSVF1aWNrUGlja0l0ZW0gJiB7IHZhbHVlOiBDb3ZlcmFnZVNvcnRPcmRlciB9O1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dCA9IGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKS5jcmVhdGVRdWlja1BpY2s8SXRlbT4oKSk7XG5cdFx0Y29uc3QgaXRlbXM6IEl0ZW1bXSA9IFtcblx0XHRcdHsgbGFiZWw6IGxvY2FsaXplKCd0ZXN0aW5nLmNvdmVyYWdlU29ydEJ5TG9jYXRpb24nLCAnU29ydCBieSBMb2NhdGlvbicpLCB2YWx1ZTogQ292ZXJhZ2VTb3J0T3JkZXIuTG9jYXRpb24sIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5jb3ZlcmFnZVNvcnRCeUxvY2F0aW9uRGVzY3JpcHRpb24nLCAnRmlsZXMgYXJlIHNvcnRlZCBhbHBoYWJldGljYWxseSwgZGVjbGFyYXRpb25zIGFyZSBzb3J0ZWQgYnkgcG9zaXRpb24nKSB9LFxuXHRcdFx0eyBsYWJlbDogbG9jYWxpemUoJ3Rlc3RpbmcuY292ZXJhZ2VTb3J0QnlDb3ZlcmFnZScsICdTb3J0IGJ5IENvdmVyYWdlJyksIHZhbHVlOiBDb3ZlcmFnZVNvcnRPcmRlci5Db3ZlcmFnZSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLmNvdmVyYWdlU29ydEJ5Q292ZXJhZ2VEZXNjcmlwdGlvbicsICdGaWxlcyBhbmQgZGVjbGFyYXRpb25zIGFyZSBzb3J0ZWQgYnkgdG90YWwgY292ZXJhZ2UnKSB9LFxuXHRcdFx0eyBsYWJlbDogbG9jYWxpemUoJ3Rlc3RpbmcuY292ZXJhZ2VTb3J0QnlOYW1lJywgJ1NvcnQgYnkgTmFtZScpLCB2YWx1ZTogQ292ZXJhZ2VTb3J0T3JkZXIuTmFtZSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLmNvdmVyYWdlU29ydEJ5TmFtZURlc2NyaXB0aW9uJywgJ0ZpbGVzIGFuZCBkZWNsYXJhdGlvbnMgYXJlIHNvcnRlZCBhbHBoYWJldGljYWxseScpIH0sXG5cdFx0XTtcblxuXHRcdHF1aWNrSW5wdXQucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgndGVzdGluZy5jb3ZlcmFnZVNvcnRQbGFjZWhvbGRlcicsICdTb3J0IHRoZSBUZXN0IENvdmVyYWdlIHZpZXcuLi4nKTtcblx0XHRxdWlja0lucHV0Lml0ZW1zID0gaXRlbXM7XG5cdFx0cXVpY2tJbnB1dC5zaG93KCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrSW5wdXQub25EaWRIaWRlKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0Lm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdGNvbnN0IHBpY2tlZCA9IHF1aWNrSW5wdXQuc2VsZWN0ZWRJdGVtc1swXT8udmFsdWU7XG5cdFx0XHRpZiAocGlja2VkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dmlldy5zb3J0T3JkZXIuc2V0KHBpY2tlZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0cXVpY2tJbnB1dC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsaUJBQWlCO0FBSzFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBcUIscUJBQXFCO0FBQzFDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsWUFBWSxpQkFBaUIseUJBQXlCO0FBQy9ELFNBQXNCLFNBQVMsdUJBQXVCO0FBRXRELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsU0FBUyxjQUFjLFFBQVEsdUJBQXVCO0FBQy9ELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCLDBCQUEwQjtBQUNuRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtCQUFrQixxQ0FBcUM7QUFDaEUsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx1Q0FBdUM7QUFD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QUFBLElBQ0QsQ0FBQyxFQUFFLEtBQUssY0FBWTtBQUNuQixzQkFBZ0IsYUFBYSxJQUFJLFdBQVcsU0FBUyxTQUFTLG1CQUFtQixNQUFTO0FBQUEsSUFDM0YsQ0FBQztBQUFBLEVBQ0Y7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLE1BQU0sd0NBQXdDLFdBQTZCO0FBQUEsRUFDMUYsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUksY0FBYztBQUFBLE1BQ2xCLFFBQVEsUUFBUTtBQUFBLE1BQ2hCLE9BQU8sVUFBVSw4QkFBOEIsbUJBQW1CO0FBQUEsTUFDbEUsTUFBTSxRQUFRO0FBQUEsTUFDZCxNQUFNO0FBQUEsUUFDTCxJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU0sZUFBZSxPQUFPLFFBQVEsUUFBUSxjQUFjO0FBQUEsUUFDMUQsT0FBTztBQUFBLE1BQ1I7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUyxVQUFVLFVBQTRCLE1BQXdCO0FBR3RFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLGFBQWEsWUFBWSxJQUFJLFNBQVMsSUFBSSxrQkFBa0IsRUFBRSxnQkFBc0IsQ0FBQztBQUMzRixVQUFNLFFBQWdCO0FBQUEsTUFDckIsRUFBRSxPQUFPLFNBQVMsa0NBQWtDLGtCQUFrQixHQUFHLE9BQU8sa0JBQTRCLGFBQWEsU0FBUyw2Q0FBNkMsc0VBQXNFLEVBQUU7QUFBQSxNQUN2UCxFQUFFLE9BQU8sU0FBUyxrQ0FBa0Msa0JBQWtCLEdBQUcsT0FBTyxrQkFBNEIsYUFBYSxTQUFTLDZDQUE2QyxxREFBcUQsRUFBRTtBQUFBLE1BQ3RPLEVBQUUsT0FBTyxTQUFTLDhCQUE4QixjQUFjLEdBQUcsT0FBTyxjQUF3QixhQUFhLFNBQVMseUNBQXlDLGtEQUFrRCxFQUFFO0FBQUEsSUFDcE47QUFFQSxlQUFXLGNBQWMsU0FBUyxtQ0FBbUMsZ0NBQWdDO0FBQ3JHLGVBQVcsUUFBUTtBQUNuQixlQUFXLEtBQUs7QUFDaEIsZ0JBQVksSUFBSSxXQUFXLFVBQVUsTUFBTSxZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQ2pFLGdCQUFZLElBQUksV0FBVyxZQUFZLE1BQU07QUFDNUMsWUFBTSxTQUFTLFdBQVcsY0FBYyxDQUFDLEdBQUc7QUFDNUMsVUFBSSxXQUFXLFFBQVc7QUFDekIsYUFBSyxVQUFVLElBQUksUUFBUSxNQUFTO0FBQ3BDLG1CQUFXLFFBQVE7QUFBQSxNQUNwQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbIkNvdmVyYWdlU29ydE9yZGVyIiwgImNvdW50Il0KfQo=
