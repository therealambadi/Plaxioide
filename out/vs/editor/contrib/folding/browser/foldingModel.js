import { Emitter } from "../../../../base/common/event.js";
import { FoldingRegions, FoldSource } from "./foldingRanges.js";
import { hash } from "../../../../base/common/hash.js";
class FoldingModel {
  constructor(textModel, decorationProvider) {
    this._updateEventEmitter = new Emitter();
    this.onDidChange = this._updateEventEmitter.event;
    this._textModel = textModel;
    this._decorationProvider = decorationProvider;
    this._regions = new FoldingRegions(new Uint32Array(0), new Uint32Array(0));
    this._editorDecorationIds = [];
  }
  get regions() {
    return this._regions;
  }
  get textModel() {
    return this._textModel;
  }
  get decorationProvider() {
    return this._decorationProvider;
  }
  toggleCollapseState(toggledRegions) {
    if (!toggledRegions.length) {
      return;
    }
    toggledRegions = toggledRegions.sort((r1, r2) => r1.regionIndex - r2.regionIndex);
    const processed = {};
    this._decorationProvider.changeDecorations((accessor) => {
      let k = 0;
      let dirtyRegionEndLine = -1;
      let lastHiddenLine = -1;
      const updateDecorationsUntil = (index) => {
        while (k < index) {
          const endLineNumber = this._regions.getEndLineNumber(k);
          const isCollapsed = this._regions.isCollapsed(k);
          if (endLineNumber <= dirtyRegionEndLine) {
            const isManual = this.regions.getSource(k) !== FoldSource.provider;
            accessor.changeDecorationOptions(this._editorDecorationIds[k], this._decorationProvider.getDecorationOption(isCollapsed, endLineNumber <= lastHiddenLine, isManual));
          }
          if (isCollapsed && endLineNumber > lastHiddenLine) {
            lastHiddenLine = endLineNumber;
          }
          k++;
        }
      };
      for (const region of toggledRegions) {
        const index = region.regionIndex;
        const editorDecorationId = this._editorDecorationIds[index];
        if (editorDecorationId && !processed[editorDecorationId]) {
          processed[editorDecorationId] = true;
          updateDecorationsUntil(index);
          const newCollapseState = !this._regions.isCollapsed(index);
          this._regions.setCollapsed(index, newCollapseState);
          dirtyRegionEndLine = Math.max(dirtyRegionEndLine, this._regions.getEndLineNumber(index));
        }
      }
      updateDecorationsUntil(this._regions.length);
    });
    this._updateEventEmitter.fire({ model: this, collapseStateChanged: toggledRegions });
  }
  removeManualRanges(ranges) {
    const newFoldingRanges = new Array();
    const intersects = (foldRange) => {
      for (const range of ranges) {
        if (!(range.startLineNumber > foldRange.endLineNumber || foldRange.startLineNumber > range.endLineNumber)) {
          return true;
        }
      }
      return false;
    };
    for (let i = 0; i < this._regions.length; i++) {
      const foldRange = this._regions.toFoldRange(i);
      if (foldRange.source === FoldSource.provider || !intersects(foldRange)) {
        newFoldingRanges.push(foldRange);
      }
    }
    this.updatePost(FoldingRegions.fromFoldRanges(newFoldingRanges));
  }
  update(newRegions, selection) {
    const foldedOrManualRanges = this._currentFoldedOrManualRanges(selection);
    const newRanges = FoldingRegions.sanitizeAndMerge(newRegions, foldedOrManualRanges, this._textModel.getLineCount(), selection);
    this.updatePost(FoldingRegions.fromFoldRanges(newRanges));
  }
  updatePost(newRegions) {
    const newEditorDecorations = [];
    let lastHiddenLine = -1;
    for (let index = 0, limit = newRegions.length; index < limit; index++) {
      const startLineNumber = newRegions.getStartLineNumber(index);
      const endLineNumber = newRegions.getEndLineNumber(index);
      const isCollapsed = newRegions.isCollapsed(index);
      const isManual = newRegions.getSource(index) !== FoldSource.provider;
      const decorationRange = {
        startLineNumber,
        startColumn: this._textModel.getLineMaxColumn(startLineNumber),
        endLineNumber,
        endColumn: this._textModel.getLineMaxColumn(endLineNumber) + 1
      };
      newEditorDecorations.push({ range: decorationRange, options: this._decorationProvider.getDecorationOption(isCollapsed, endLineNumber <= lastHiddenLine, isManual) });
      if (isCollapsed && endLineNumber > lastHiddenLine) {
        lastHiddenLine = endLineNumber;
      }
    }
    this._decorationProvider.changeDecorations((accessor) => this._editorDecorationIds = accessor.deltaDecorations(this._editorDecorationIds, newEditorDecorations));
    this._regions = newRegions;
    this._updateEventEmitter.fire({ model: this });
  }
  _currentFoldedOrManualRanges(selection) {
    const foldedRanges = [];
    for (let i = 0, limit = this._regions.length; i < limit; i++) {
      let isCollapsed = this.regions.isCollapsed(i);
      const source = this.regions.getSource(i);
      if (isCollapsed || source !== FoldSource.provider) {
        const foldRange = this._regions.toFoldRange(i);
        const decRange = this._textModel.getDecorationRange(this._editorDecorationIds[i]);
        if (decRange) {
          if (isCollapsed && selection?.startsInside(decRange.startLineNumber + 1, decRange.endLineNumber)) {
            isCollapsed = false;
          }
          foldedRanges.push({
            startLineNumber: decRange.startLineNumber,
            endLineNumber: decRange.endLineNumber,
            type: foldRange.type,
            isCollapsed,
            source
          });
        }
      }
    }
    return foldedRanges;
  }
  /**
   * Collapse state memento, for persistence only
   */
  getMemento() {
    const foldedOrManualRanges = this._currentFoldedOrManualRanges();
    const result = [];
    const maxLineNumber = this._textModel.getLineCount();
    for (let i = 0, limit = foldedOrManualRanges.length; i < limit; i++) {
      const range = foldedOrManualRanges[i];
      if (range.startLineNumber >= range.endLineNumber || range.startLineNumber < 1 || range.endLineNumber > maxLineNumber) {
        continue;
      }
      const checksum = this._getLinesChecksum(range.startLineNumber + 1, range.endLineNumber);
      result.push({
        startLineNumber: range.startLineNumber,
        endLineNumber: range.endLineNumber,
        isCollapsed: range.isCollapsed,
        source: range.source,
        checksum
      });
    }
    return result.length > 0 ? result : void 0;
  }
  /**
   * Apply persisted state, for persistence only
   */
  applyMemento(state) {
    if (!Array.isArray(state)) {
      return;
    }
    const rangesToRestore = [];
    const maxLineNumber = this._textModel.getLineCount();
    for (const range of state) {
      if (range.startLineNumber >= range.endLineNumber || range.startLineNumber < 1 || range.endLineNumber > maxLineNumber) {
        continue;
      }
      const checksum = this._getLinesChecksum(range.startLineNumber + 1, range.endLineNumber);
      if (!range.checksum || checksum === range.checksum) {
        rangesToRestore.push({
          startLineNumber: range.startLineNumber,
          endLineNumber: range.endLineNumber,
          type: void 0,
          isCollapsed: range.isCollapsed ?? true,
          source: range.source ?? FoldSource.provider
        });
      }
    }
    const newRanges = FoldingRegions.sanitizeAndMerge(this._regions, rangesToRestore, maxLineNumber);
    this.updatePost(FoldingRegions.fromFoldRanges(newRanges));
  }
  _getLinesChecksum(lineNumber1, lineNumber2) {
    const h = hash(this._textModel.getLineContent(lineNumber1) + this._textModel.getLineContent(lineNumber2));
    return h % 1e6;
  }
  dispose() {
    this._decorationProvider.removeDecorations(this._editorDecorationIds);
  }
  getAllRegionsAtLine(lineNumber, filter) {
    const result = [];
    if (this._regions) {
      let index = this._regions.findRange(lineNumber);
      let level = 1;
      while (index >= 0) {
        const current = this._regions.toRegion(index);
        if (!filter || filter(current, level)) {
          result.push(current);
        }
        level++;
        index = current.parentIndex;
      }
    }
    return result;
  }
  getRegionAtLine(lineNumber) {
    if (this._regions) {
      const index = this._regions.findRange(lineNumber);
      if (index >= 0) {
        return this._regions.toRegion(index);
      }
    }
    return null;
  }
  getRegionsInside(region, filter) {
    const result = [];
    const index = region ? region.regionIndex + 1 : 0;
    const endLineNumber = region ? region.endLineNumber : Number.MAX_VALUE;
    if (filter && filter.length === 2) {
      const levelStack = [];
      for (let i = index, len = this._regions.length; i < len; i++) {
        const current = this._regions.toRegion(i);
        if (this._regions.getStartLineNumber(i) < endLineNumber) {
          while (levelStack.length > 0 && !current.containedBy(levelStack[levelStack.length - 1])) {
            levelStack.pop();
          }
          levelStack.push(current);
          if (filter(current, levelStack.length)) {
            result.push(current);
          }
        } else {
          break;
        }
      }
    } else {
      for (let i = index, len = this._regions.length; i < len; i++) {
        const current = this._regions.toRegion(i);
        if (this._regions.getStartLineNumber(i) < endLineNumber) {
          if (!filter || filter(current)) {
            result.push(current);
          }
        } else {
          break;
        }
      }
    }
    return result;
  }
}
function toggleCollapseState(foldingModel, levels, lineNumbers) {
  const toToggle = [];
  for (const lineNumber of lineNumbers) {
    const region = foldingModel.getRegionAtLine(lineNumber);
    if (region) {
      const doCollapse = !region.isCollapsed;
      toToggle.push(region);
      if (levels > 1) {
        const regionsInside = foldingModel.getRegionsInside(region, (r, level) => r.isCollapsed !== doCollapse && level < levels);
        toToggle.push(...regionsInside);
      }
    }
  }
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateLevelsDown(foldingModel, doCollapse, levels = Number.MAX_VALUE, lineNumbers) {
  const toToggle = [];
  if (lineNumbers && lineNumbers.length > 0) {
    for (const lineNumber of lineNumbers) {
      const region = foldingModel.getRegionAtLine(lineNumber);
      if (region) {
        if (region.isCollapsed !== doCollapse) {
          toToggle.push(region);
        }
        if (levels > 1) {
          const regionsInside = foldingModel.getRegionsInside(region, (r, level) => r.isCollapsed !== doCollapse && level < levels);
          toToggle.push(...regionsInside);
        }
      }
    }
  } else {
    const regionsInside = foldingModel.getRegionsInside(null, (r, level) => r.isCollapsed !== doCollapse && level < levels);
    toToggle.push(...regionsInside);
  }
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateLevelsUp(foldingModel, doCollapse, levels, lineNumbers) {
  const toToggle = [];
  for (const lineNumber of lineNumbers) {
    const regions = foldingModel.getAllRegionsAtLine(lineNumber, (region, level) => region.isCollapsed !== doCollapse && level <= levels);
    toToggle.push(...regions);
  }
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateUp(foldingModel, doCollapse, lineNumbers) {
  const toToggle = [];
  for (const lineNumber of lineNumbers) {
    const regions = foldingModel.getAllRegionsAtLine(lineNumber, (region) => region.isCollapsed !== doCollapse);
    if (regions.length > 0) {
      toToggle.push(regions[0]);
    }
  }
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateAtLevel(foldingModel, foldLevel, doCollapse, blockedLineNumbers) {
  const filter = (region, level) => level === foldLevel && region.isCollapsed !== doCollapse && !blockedLineNumbers.some((line) => region.containsLine(line));
  const toToggle = foldingModel.getRegionsInside(null, filter);
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateForRest(foldingModel, doCollapse, blockedLineNumbers) {
  const filteredRegions = [];
  for (const lineNumber of blockedLineNumbers) {
    const regions = foldingModel.getAllRegionsAtLine(lineNumber, void 0);
    if (regions.length > 0) {
      filteredRegions.push(regions[0]);
    }
  }
  const filter = (region) => filteredRegions.every((filteredRegion) => !filteredRegion.containedBy(region) && !region.containedBy(filteredRegion)) && region.isCollapsed !== doCollapse;
  const toToggle = foldingModel.getRegionsInside(null, filter);
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateForMatchingLines(foldingModel, regExp, doCollapse) {
  const editorModel = foldingModel.textModel;
  const regions = foldingModel.regions;
  const toToggle = [];
  for (let i = regions.length - 1; i >= 0; i--) {
    if (doCollapse !== regions.isCollapsed(i)) {
      const startLineNumber = regions.getStartLineNumber(i);
      if (regExp.test(editorModel.getLineContent(startLineNumber))) {
        toToggle.push(regions.toRegion(i));
      }
    }
  }
  foldingModel.toggleCollapseState(toToggle);
}
function setCollapseStateForType(foldingModel, type, doCollapse) {
  const regions = foldingModel.regions;
  const toToggle = [];
  for (let i = regions.length - 1; i >= 0; i--) {
    if (doCollapse !== regions.isCollapsed(i) && type === regions.getType(i)) {
      toToggle.push(regions.toRegion(i));
    }
  }
  foldingModel.toggleCollapseState(toToggle);
}
function getParentFoldLine(lineNumber, foldingModel) {
  let startLineNumber = null;
  const foldingRegion = foldingModel.getRegionAtLine(lineNumber);
  if (foldingRegion !== null) {
    startLineNumber = foldingRegion.startLineNumber;
    if (lineNumber === startLineNumber) {
      const parentFoldingIdx = foldingRegion.parentIndex;
      if (parentFoldingIdx !== -1) {
        startLineNumber = foldingModel.regions.getStartLineNumber(parentFoldingIdx);
      } else {
        startLineNumber = null;
      }
    }
  }
  return startLineNumber;
}
function getPreviousFoldLine(lineNumber, foldingModel) {
  let foldingRegion = foldingModel.getRegionAtLine(lineNumber);
  if (foldingRegion !== null && foldingRegion.startLineNumber === lineNumber) {
    if (lineNumber !== foldingRegion.startLineNumber) {
      return foldingRegion.startLineNumber;
    } else {
      const expectedParentIndex = foldingRegion.parentIndex;
      let minLineNumber = 0;
      if (expectedParentIndex !== -1) {
        minLineNumber = foldingModel.regions.getStartLineNumber(foldingRegion.parentIndex);
      }
      while (foldingRegion !== null) {
        if (foldingRegion.regionIndex > 0) {
          foldingRegion = foldingModel.regions.toRegion(foldingRegion.regionIndex - 1);
          if (foldingRegion.startLineNumber <= minLineNumber) {
            return null;
          } else if (foldingRegion.parentIndex === expectedParentIndex) {
            return foldingRegion.startLineNumber;
          }
        } else {
          return null;
        }
      }
    }
  } else {
    if (foldingModel.regions.length > 0) {
      foldingRegion = foldingModel.regions.toRegion(foldingModel.regions.length - 1);
      while (foldingRegion !== null) {
        if (foldingRegion.startLineNumber < lineNumber) {
          return foldingRegion.startLineNumber;
        }
        if (foldingRegion.regionIndex > 0) {
          foldingRegion = foldingModel.regions.toRegion(foldingRegion.regionIndex - 1);
        } else {
          foldingRegion = null;
        }
      }
    }
  }
  return null;
}
function getNextFoldLine(lineNumber, foldingModel) {
  let foldingRegion = foldingModel.getRegionAtLine(lineNumber);
  if (foldingRegion !== null && foldingRegion.startLineNumber === lineNumber) {
    const expectedParentIndex = foldingRegion.parentIndex;
    let maxLineNumber = 0;
    if (expectedParentIndex !== -1) {
      maxLineNumber = foldingModel.regions.getEndLineNumber(foldingRegion.parentIndex);
    } else if (foldingModel.regions.length === 0) {
      return null;
    } else {
      maxLineNumber = foldingModel.regions.getEndLineNumber(foldingModel.regions.length - 1);
    }
    while (foldingRegion !== null) {
      if (foldingRegion.regionIndex < foldingModel.regions.length) {
        foldingRegion = foldingModel.regions.toRegion(foldingRegion.regionIndex + 1);
        if (foldingRegion.startLineNumber >= maxLineNumber) {
          return null;
        } else if (foldingRegion.parentIndex === expectedParentIndex) {
          return foldingRegion.startLineNumber;
        }
      } else {
        return null;
      }
    }
  } else {
    if (foldingModel.regions.length > 0) {
      foldingRegion = foldingModel.regions.toRegion(0);
      while (foldingRegion !== null) {
        if (foldingRegion.startLineNumber > lineNumber) {
          return foldingRegion.startLineNumber;
        }
        if (foldingRegion.regionIndex < foldingModel.regions.length) {
          foldingRegion = foldingModel.regions.toRegion(foldingRegion.regionIndex + 1);
        } else {
          foldingRegion = null;
        }
      }
    }
  }
  return null;
}
export {
  FoldingModel,
  getNextFoldLine,
  getParentFoldLine,
  getPreviousFoldLine,
  setCollapseStateAtLevel,
  setCollapseStateForMatchingLines,
  setCollapseStateForRest,
  setCollapseStateForType,
  setCollapseStateLevelsDown,
  setCollapseStateLevelsUp,
  setCollapseStateUp,
  toggleCollapseState
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL2Jyb3dzZXIvZm9sZGluZ01vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IEZvbGRpbmdSZWdpb24sIEZvbGRpbmdSZWdpb25zLCBJTGluZVJhbmdlLCBGb2xkUmFuZ2UsIEZvbGRTb3VyY2UgfSBmcm9tICcuL2ZvbGRpbmdSYW5nZXMuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgU2VsZWN0ZWRMaW5lcyB9IGZyb20gJy4vZm9sZGluZy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURlY29yYXRpb25Qcm92aWRlciB7XG5cdGdldERlY29yYXRpb25PcHRpb24oaXNDb2xsYXBzZWQ6IGJvb2xlYW4sIGlzSGlkZGVuOiBib29sZWFuLCBpc01hbnVhbDogYm9vbGVhbik6IElNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRjaGFuZ2VEZWNvcmF0aW9uczxUPihjYWxsYmFjazogKGNoYW5nZUFjY2Vzc29yOiBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZUFjY2Vzc29yKSA9PiBUKTogVCB8IG51bGw7XG5cdHJlbW92ZURlY29yYXRpb25zKGRlY29yYXRpb25JZHM6IHN0cmluZ1tdKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGb2xkaW5nTW9kZWxDaGFuZ2VFdmVudCB7XG5cdG1vZGVsOiBGb2xkaW5nTW9kZWw7XG5cdGNvbGxhcHNlU3RhdGVDaGFuZ2VkPzogRm9sZGluZ1JlZ2lvbltdO1xufVxuXG5pbnRlcmZhY2UgSUxpbmVNZW1lbnRvIGV4dGVuZHMgSUxpbmVSYW5nZSB7XG5cdGNoZWNrc3VtPzogbnVtYmVyO1xuXHRpc0NvbGxhcHNlZD86IGJvb2xlYW47XG5cdHNvdXJjZT86IEZvbGRTb3VyY2U7XG59XG5cbmV4cG9ydCB0eXBlIENvbGxhcHNlTWVtZW50byA9IElMaW5lTWVtZW50b1tdO1xuXG5leHBvcnQgY2xhc3MgRm9sZGluZ01vZGVsIHtcblx0cHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsOiBJVGV4dE1vZGVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uUHJvdmlkZXI6IElEZWNvcmF0aW9uUHJvdmlkZXI7XG5cblx0cHJpdmF0ZSBfcmVnaW9uczogRm9sZGluZ1JlZ2lvbnM7XG5cdHByaXZhdGUgX2VkaXRvckRlY29yYXRpb25JZHM6IHN0cmluZ1tdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwZGF0ZUV2ZW50RW1pdHRlciA9IG5ldyBFbWl0dGVyPEZvbGRpbmdNb2RlbENoYW5nZUV2ZW50PigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PEZvbGRpbmdNb2RlbENoYW5nZUV2ZW50PiA9IHRoaXMuX3VwZGF0ZUV2ZW50RW1pdHRlci5ldmVudDtcblxuXHRwdWJsaWMgZ2V0IHJlZ2lvbnMoKTogRm9sZGluZ1JlZ2lvbnMgeyByZXR1cm4gdGhpcy5fcmVnaW9uczsgfVxuXHRwdWJsaWMgZ2V0IHRleHRNb2RlbCgpIHsgcmV0dXJuIHRoaXMuX3RleHRNb2RlbDsgfVxuXHRwdWJsaWMgZ2V0IGRlY29yYXRpb25Qcm92aWRlcigpIHsgcmV0dXJuIHRoaXMuX2RlY29yYXRpb25Qcm92aWRlcjsgfVxuXG5cdGNvbnN0cnVjdG9yKHRleHRNb2RlbDogSVRleHRNb2RlbCwgZGVjb3JhdGlvblByb3ZpZGVyOiBJRGVjb3JhdGlvblByb3ZpZGVyKSB7XG5cdFx0dGhpcy5fdGV4dE1vZGVsID0gdGV4dE1vZGVsO1xuXHRcdHRoaXMuX2RlY29yYXRpb25Qcm92aWRlciA9IGRlY29yYXRpb25Qcm92aWRlcjtcblx0XHR0aGlzLl9yZWdpb25zID0gbmV3IEZvbGRpbmdSZWdpb25zKG5ldyBVaW50MzJBcnJheSgwKSwgbmV3IFVpbnQzMkFycmF5KDApKTtcblx0XHR0aGlzLl9lZGl0b3JEZWNvcmF0aW9uSWRzID0gW107XG5cdH1cblxuXHRwdWJsaWMgdG9nZ2xlQ29sbGFwc2VTdGF0ZSh0b2dnbGVkUmVnaW9uczogRm9sZGluZ1JlZ2lvbltdKSB7XG5cdFx0aWYgKCF0b2dnbGVkUmVnaW9ucy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dG9nZ2xlZFJlZ2lvbnMgPSB0b2dnbGVkUmVnaW9ucy5zb3J0KChyMSwgcjIpID0+IHIxLnJlZ2lvbkluZGV4IC0gcjIucmVnaW9uSW5kZXgpO1xuXG5cdFx0Y29uc3QgcHJvY2Vzc2VkOiB7IFtrZXk6IHN0cmluZ106IGJvb2xlYW4gfCB1bmRlZmluZWQgfSA9IHt9O1xuXHRcdHRoaXMuX2RlY29yYXRpb25Qcm92aWRlci5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRsZXQgayA9IDA7IC8vIGluZGV4IGZyb20gWzAgLi4uIHRoaXMucmVnaW9ucy5sZW5ndGhdXG5cdFx0XHRsZXQgZGlydHlSZWdpb25FbmRMaW5lID0gLTE7IC8vIGVuZCBvZiB0aGUgcmFuZ2Ugd2hlcmUgZGVjb3JhdGlvbnMgbmVlZCB0byBiZSB1cGRhdGVkXG5cdFx0XHRsZXQgbGFzdEhpZGRlbkxpbmUgPSAtMTsgLy8gdGhlIGVuZCBvZiB0aGUgbGFzdCBoaWRkZW4gbGluZXNcblx0XHRcdGNvbnN0IHVwZGF0ZURlY29yYXRpb25zVW50aWwgPSAoaW5kZXg6IG51bWJlcikgPT4ge1xuXHRcdFx0XHR3aGlsZSAoayA8IGluZGV4KSB7XG5cdFx0XHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuX3JlZ2lvbnMuZ2V0RW5kTGluZU51bWJlcihrKTtcblx0XHRcdFx0XHRjb25zdCBpc0NvbGxhcHNlZCA9IHRoaXMuX3JlZ2lvbnMuaXNDb2xsYXBzZWQoayk7XG5cdFx0XHRcdFx0aWYgKGVuZExpbmVOdW1iZXIgPD0gZGlydHlSZWdpb25FbmRMaW5lKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpc01hbnVhbCA9IHRoaXMucmVnaW9ucy5nZXRTb3VyY2UoaykgIT09IEZvbGRTb3VyY2UucHJvdmlkZXI7XG5cdFx0XHRcdFx0XHRhY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyh0aGlzLl9lZGl0b3JEZWNvcmF0aW9uSWRzW2tdLCB0aGlzLl9kZWNvcmF0aW9uUHJvdmlkZXIuZ2V0RGVjb3JhdGlvbk9wdGlvbihpc0NvbGxhcHNlZCwgZW5kTGluZU51bWJlciA8PSBsYXN0SGlkZGVuTGluZSwgaXNNYW51YWwpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGlzQ29sbGFwc2VkICYmIGVuZExpbmVOdW1iZXIgPiBsYXN0SGlkZGVuTGluZSkge1xuXHRcdFx0XHRcdFx0bGFzdEhpZGRlbkxpbmUgPSBlbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRrKys7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRmb3IgKGNvbnN0IHJlZ2lvbiBvZiB0b2dnbGVkUmVnaW9ucykge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IHJlZ2lvbi5yZWdpb25JbmRleDtcblx0XHRcdFx0Y29uc3QgZWRpdG9yRGVjb3JhdGlvbklkID0gdGhpcy5fZWRpdG9yRGVjb3JhdGlvbklkc1tpbmRleF07XG5cdFx0XHRcdGlmIChlZGl0b3JEZWNvcmF0aW9uSWQgJiYgIXByb2Nlc3NlZFtlZGl0b3JEZWNvcmF0aW9uSWRdKSB7XG5cdFx0XHRcdFx0cHJvY2Vzc2VkW2VkaXRvckRlY29yYXRpb25JZF0gPSB0cnVlO1xuXG5cdFx0XHRcdFx0dXBkYXRlRGVjb3JhdGlvbnNVbnRpbChpbmRleCk7IC8vIHVwZGF0ZSBhbGwgZGVjb3JhdGlvbnMgdXAgdG8gY3VycmVudCBpbmRleCB1c2luZyB0aGUgb2xkIGRpcnR5UmVnaW9uRW5kTGluZVxuXG5cdFx0XHRcdFx0Y29uc3QgbmV3Q29sbGFwc2VTdGF0ZSA9ICF0aGlzLl9yZWdpb25zLmlzQ29sbGFwc2VkKGluZGV4KTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpb25zLnNldENvbGxhcHNlZChpbmRleCwgbmV3Q29sbGFwc2VTdGF0ZSk7XG5cblx0XHRcdFx0XHRkaXJ0eVJlZ2lvbkVuZExpbmUgPSBNYXRoLm1heChkaXJ0eVJlZ2lvbkVuZExpbmUsIHRoaXMuX3JlZ2lvbnMuZ2V0RW5kTGluZU51bWJlcihpbmRleCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVEZWNvcmF0aW9uc1VudGlsKHRoaXMuX3JlZ2lvbnMubGVuZ3RoKTtcblx0XHR9KTtcblx0XHR0aGlzLl91cGRhdGVFdmVudEVtaXR0ZXIuZmlyZSh7IG1vZGVsOiB0aGlzLCBjb2xsYXBzZVN0YXRlQ2hhbmdlZDogdG9nZ2xlZFJlZ2lvbnMgfSk7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlTWFudWFsUmFuZ2VzKHJhbmdlczogSUxpbmVSYW5nZVtdKSB7XG5cdFx0Y29uc3QgbmV3Rm9sZGluZ1JhbmdlczogRm9sZFJhbmdlW10gPSBuZXcgQXJyYXkoKTtcblx0XHRjb25zdCBpbnRlcnNlY3RzID0gKGZvbGRSYW5nZTogRm9sZFJhbmdlKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHJhbmdlcykge1xuXHRcdFx0XHRpZiAoIShyYW5nZS5zdGFydExpbmVOdW1iZXIgPiBmb2xkUmFuZ2UuZW5kTGluZU51bWJlciB8fCBmb2xkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID4gcmFuZ2UuZW5kTGluZU51bWJlcikpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH07XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZWdpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBmb2xkUmFuZ2UgPSB0aGlzLl9yZWdpb25zLnRvRm9sZFJhbmdlKGkpO1xuXHRcdFx0aWYgKGZvbGRSYW5nZS5zb3VyY2UgPT09IEZvbGRTb3VyY2UucHJvdmlkZXIgfHwgIWludGVyc2VjdHMoZm9sZFJhbmdlKSkge1xuXHRcdFx0XHRuZXdGb2xkaW5nUmFuZ2VzLnB1c2goZm9sZFJhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy51cGRhdGVQb3N0KEZvbGRpbmdSZWdpb25zLmZyb21Gb2xkUmFuZ2VzKG5ld0ZvbGRpbmdSYW5nZXMpKTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGUobmV3UmVnaW9uczogRm9sZGluZ1JlZ2lvbnMsIHNlbGVjdGlvbj86IFNlbGVjdGVkTGluZXMpOiB2b2lkIHtcblx0XHRjb25zdCBmb2xkZWRPck1hbnVhbFJhbmdlcyA9IHRoaXMuX2N1cnJlbnRGb2xkZWRPck1hbnVhbFJhbmdlcyhzZWxlY3Rpb24pO1xuXHRcdGNvbnN0IG5ld1JhbmdlcyA9IEZvbGRpbmdSZWdpb25zLnNhbml0aXplQW5kTWVyZ2UobmV3UmVnaW9ucywgZm9sZGVkT3JNYW51YWxSYW5nZXMsIHRoaXMuX3RleHRNb2RlbC5nZXRMaW5lQ291bnQoKSwgc2VsZWN0aW9uKTtcblx0XHR0aGlzLnVwZGF0ZVBvc3QoRm9sZGluZ1JlZ2lvbnMuZnJvbUZvbGRSYW5nZXMobmV3UmFuZ2VzKSk7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlUG9zdChuZXdSZWdpb25zOiBGb2xkaW5nUmVnaW9ucykge1xuXHRcdGNvbnN0IG5ld0VkaXRvckRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdGxldCBsYXN0SGlkZGVuTGluZSA9IC0xO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMCwgbGltaXQgPSBuZXdSZWdpb25zLmxlbmd0aDsgaW5kZXggPCBsaW1pdDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gbmV3UmVnaW9ucy5nZXRTdGFydExpbmVOdW1iZXIoaW5kZXgpO1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IG5ld1JlZ2lvbnMuZ2V0RW5kTGluZU51bWJlcihpbmRleCk7XG5cdFx0XHRjb25zdCBpc0NvbGxhcHNlZCA9IG5ld1JlZ2lvbnMuaXNDb2xsYXBzZWQoaW5kZXgpO1xuXHRcdFx0Y29uc3QgaXNNYW51YWwgPSBuZXdSZWdpb25zLmdldFNvdXJjZShpbmRleCkgIT09IEZvbGRTb3VyY2UucHJvdmlkZXI7XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uUmFuZ2UgPSB7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRzdGFydENvbHVtbjogdGhpcy5fdGV4dE1vZGVsLmdldExpbmVNYXhDb2x1bW4oc3RhcnRMaW5lTnVtYmVyKSxcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogZW5kTGluZU51bWJlcixcblx0XHRcdFx0ZW5kQ29sdW1uOiB0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZU1heENvbHVtbihlbmRMaW5lTnVtYmVyKSArIDFcblx0XHRcdH07XG5cdFx0XHRuZXdFZGl0b3JEZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IGRlY29yYXRpb25SYW5nZSwgb3B0aW9uczogdGhpcy5fZGVjb3JhdGlvblByb3ZpZGVyLmdldERlY29yYXRpb25PcHRpb24oaXNDb2xsYXBzZWQsIGVuZExpbmVOdW1iZXIgPD0gbGFzdEhpZGRlbkxpbmUsIGlzTWFudWFsKSB9KTtcblx0XHRcdGlmIChpc0NvbGxhcHNlZCAmJiBlbmRMaW5lTnVtYmVyID4gbGFzdEhpZGRlbkxpbmUpIHtcblx0XHRcdFx0bGFzdEhpZGRlbkxpbmUgPSBlbmRMaW5lTnVtYmVyO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9kZWNvcmF0aW9uUHJvdmlkZXIuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4gdGhpcy5fZWRpdG9yRGVjb3JhdGlvbklkcyA9IGFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnModGhpcy5fZWRpdG9yRGVjb3JhdGlvbklkcywgbmV3RWRpdG9yRGVjb3JhdGlvbnMpKTtcblx0XHR0aGlzLl9yZWdpb25zID0gbmV3UmVnaW9ucztcblx0XHR0aGlzLl91cGRhdGVFdmVudEVtaXR0ZXIuZmlyZSh7IG1vZGVsOiB0aGlzIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3VycmVudEZvbGRlZE9yTWFudWFsUmFuZ2VzKHNlbGVjdGlvbj86IFNlbGVjdGVkTGluZXMpOiBGb2xkUmFuZ2VbXSB7XG5cdFx0Y29uc3QgZm9sZGVkUmFuZ2VzOiBGb2xkUmFuZ2VbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsaW1pdCA9IHRoaXMuX3JlZ2lvbnMubGVuZ3RoOyBpIDwgbGltaXQ7IGkrKykge1xuXHRcdFx0bGV0IGlzQ29sbGFwc2VkID0gdGhpcy5yZWdpb25zLmlzQ29sbGFwc2VkKGkpO1xuXHRcdFx0Y29uc3Qgc291cmNlID0gdGhpcy5yZWdpb25zLmdldFNvdXJjZShpKTtcblx0XHRcdGlmIChpc0NvbGxhcHNlZCB8fCBzb3VyY2UgIT09IEZvbGRTb3VyY2UucHJvdmlkZXIpIHtcblx0XHRcdFx0Y29uc3QgZm9sZFJhbmdlID0gdGhpcy5fcmVnaW9ucy50b0ZvbGRSYW5nZShpKTtcblx0XHRcdFx0Y29uc3QgZGVjUmFuZ2UgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKHRoaXMuX2VkaXRvckRlY29yYXRpb25JZHNbaV0pO1xuXHRcdFx0XHRpZiAoZGVjUmFuZ2UpIHtcblx0XHRcdFx0XHRpZiAoaXNDb2xsYXBzZWQgJiYgc2VsZWN0aW9uPy5zdGFydHNJbnNpZGUoZGVjUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgMSwgZGVjUmFuZ2UuZW5kTGluZU51bWJlcikpIHtcblx0XHRcdFx0XHRcdGlzQ29sbGFwc2VkID0gZmFsc2U7IC8vIHVuY29sbGFwc2UgaXMgdGhlIHJhbmdlIGlzIGJsb2NrZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Zm9sZGVkUmFuZ2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBkZWNSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBkZWNSYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0dHlwZTogZm9sZFJhbmdlLnR5cGUsXG5cdFx0XHRcdFx0XHRpc0NvbGxhcHNlZCxcblx0XHRcdFx0XHRcdHNvdXJjZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZvbGRlZFJhbmdlcztcblx0fVxuXG5cdC8qKlxuXHQgKiBDb2xsYXBzZSBzdGF0ZSBtZW1lbnRvLCBmb3IgcGVyc2lzdGVuY2Ugb25seVxuXHQgKi9cblx0cHVibGljIGdldE1lbWVudG8oKTogQ29sbGFwc2VNZW1lbnRvIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBmb2xkZWRPck1hbnVhbFJhbmdlcyA9IHRoaXMuX2N1cnJlbnRGb2xkZWRPck1hbnVhbFJhbmdlcygpO1xuXHRcdGNvbnN0IHJlc3VsdDogSUxpbmVNZW1lbnRvW10gPSBbXTtcblx0XHRjb25zdCBtYXhMaW5lTnVtYmVyID0gdGhpcy5fdGV4dE1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsaW1pdCA9IGZvbGRlZE9yTWFudWFsUmFuZ2VzLmxlbmd0aDsgaSA8IGxpbWl0OyBpKyspIHtcblx0XHRcdGNvbnN0IHJhbmdlID0gZm9sZGVkT3JNYW51YWxSYW5nZXNbaV07XG5cdFx0XHRpZiAocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID49IHJhbmdlLmVuZExpbmVOdW1iZXIgfHwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIDwgMSB8fCByYW5nZS5lbmRMaW5lTnVtYmVyID4gbWF4TGluZU51bWJlcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNoZWNrc3VtID0gdGhpcy5fZ2V0TGluZXNDaGVja3N1bShyYW5nZS5zdGFydExpbmVOdW1iZXIgKyAxLCByYW5nZS5lbmRMaW5lTnVtYmVyKTtcblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IHJhbmdlLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdGlzQ29sbGFwc2VkOiByYW5nZS5pc0NvbGxhcHNlZCxcblx0XHRcdFx0c291cmNlOiByYW5nZS5zb3VyY2UsXG5cdFx0XHRcdGNoZWNrc3VtOiBjaGVja3N1bVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiAocmVzdWx0Lmxlbmd0aCA+IDApID8gcmVzdWx0IDogdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IHBlcnNpc3RlZCBzdGF0ZSwgZm9yIHBlcnNpc3RlbmNlIG9ubHlcblx0ICovXG5cdHB1YmxpYyBhcHBseU1lbWVudG8oc3RhdGU6IENvbGxhcHNlTWVtZW50bykge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShzdGF0ZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmFuZ2VzVG9SZXN0b3JlOiBGb2xkUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IG1heExpbmVOdW1iZXIgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0Zm9yIChjb25zdCByYW5nZSBvZiBzdGF0ZSkge1xuXHRcdFx0aWYgKHJhbmdlLnN0YXJ0TGluZU51bWJlciA+PSByYW5nZS5lbmRMaW5lTnVtYmVyIHx8IHJhbmdlLnN0YXJ0TGluZU51bWJlciA8IDEgfHwgcmFuZ2UuZW5kTGluZU51bWJlciA+IG1heExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjaGVja3N1bSA9IHRoaXMuX2dldExpbmVzQ2hlY2tzdW0ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgMSwgcmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRpZiAoIXJhbmdlLmNoZWNrc3VtIHx8IGNoZWNrc3VtID09PSByYW5nZS5jaGVja3N1bSkge1xuXHRcdFx0XHRyYW5nZXNUb1Jlc3RvcmUucHVzaCh7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogcmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHR0eXBlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0aXNDb2xsYXBzZWQ6IHJhbmdlLmlzQ29sbGFwc2VkID8/IHRydWUsXG5cdFx0XHRcdFx0c291cmNlOiByYW5nZS5zb3VyY2UgPz8gRm9sZFNvdXJjZS5wcm92aWRlclxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBuZXdSYW5nZXMgPSBGb2xkaW5nUmVnaW9ucy5zYW5pdGl6ZUFuZE1lcmdlKHRoaXMuX3JlZ2lvbnMsIHJhbmdlc1RvUmVzdG9yZSwgbWF4TGluZU51bWJlcik7XG5cdFx0dGhpcy51cGRhdGVQb3N0KEZvbGRpbmdSZWdpb25zLmZyb21Gb2xkUmFuZ2VzKG5ld1JhbmdlcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGluZXNDaGVja3N1bShsaW5lTnVtYmVyMTogbnVtYmVyLCBsaW5lTnVtYmVyMjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCBoID0gaGFzaCh0aGlzLl90ZXh0TW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcjEpXG5cdFx0XHQrIHRoaXMuX3RleHRNb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyMikpO1xuXHRcdHJldHVybiBoICUgMTAwMDAwMDsgLy8gNiBkaWdpdHMgaXMgcGxlbnR5XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9kZWNvcmF0aW9uUHJvdmlkZXIucmVtb3ZlRGVjb3JhdGlvbnModGhpcy5fZWRpdG9yRGVjb3JhdGlvbklkcyk7XG5cdH1cblxuXHRnZXRBbGxSZWdpb25zQXRMaW5lKGxpbmVOdW1iZXI6IG51bWJlciwgZmlsdGVyPzogKHI6IEZvbGRpbmdSZWdpb24sIGxldmVsOiBudW1iZXIpID0+IGJvb2xlYW4pOiBGb2xkaW5nUmVnaW9uW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdFx0aWYgKHRoaXMuX3JlZ2lvbnMpIHtcblx0XHRcdGxldCBpbmRleCA9IHRoaXMuX3JlZ2lvbnMuZmluZFJhbmdlKGxpbmVOdW1iZXIpO1xuXHRcdFx0bGV0IGxldmVsID0gMTtcblx0XHRcdHdoaWxlIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZWdpb25zLnRvUmVnaW9uKGluZGV4KTtcblx0XHRcdFx0aWYgKCFmaWx0ZXIgfHwgZmlsdGVyKGN1cnJlbnQsIGxldmVsKSkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldmVsKys7XG5cdFx0XHRcdGluZGV4ID0gY3VycmVudC5wYXJlbnRJbmRleDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGdldFJlZ2lvbkF0TGluZShsaW5lTnVtYmVyOiBudW1iZXIpOiBGb2xkaW5nUmVnaW9uIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuX3JlZ2lvbnMpIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fcmVnaW9ucy5maW5kUmFuZ2UobGluZU51bWJlcik7XG5cdFx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVnaW9ucy50b1JlZ2lvbihpbmRleCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Z2V0UmVnaW9uc0luc2lkZShyZWdpb246IEZvbGRpbmdSZWdpb24gfCBudWxsLCBmaWx0ZXI/OiBSZWdpb25GaWx0ZXIgfCBSZWdpb25GaWx0ZXJXaXRoTGV2ZWwpOiBGb2xkaW5nUmVnaW9uW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdFx0Y29uc3QgaW5kZXggPSByZWdpb24gPyByZWdpb24ucmVnaW9uSW5kZXggKyAxIDogMDtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gcmVnaW9uID8gcmVnaW9uLmVuZExpbmVOdW1iZXIgOiBOdW1iZXIuTUFYX1ZBTFVFO1xuXG5cdFx0aWYgKGZpbHRlciAmJiBmaWx0ZXIubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRjb25zdCBsZXZlbFN0YWNrOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0XHRcdGZvciAobGV0IGkgPSBpbmRleCwgbGVuID0gdGhpcy5fcmVnaW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBjdXJyZW50ID0gdGhpcy5fcmVnaW9ucy50b1JlZ2lvbihpKTtcblx0XHRcdFx0aWYgKHRoaXMuX3JlZ2lvbnMuZ2V0U3RhcnRMaW5lTnVtYmVyKGkpIDwgZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdHdoaWxlIChsZXZlbFN0YWNrLmxlbmd0aCA+IDAgJiYgIWN1cnJlbnQuY29udGFpbmVkQnkobGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdKSkge1xuXHRcdFx0XHRcdFx0bGV2ZWxTdGFjay5wb3AoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGV2ZWxTdGFjay5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRcdGlmIChmaWx0ZXIoY3VycmVudCwgbGV2ZWxTdGFjay5sZW5ndGgpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChjdXJyZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChsZXQgaSA9IGluZGV4LCBsZW4gPSB0aGlzLl9yZWdpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZWdpb25zLnRvUmVnaW9uKGkpO1xuXHRcdFx0XHRpZiAodGhpcy5fcmVnaW9ucy5nZXRTdGFydExpbmVOdW1iZXIoaSkgPCBlbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0aWYgKCFmaWx0ZXIgfHwgKGZpbHRlciBhcyBSZWdpb25GaWx0ZXIpKGN1cnJlbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChjdXJyZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG59XG5cbnR5cGUgUmVnaW9uRmlsdGVyID0gKHI6IEZvbGRpbmdSZWdpb24pID0+IGJvb2xlYW47XG50eXBlIFJlZ2lvbkZpbHRlcldpdGhMZXZlbCA9IChyOiBGb2xkaW5nUmVnaW9uLCBsZXZlbDogbnVtYmVyKSA9PiBib29sZWFuO1xuXG5cbi8qKlxuICogQ29sbGFwc2Ugb3IgZXhwYW5kIHRoZSByZWdpb25zIGF0IHRoZSBnaXZlbiBsb2NhdGlvbnNcbiAqIEBwYXJhbSBsZXZlbHMgVGhlIG51bWJlciBvZiBsZXZlbHMuIFVzZSAxIHRvIG9ubHkgaW1wYWN0IHRoZSByZWdpb25zIGF0IHRoZSBsb2NhdGlvbiwgdXNlIE51bWJlci5NQVhfVkFMVUUgZm9yIGFsbCBsZXZlbHMuXG4gKiBAcGFyYW0gbGluZU51bWJlcnMgdGhlIGxvY2F0aW9uIG9mIHRoZSByZWdpb25zIHRvIGNvbGxhcHNlIG9yIGV4cGFuZCwgb3IgaWYgbm90IHNldCwgYWxsIHJlZ2lvbnMgaW4gdGhlIG1vZGVsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlQ29sbGFwc2VTdGF0ZShmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgbGV2ZWxzOiBudW1iZXIsIGxpbmVOdW1iZXJzOiBudW1iZXJbXSkge1xuXHRjb25zdCB0b1RvZ2dsZTogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdGZvciAoY29uc3QgbGluZU51bWJlciBvZiBsaW5lTnVtYmVycykge1xuXHRcdGNvbnN0IHJlZ2lvbiA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUobGluZU51bWJlcik7XG5cdFx0aWYgKHJlZ2lvbikge1xuXHRcdFx0Y29uc3QgZG9Db2xsYXBzZSA9ICFyZWdpb24uaXNDb2xsYXBzZWQ7XG5cdFx0XHR0b1RvZ2dsZS5wdXNoKHJlZ2lvbik7XG5cdFx0XHRpZiAobGV2ZWxzID4gMSkge1xuXHRcdFx0XHRjb25zdCByZWdpb25zSW5zaWRlID0gZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uLCAociwgbGV2ZWw6IG51bWJlcikgPT4gci5pc0NvbGxhcHNlZCAhPT0gZG9Db2xsYXBzZSAmJiBsZXZlbCA8IGxldmVscyk7XG5cdFx0XHRcdHRvVG9nZ2xlLnB1c2goLi4ucmVnaW9uc0luc2lkZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuXG4vKipcbiAqIENvbGxhcHNlIG9yIGV4cGFuZCB0aGUgcmVnaW9ucyBhdCB0aGUgZ2l2ZW4gbG9jYXRpb25zIGluY2x1ZGluZyBhbGwgY2hpbGRyZW4uXG4gKiBAcGFyYW0gZG9Db2xsYXBzZSBXaGV0aGVyIHRvIGNvbGxhcHNlIG9yIGV4cGFuZFxuICogQHBhcmFtIGxldmVscyBUaGUgbnVtYmVyIG9mIGxldmVscy4gVXNlIDEgdG8gb25seSBpbXBhY3QgdGhlIHJlZ2lvbnMgYXQgdGhlIGxvY2F0aW9uLCB1c2UgTnVtYmVyLk1BWF9WQUxVRSBmb3IgYWxsIGxldmVscy5cbiAqIEBwYXJhbSBsaW5lTnVtYmVycyB0aGUgbG9jYXRpb24gb2YgdGhlIHJlZ2lvbnMgdG8gY29sbGFwc2Ugb3IgZXhwYW5kLCBvciBpZiBub3Qgc2V0LCBhbGwgcmVnaW9ucyBpbiB0aGUgbW9kZWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZG9Db2xsYXBzZTogYm9vbGVhbiwgbGV2ZWxzID0gTnVtYmVyLk1BWF9WQUxVRSwgbGluZU51bWJlcnM/OiBudW1iZXJbXSk6IHZvaWQge1xuXHRjb25zdCB0b1RvZ2dsZTogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdGlmIChsaW5lTnVtYmVycyAmJiBsaW5lTnVtYmVycy5sZW5ndGggPiAwKSB7XG5cdFx0Zm9yIChjb25zdCBsaW5lTnVtYmVyIG9mIGxpbmVOdW1iZXJzKSB7XG5cdFx0XHRjb25zdCByZWdpb24gPSBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKGxpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKHJlZ2lvbikge1xuXHRcdFx0XHRpZiAocmVnaW9uLmlzQ29sbGFwc2VkICE9PSBkb0NvbGxhcHNlKSB7XG5cdFx0XHRcdFx0dG9Ub2dnbGUucHVzaChyZWdpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChsZXZlbHMgPiAxKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVnaW9uc0luc2lkZSA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKHJlZ2lvbiwgKHIsIGxldmVsOiBudW1iZXIpID0+IHIuaXNDb2xsYXBzZWQgIT09IGRvQ29sbGFwc2UgJiYgbGV2ZWwgPCBsZXZlbHMpO1xuXHRcdFx0XHRcdHRvVG9nZ2xlLnB1c2goLi4ucmVnaW9uc0luc2lkZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgcmVnaW9uc0luc2lkZSA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKG51bGwsIChyLCBsZXZlbDogbnVtYmVyKSA9PiByLmlzQ29sbGFwc2VkICE9PSBkb0NvbGxhcHNlICYmIGxldmVsIDwgbGV2ZWxzKTtcblx0XHR0b1RvZ2dsZS5wdXNoKC4uLnJlZ2lvbnNJbnNpZGUpO1xuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBDb2xsYXBzZSBvciBleHBhbmQgdGhlIHJlZ2lvbnMgYXQgdGhlIGdpdmVuIGxvY2F0aW9ucyBpbmNsdWRpbmcgYWxsIHBhcmVudHMuXG4gKiBAcGFyYW0gZG9Db2xsYXBzZSBXaGV0aGVyIHRvIGNvbGxhcHNlIG9yIGV4cGFuZFxuICogQHBhcmFtIGxldmVscyBUaGUgbnVtYmVyIG9mIGxldmVscy4gVXNlIDEgdG8gb25seSBpbXBhY3QgdGhlIHJlZ2lvbnMgYXQgdGhlIGxvY2F0aW9uLCB1c2UgTnVtYmVyLk1BWF9WQUxVRSBmb3IgYWxsIGxldmVscy5cbiAqIEBwYXJhbSBsaW5lTnVtYmVycyB0aGUgbG9jYXRpb24gb2YgdGhlIHJlZ2lvbnMgdG8gY29sbGFwc2Ugb3IgZXhwYW5kLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29sbGFwc2VTdGF0ZUxldmVsc1VwKGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBkb0NvbGxhcHNlOiBib29sZWFuLCBsZXZlbHM6IG51bWJlciwgbGluZU51bWJlcnM6IG51bWJlcltdKTogdm9pZCB7XG5cdGNvbnN0IHRvVG9nZ2xlOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0Zm9yIChjb25zdCBsaW5lTnVtYmVyIG9mIGxpbmVOdW1iZXJzKSB7XG5cdFx0Y29uc3QgcmVnaW9ucyA9IGZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKGxpbmVOdW1iZXIsIChyZWdpb24sIGxldmVsKSA9PiByZWdpb24uaXNDb2xsYXBzZWQgIT09IGRvQ29sbGFwc2UgJiYgbGV2ZWwgPD0gbGV2ZWxzKTtcblx0XHR0b1RvZ2dsZS5wdXNoKC4uLnJlZ2lvbnMpO1xuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBDb2xsYXBzZSBvciBleHBhbmQgYSByZWdpb24gYXQgdGhlIGdpdmVuIGxvY2F0aW9ucy4gSWYgdGhlIGlubmVyIG1vc3QgcmVnaW9uIGlzIGFscmVhZHkgY29sbGFwc2VkL2V4cGFuZGVkLCB1c2VzIHRoZSBmaXJzdCBwYXJlbnQgaW5zdGVhZC5cbiAqIEBwYXJhbSBkb0NvbGxhcHNlIFdoZXRoZXIgdG8gY29sbGFwc2Ugb3IgZXhwYW5kXG4gKiBAcGFyYW0gbGluZU51bWJlcnMgdGhlIGxvY2F0aW9uIG9mIHRoZSByZWdpb25zIHRvIGNvbGxhcHNlIG9yIGV4cGFuZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldENvbGxhcHNlU3RhdGVVcChmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZG9Db2xsYXBzZTogYm9vbGVhbiwgbGluZU51bWJlcnM6IG51bWJlcltdKTogdm9pZCB7XG5cdGNvbnN0IHRvVG9nZ2xlOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0Zm9yIChjb25zdCBsaW5lTnVtYmVyIG9mIGxpbmVOdW1iZXJzKSB7XG5cdFx0Y29uc3QgcmVnaW9ucyA9IGZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKGxpbmVOdW1iZXIsIChyZWdpb24sKSA9PiByZWdpb24uaXNDb2xsYXBzZWQgIT09IGRvQ29sbGFwc2UpO1xuXHRcdGlmIChyZWdpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdHRvVG9nZ2xlLnB1c2gocmVnaW9uc1swXSk7XG5cdFx0fVxuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBGb2xkcyBvciB1bmZvbGRzIGFsbCByZWdpb25zIHRoYXQgaGF2ZSBhIGdpdmVuIGxldmVsLCBleGNlcHQgaWYgdGhleSBjb250YWluIG9uZSBvZiB0aGUgYmxvY2tlZCBsaW5lcy5cbiAqIEBwYXJhbSBmb2xkTGV2ZWwgbGV2ZWwuIExldmVsID09IDEgaXMgdGhlIHRvcCBsZXZlbFxuICogQHBhcmFtIGRvQ29sbGFwc2UgV2hldGhlciB0byBjb2xsYXBzZSBvciBleHBhbmRcbiovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGZvbGRMZXZlbDogbnVtYmVyLCBkb0NvbGxhcHNlOiBib29sZWFuLCBibG9ja2VkTGluZU51bWJlcnM6IG51bWJlcltdKTogdm9pZCB7XG5cdGNvbnN0IGZpbHRlciA9IChyZWdpb246IEZvbGRpbmdSZWdpb24sIGxldmVsOiBudW1iZXIpID0+IGxldmVsID09PSBmb2xkTGV2ZWwgJiYgcmVnaW9uLmlzQ29sbGFwc2VkICE9PSBkb0NvbGxhcHNlICYmICFibG9ja2VkTGluZU51bWJlcnMuc29tZShsaW5lID0+IHJlZ2lvbi5jb250YWluc0xpbmUobGluZSkpO1xuXHRjb25zdCB0b1RvZ2dsZSA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKG51bGwsIGZpbHRlcik7XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBGb2xkcyBvciB1bmZvbGRzIGFsbCByZWdpb25zLCBleGNlcHQgaWYgdGhleSBjb250YWluIG9yIGFyZSBjb250YWluZWQgYnkgYSByZWdpb24gb2Ygb25lIG9mIHRoZSBibG9ja2VkIGxpbmVzLlxuICogQHBhcmFtIGRvQ29sbGFwc2UgV2hldGhlciB0byBjb2xsYXBzZSBvciBleHBhbmRcbiAqIEBwYXJhbSBibG9ja2VkTGluZU51bWJlcnMgdGhlIGxvY2F0aW9uIG9mIHJlZ2lvbnMgdG8gbm90IGNvbGxhcHNlIG9yIGV4cGFuZFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29sbGFwc2VTdGF0ZUZvclJlc3QoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGRvQ29sbGFwc2U6IGJvb2xlYW4sIGJsb2NrZWRMaW5lTnVtYmVyczogbnVtYmVyW10pOiB2b2lkIHtcblx0Y29uc3QgZmlsdGVyZWRSZWdpb25zOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0Zm9yIChjb25zdCBsaW5lTnVtYmVyIG9mIGJsb2NrZWRMaW5lTnVtYmVycykge1xuXHRcdGNvbnN0IHJlZ2lvbnMgPSBmb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZShsaW5lTnVtYmVyLCB1bmRlZmluZWQpO1xuXHRcdGlmIChyZWdpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGZpbHRlcmVkUmVnaW9ucy5wdXNoKHJlZ2lvbnNbMF0pO1xuXHRcdH1cblx0fVxuXHRjb25zdCBmaWx0ZXIgPSAocmVnaW9uOiBGb2xkaW5nUmVnaW9uKSA9PiBmaWx0ZXJlZFJlZ2lvbnMuZXZlcnkoKGZpbHRlcmVkUmVnaW9uKSA9PiAhZmlsdGVyZWRSZWdpb24uY29udGFpbmVkQnkocmVnaW9uKSAmJiAhcmVnaW9uLmNvbnRhaW5lZEJ5KGZpbHRlcmVkUmVnaW9uKSkgJiYgcmVnaW9uLmlzQ29sbGFwc2VkICE9PSBkb0NvbGxhcHNlO1xuXHRjb25zdCB0b1RvZ2dsZSA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKG51bGwsIGZpbHRlcik7XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBGb2xkcyBhbGwgcmVnaW9ucyBmb3Igd2hpY2ggdGhlIGxpbmVzIHN0YXJ0IHdpdGggYSBnaXZlbiByZWdleFxuICogQHBhcmFtIGZvbGRpbmdNb2RlbCB0aGUgZm9sZGluZyBtb2RlbFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29sbGFwc2VTdGF0ZUZvck1hdGNoaW5nTGluZXMoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIHJlZ0V4cDogUmVnRXhwLCBkb0NvbGxhcHNlOiBib29sZWFuKTogdm9pZCB7XG5cdGNvbnN0IGVkaXRvck1vZGVsID0gZm9sZGluZ01vZGVsLnRleHRNb2RlbDtcblx0Y29uc3QgcmVnaW9ucyA9IGZvbGRpbmdNb2RlbC5yZWdpb25zO1xuXHRjb25zdCB0b1RvZ2dsZTogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdGZvciAobGV0IGkgPSByZWdpb25zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0aWYgKGRvQ29sbGFwc2UgIT09IHJlZ2lvbnMuaXNDb2xsYXBzZWQoaSkpIHtcblx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHJlZ2lvbnMuZ2V0U3RhcnRMaW5lTnVtYmVyKGkpO1xuXHRcdFx0aWYgKHJlZ0V4cC50ZXN0KGVkaXRvck1vZGVsLmdldExpbmVDb250ZW50KHN0YXJ0TGluZU51bWJlcikpKSB7XG5cdFx0XHRcdHRvVG9nZ2xlLnB1c2gocmVnaW9ucy50b1JlZ2lvbihpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBGb2xkcyBhbGwgcmVnaW9ucyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICogQHBhcmFtIGZvbGRpbmdNb2RlbCB0aGUgZm9sZGluZyBtb2RlbFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29sbGFwc2VTdGF0ZUZvclR5cGUoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIHR5cGU6IHN0cmluZywgZG9Db2xsYXBzZTogYm9vbGVhbik6IHZvaWQge1xuXHRjb25zdCByZWdpb25zID0gZm9sZGluZ01vZGVsLnJlZ2lvbnM7XG5cdGNvbnN0IHRvVG9nZ2xlOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0Zm9yIChsZXQgaSA9IHJlZ2lvbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRpZiAoZG9Db2xsYXBzZSAhPT0gcmVnaW9ucy5pc0NvbGxhcHNlZChpKSAmJiB0eXBlID09PSByZWdpb25zLmdldFR5cGUoaSkpIHtcblx0XHRcdHRvVG9nZ2xlLnB1c2gocmVnaW9ucy50b1JlZ2lvbihpKSk7XG5cdFx0fVxuXHR9XG5cdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKHRvVG9nZ2xlKTtcbn1cblxuLyoqXG4gKiBHZXQgbGluZSB0byBnbyB0byBmb3IgcGFyZW50IGZvbGQgb2YgY3VycmVudCBsaW5lXG4gKiBAcGFyYW0gbGluZU51bWJlciB0aGUgY3VycmVudCBsaW5lIG51bWJlclxuICogQHBhcmFtIGZvbGRpbmdNb2RlbCB0aGUgZm9sZGluZyBtb2RlbFxuICpcbiAqIEByZXR1cm4gUGFyZW50IGZvbGQgc3RhcnQgbGluZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyZW50Rm9sZExpbmUobGluZU51bWJlcjogbnVtYmVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCk6IG51bWJlciB8IG51bGwge1xuXHRsZXQgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0Y29uc3QgZm9sZGluZ1JlZ2lvbiA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUobGluZU51bWJlcik7XG5cdGlmIChmb2xkaW5nUmVnaW9uICE9PSBudWxsKSB7XG5cdFx0c3RhcnRMaW5lTnVtYmVyID0gZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0Ly8gSWYgY3VycmVudCBsaW5lIGlzIG5vdCB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgZm9sZCwgZ28gdG8gdG9wIGxpbmUgb2YgY3VycmVudCBmb2xkLiBJZiBub3QsIGdvIHRvIHBhcmVudCBmb2xkXG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IHN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0Y29uc3QgcGFyZW50Rm9sZGluZ0lkeCA9IGZvbGRpbmdSZWdpb24ucGFyZW50SW5kZXg7XG5cdFx0XHRpZiAocGFyZW50Rm9sZGluZ0lkeCAhPT0gLTEpIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyID0gZm9sZGluZ01vZGVsLnJlZ2lvbnMuZ2V0U3RhcnRMaW5lTnVtYmVyKHBhcmVudEZvbGRpbmdJZHgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIHN0YXJ0TGluZU51bWJlcjtcbn1cblxuLyoqXG4gKiBHZXQgbGluZSB0byBnbyB0byBmb3IgcHJldmlvdXMgZm9sZCBhdCB0aGUgc2FtZSBsZXZlbCBvZiBjdXJyZW50IGxpbmVcbiAqIEBwYXJhbSBsaW5lTnVtYmVyIHRoZSBjdXJyZW50IGxpbmUgbnVtYmVyXG4gKiBAcGFyYW0gZm9sZGluZ01vZGVsIHRoZSBmb2xkaW5nIG1vZGVsXG4gKlxuICogQHJldHVybiBQcmV2aW91cyBmb2xkIHN0YXJ0IGxpbmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByZXZpb3VzRm9sZExpbmUobGluZU51bWJlcjogbnVtYmVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCk6IG51bWJlciB8IG51bGwge1xuXHRsZXQgZm9sZGluZ1JlZ2lvbiA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUobGluZU51bWJlcik7XG5cdC8vIElmIG9uIHRoZSBmb2xkaW5nIHJhbmdlIHN0YXJ0IGxpbmUsIGdvIHRvIHByZXZpb3VzIHNpYmxpbmcuXG5cdGlmIChmb2xkaW5nUmVnaW9uICE9PSBudWxsICYmIGZvbGRpbmdSZWdpb24uc3RhcnRMaW5lTnVtYmVyID09PSBsaW5lTnVtYmVyKSB7XG5cdFx0Ly8gSWYgY3VycmVudCBsaW5lIGlzIG5vdCB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgZm9sZCwgZ28gdG8gdG9wIGxpbmUgb2YgY3VycmVudCBmb2xkLiBJZiBub3QsIGdvIHRvIHByZXZpb3VzIGZvbGQuXG5cdFx0aWYgKGxpbmVOdW1iZXIgIT09IGZvbGRpbmdSZWdpb24uc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4gZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEZpbmQgbWluIGxpbmUgbnVtYmVyIHRvIHN0YXkgd2l0aGluIHBhcmVudC5cblx0XHRcdGNvbnN0IGV4cGVjdGVkUGFyZW50SW5kZXggPSBmb2xkaW5nUmVnaW9uLnBhcmVudEluZGV4O1xuXHRcdFx0bGV0IG1pbkxpbmVOdW1iZXIgPSAwO1xuXHRcdFx0aWYgKGV4cGVjdGVkUGFyZW50SW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdG1pbkxpbmVOdW1iZXIgPSBmb2xkaW5nTW9kZWwucmVnaW9ucy5nZXRTdGFydExpbmVOdW1iZXIoZm9sZGluZ1JlZ2lvbi5wYXJlbnRJbmRleCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbmQgZm9sZCBhdCBzYW1lIGxldmVsLlxuXHRcdFx0d2hpbGUgKGZvbGRpbmdSZWdpb24gIT09IG51bGwpIHtcblx0XHRcdFx0aWYgKGZvbGRpbmdSZWdpb24ucmVnaW9uSW5kZXggPiAwKSB7XG5cdFx0XHRcdFx0Zm9sZGluZ1JlZ2lvbiA9IGZvbGRpbmdNb2RlbC5yZWdpb25zLnRvUmVnaW9uKGZvbGRpbmdSZWdpb24ucmVnaW9uSW5kZXggLSAxKTtcblxuXHRcdFx0XHRcdC8vIEtlZXAgYXQgc2FtZSBsZXZlbC5cblx0XHRcdFx0XHRpZiAoZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXIgPD0gbWluTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChmb2xkaW5nUmVnaW9uLnBhcmVudEluZGV4ID09PSBleHBlY3RlZFBhcmVudEluZGV4KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIEdvIHRvIGxhc3QgZm9sZCB0aGF0J3MgYmVmb3JlIHRoZSBjdXJyZW50IGxpbmUuXG5cdFx0aWYgKGZvbGRpbmdNb2RlbC5yZWdpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvbGRpbmdSZWdpb24gPSBmb2xkaW5nTW9kZWwucmVnaW9ucy50b1JlZ2lvbihmb2xkaW5nTW9kZWwucmVnaW9ucy5sZW5ndGggLSAxKTtcblx0XHRcdHdoaWxlIChmb2xkaW5nUmVnaW9uICE9PSBudWxsKSB7XG5cdFx0XHRcdC8vIEZvdW5kIGZvbGQgYmVmb3JlIGN1cnJlbnQgbGluZS5cblx0XHRcdFx0aWYgKGZvbGRpbmdSZWdpb24uc3RhcnRMaW5lTnVtYmVyIDwgbGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiBmb2xkaW5nUmVnaW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm9sZGluZ1JlZ2lvbi5yZWdpb25JbmRleCA+IDApIHtcblx0XHRcdFx0XHRmb2xkaW5nUmVnaW9uID0gZm9sZGluZ01vZGVsLnJlZ2lvbnMudG9SZWdpb24oZm9sZGluZ1JlZ2lvbi5yZWdpb25JbmRleCAtIDEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvbGRpbmdSZWdpb24gPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEdldCBsaW5lIHRvIGdvIHRvIG5leHQgZm9sZCBhdCB0aGUgc2FtZSBsZXZlbCBvZiBjdXJyZW50IGxpbmVcbiAqIEBwYXJhbSBsaW5lTnVtYmVyIHRoZSBjdXJyZW50IGxpbmUgbnVtYmVyXG4gKiBAcGFyYW0gZm9sZGluZ01vZGVsIHRoZSBmb2xkaW5nIG1vZGVsXG4gKlxuICogQHJldHVybiBOZXh0IGZvbGQgc3RhcnQgbGluZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmV4dEZvbGRMaW5lKGxpbmVOdW1iZXI6IG51bWJlciwgZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwpOiBudW1iZXIgfCBudWxsIHtcblx0bGV0IGZvbGRpbmdSZWdpb24gPSBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKGxpbmVOdW1iZXIpO1xuXHQvLyBJZiBvbiB0aGUgZm9sZGluZyByYW5nZSBzdGFydCBsaW5lLCBnbyB0byBuZXh0IHNpYmxpbmcuXG5cdGlmIChmb2xkaW5nUmVnaW9uICE9PSBudWxsICYmIGZvbGRpbmdSZWdpb24uc3RhcnRMaW5lTnVtYmVyID09PSBsaW5lTnVtYmVyKSB7XG5cdFx0Ly8gRmluZCBtYXggbGluZSBudW1iZXIgdG8gc3RheSB3aXRoaW4gcGFyZW50LlxuXHRcdGNvbnN0IGV4cGVjdGVkUGFyZW50SW5kZXggPSBmb2xkaW5nUmVnaW9uLnBhcmVudEluZGV4O1xuXHRcdGxldCBtYXhMaW5lTnVtYmVyID0gMDtcblx0XHRpZiAoZXhwZWN0ZWRQYXJlbnRJbmRleCAhPT0gLTEpIHtcblx0XHRcdG1heExpbmVOdW1iZXIgPSBmb2xkaW5nTW9kZWwucmVnaW9ucy5nZXRFbmRMaW5lTnVtYmVyKGZvbGRpbmdSZWdpb24ucGFyZW50SW5kZXgpO1xuXHRcdH0gZWxzZSBpZiAoZm9sZGluZ01vZGVsLnJlZ2lvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWF4TGluZU51bWJlciA9IGZvbGRpbmdNb2RlbC5yZWdpb25zLmdldEVuZExpbmVOdW1iZXIoZm9sZGluZ01vZGVsLnJlZ2lvbnMubGVuZ3RoIC0gMSk7XG5cdFx0fVxuXG5cdFx0Ly8gRmluZCBmb2xkIGF0IHNhbWUgbGV2ZWwuXG5cdFx0d2hpbGUgKGZvbGRpbmdSZWdpb24gIT09IG51bGwpIHtcblx0XHRcdGlmIChmb2xkaW5nUmVnaW9uLnJlZ2lvbkluZGV4IDwgZm9sZGluZ01vZGVsLnJlZ2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGZvbGRpbmdSZWdpb24gPSBmb2xkaW5nTW9kZWwucmVnaW9ucy50b1JlZ2lvbihmb2xkaW5nUmVnaW9uLnJlZ2lvbkluZGV4ICsgMSk7XG5cblx0XHRcdFx0Ly8gS2VlcCBhdCBzYW1lIGxldmVsLlxuXHRcdFx0XHRpZiAoZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXIgPj0gbWF4TGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZvbGRpbmdSZWdpb24ucGFyZW50SW5kZXggPT09IGV4cGVjdGVkUGFyZW50SW5kZXgpIHtcblx0XHRcdFx0XHRyZXR1cm4gZm9sZGluZ1JlZ2lvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBHbyB0byBmaXJzdCBmb2xkIHRoYXQncyBhZnRlciB0aGUgY3VycmVudCBsaW5lLlxuXHRcdGlmIChmb2xkaW5nTW9kZWwucmVnaW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb2xkaW5nUmVnaW9uID0gZm9sZGluZ01vZGVsLnJlZ2lvbnMudG9SZWdpb24oMCk7XG5cdFx0XHR3aGlsZSAoZm9sZGluZ1JlZ2lvbiAhPT0gbnVsbCkge1xuXHRcdFx0XHQvLyBGb3VuZCBmb2xkIGFmdGVyIGN1cnJlbnQgbGluZS5cblx0XHRcdFx0aWYgKGZvbGRpbmdSZWdpb24uc3RhcnRMaW5lTnVtYmVyID4gbGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiBmb2xkaW5nUmVnaW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm9sZGluZ1JlZ2lvbi5yZWdpb25JbmRleCA8IGZvbGRpbmdNb2RlbC5yZWdpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRcdGZvbGRpbmdSZWdpb24gPSBmb2xkaW5nTW9kZWwucmVnaW9ucy50b1JlZ2lvbihmb2xkaW5nUmVnaW9uLnJlZ2lvbkluZGV4ICsgMSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9sZGluZ1JlZ2lvbiA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIG51bGw7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQXNCO0FBRS9CLFNBQXdCLGdCQUF1QyxrQkFBa0I7QUFDakYsU0FBUyxZQUFZO0FBc0JkLE1BQU0sYUFBYTtBQUFBLEVBY3pCLFlBQVksV0FBdUIsb0JBQXlDO0FBUDVFLFNBQWlCLHNCQUFzQixJQUFJLFFBQWlDO0FBQzVFLFNBQWdCLGNBQThDLEtBQUssb0JBQW9CO0FBT3RGLFNBQUssYUFBYTtBQUNsQixTQUFLLHNCQUFzQjtBQUMzQixTQUFLLFdBQVcsSUFBSSxlQUFlLElBQUksWUFBWSxDQUFDLEdBQUcsSUFBSSxZQUFZLENBQUMsQ0FBQztBQUN6RSxTQUFLLHVCQUF1QixDQUFDO0FBQUEsRUFDOUI7QUFBQSxFQVRBLElBQVcsVUFBMEI7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFVO0FBQUEsRUFDN0QsSUFBVyxZQUFZO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBWTtBQUFBLEVBQ2pELElBQVcscUJBQXFCO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBcUI7QUFBQSxFQVM1RCxvQkFBb0IsZ0JBQWlDO0FBQzNELFFBQUksQ0FBQyxlQUFlLFFBQVE7QUFDM0I7QUFBQSxJQUNEO0FBQ0EscUJBQWlCLGVBQWUsS0FBSyxDQUFDLElBQUksT0FBTyxHQUFHLGNBQWMsR0FBRyxXQUFXO0FBRWhGLFVBQU0sWUFBb0QsQ0FBQztBQUMzRCxTQUFLLG9CQUFvQixrQkFBa0IsY0FBWTtBQUN0RCxVQUFJLElBQUk7QUFDUixVQUFJ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
