import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { defaultGenerator } from "../../../../base/common/idGenerator.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { basename, extUri } from "../../../../base/common/resources.js";
import * as strings from "../../../../base/common/strings.js";
import { Constants } from "../../../../base/common/uint.js";
import { Range } from "../../../common/core/range.js";
import { localize } from "../../../../nls.js";
class OneReference {
  constructor(isProviderFirst, parent, link, _rangeCallback) {
    this.isProviderFirst = isProviderFirst;
    this.parent = parent;
    this.link = link;
    this._rangeCallback = _rangeCallback;
    this.id = defaultGenerator.nextId();
  }
  get uri() {
    return this.link.uri;
  }
  get range() {
    return this._range ?? this.link.targetSelectionRange ?? this.link.range;
  }
  set range(value) {
    this._range = value;
    this._rangeCallback(this);
  }
  get ariaMessage() {
    const preview = this.parent.getPreview(this)?.preview(this.range);
    if (!preview) {
      return localize(
        "aria.oneReference",
        "in {0} on line {1} at column {2}",
        basename(this.uri),
        this.range.startLineNumber,
        this.range.startColumn
      );
    } else {
      return localize(
        { key: "aria.oneReference.preview", comment: ["Placeholders are: 0: filename, 1:line number, 2: column number, 3: preview snippet of source code"] },
        "{0} in {1} on line {2} at column {3}",
        preview.value,
        basename(this.uri),
        this.range.startLineNumber,
        this.range.startColumn
      );
    }
  }
}
class FilePreview {
  constructor(_modelReference) {
    this._modelReference = _modelReference;
  }
  dispose() {
    this._modelReference.dispose();
  }
  preview(range, n = 8) {
    const model = this._modelReference.object.textEditorModel;
    if (!model) {
      return void 0;
    }
    const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
    const word = model.getWordUntilPosition({ lineNumber: startLineNumber, column: startColumn - n });
    const beforeRange = new Range(startLineNumber, word.startColumn, startLineNumber, startColumn);
    const afterRange = new Range(endLineNumber, endColumn, endLineNumber, Constants.MAX_SAFE_SMALL_INTEGER);
    const before = model.getValueInRange(beforeRange).replace(/^\s+/, "");
    const inside = model.getValueInRange(range);
    const after = model.getValueInRange(afterRange).replace(/\s+$/, "");
    return {
      value: before + inside + after,
      highlight: { start: before.length, end: before.length + inside.length }
    };
  }
}
class FileReferences {
  constructor(parent, uri) {
    this.parent = parent;
    this.uri = uri;
    this.children = [];
    this._previews = new ResourceMap();
  }
  dispose() {
    dispose(this._previews.values());
    this._previews.clear();
  }
  getPreview(child) {
    return this._previews.get(child.uri);
  }
  get ariaMessage() {
    const len = this.children.length;
    if (len === 1) {
      return localize("aria.fileReferences.1", "1 symbol in {0}, full path {1}", basename(this.uri), this.uri.fsPath);
    } else {
      return localize("aria.fileReferences.N", "{0} symbols in {1}, full path {2}", len, basename(this.uri), this.uri.fsPath);
    }
  }
  async resolve(textModelResolverService) {
    if (this._previews.size !== 0) {
      return this;
    }
    for (const child of this.children) {
      if (this._previews.has(child.uri)) {
        continue;
      }
      try {
        const ref = await textModelResolverService.createModelReference(child.uri);
        this._previews.set(child.uri, new FilePreview(ref));
      } catch (err) {
        onUnexpectedError(err);
      }
    }
    return this;
  }
}
class ReferencesModel {
  constructor(links, title) {
    this.groups = [];
    this.references = [];
    this._onDidChangeReferenceRange = new Emitter();
    this.onDidChangeReferenceRange = this._onDidChangeReferenceRange.event;
    this._links = links;
    this._title = title;
    const [providersFirst] = links;
    links.sort(ReferencesModel._compareReferences);
    let current;
    for (const link of links) {
      if (!current || !extUri.isEqual(current.uri, link.uri, true)) {
        current = new FileReferences(this, link.uri);
        this.groups.push(current);
      }
      if (current.children.length === 0 || ReferencesModel._compareReferences(link, current.children[current.children.length - 1]) !== 0) {
        const oneRef = new OneReference(
          providersFirst === link,
          current,
          link,
          (ref) => this._onDidChangeReferenceRange.fire(ref)
        );
        this.references.push(oneRef);
        current.children.push(oneRef);
      }
    }
  }
  dispose() {
    dispose(this.groups);
    this._onDidChangeReferenceRange.dispose();
    this.groups.length = 0;
  }
  clone() {
    return new ReferencesModel(this._links, this._title);
  }
  get title() {
    return this._title;
  }
  get isEmpty() {
    return this.groups.length === 0;
  }
  get ariaMessage() {
    if (this.isEmpty) {
      return localize("aria.result.0", "No results found");
    } else if (this.references.length === 1) {
      return localize("aria.result.1", "Found 1 symbol in {0}", this.references[0].uri.fsPath);
    } else if (this.groups.length === 1) {
      return localize("aria.result.n1", "Found {0} symbols in {1}", this.references.length, this.groups[0].uri.fsPath);
    } else {
      return localize("aria.result.nm", "Found {0} symbols in {1} files", this.references.length, this.groups.length);
    }
  }
  nextOrPreviousReference(reference, next) {
    const { parent } = reference;
    let idx = parent.children.indexOf(reference);
    const childCount = parent.children.length;
    const groupCount = parent.parent.groups.length;
    if (groupCount === 1 || next && idx + 1 < childCount || !next && idx > 0) {
      if (next) {
        idx = (idx + 1) % childCount;
      } else {
        idx = (idx + childCount - 1) % childCount;
      }
      return parent.children[idx];
    }
    idx = parent.parent.groups.indexOf(parent);
    if (next) {
      idx = (idx + 1) % groupCount;
      return parent.parent.groups[idx].children[0];
    } else {
      idx = (idx + groupCount - 1) % groupCount;
      return parent.parent.groups[idx].children[parent.parent.groups[idx].children.length - 1];
    }
  }
  nearestReference(resource, position) {
    const nearest = this.references.map((ref, idx) => {
      return {
        idx,
        prefixLen: strings.commonPrefixLength(ref.uri.toString(), resource.toString()),
        offsetDist: Math.abs(ref.range.startLineNumber - position.lineNumber) * 100 + Math.abs(ref.range.startColumn - position.column)
      };
    }).sort((a, b) => {
      if (a.prefixLen > b.prefixLen) {
        return -1;
      } else if (a.prefixLen < b.prefixLen) {
        return 1;
      } else if (a.offsetDist < b.offsetDist) {
        return -1;
      } else if (a.offsetDist > b.offsetDist) {
        return 1;
      } else {
        return 0;
      }
    })[0];
    if (nearest) {
      return this.references[nearest.idx];
    }
    return void 0;
  }
  referenceAt(resource, position) {
    for (const ref of this.references) {
      if (ref.uri.toString() === resource.toString()) {
        if (Range.containsPosition(ref.range, position)) {
          return ref;
        }
      }
    }
    return void 0;
  }
  firstReference() {
    for (const ref of this.references) {
      if (ref.isProviderFirst) {
        return ref;
      }
    }
    return this.references[0];
  }
  static _compareReferences(a, b) {
    return extUri.compare(a.uri, b.uri) || Range.compareRangesUsingStarts(a.range, b.range);
  }
}
export {
  FilePreview,
  FileReferences,
  OneReference,
  ReferencesModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvcmVmZXJlbmNlc01vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWF0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pZEdlbmVyYXRvci5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBMb2NhdGlvbiwgTG9jYXRpb25MaW5rIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck1vZGVsLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5leHBvcnQgY2xhc3MgT25lUmVmZXJlbmNlIHtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nID0gZGVmYXVsdEdlbmVyYXRvci5uZXh0SWQoKTtcblxuXHRwcml2YXRlIF9yYW5nZT86IElSYW5nZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBpc1Byb3ZpZGVyRmlyc3Q6IGJvb2xlYW4sXG5cdFx0cmVhZG9ubHkgcGFyZW50OiBGaWxlUmVmZXJlbmNlcyxcblx0XHRyZWFkb25seSBsaW5rOiBMb2NhdGlvbkxpbmssXG5cdFx0cHJpdmF0ZSBfcmFuZ2VDYWxsYmFjazogKHJlZjogT25lUmVmZXJlbmNlKSA9PiB2b2lkXG5cdCkgeyB9XG5cblx0Z2V0IHVyaSgpIHtcblx0XHRyZXR1cm4gdGhpcy5saW5rLnVyaTtcblx0fVxuXG5cdGdldCByYW5nZSgpOiBJUmFuZ2Uge1xuXHRcdHJldHVybiB0aGlzLl9yYW5nZSA/PyB0aGlzLmxpbmsudGFyZ2V0U2VsZWN0aW9uUmFuZ2UgPz8gdGhpcy5saW5rLnJhbmdlO1xuXHR9XG5cblx0c2V0IHJhbmdlKHZhbHVlOiBJUmFuZ2UpIHtcblx0XHR0aGlzLl9yYW5nZSA9IHZhbHVlO1xuXHRcdHRoaXMuX3JhbmdlQ2FsbGJhY2sodGhpcyk7XG5cdH1cblxuXHRnZXQgYXJpYU1lc3NhZ2UoKTogc3RyaW5nIHtcblxuXHRcdGNvbnN0IHByZXZpZXcgPSB0aGlzLnBhcmVudC5nZXRQcmV2aWV3KHRoaXMpPy5wcmV2aWV3KHRoaXMucmFuZ2UpO1xuXG5cdFx0aWYgKCFwcmV2aWV3KSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoXG5cdFx0XHRcdCdhcmlhLm9uZVJlZmVyZW5jZScsIFwiaW4gezB9IG9uIGxpbmUgezF9IGF0IGNvbHVtbiB7Mn1cIixcblx0XHRcdFx0YmFzZW5hbWUodGhpcy51cmkpLCB0aGlzLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgdGhpcy5yYW5nZS5zdGFydENvbHVtblxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKFxuXHRcdFx0XHR7IGtleTogJ2FyaWEub25lUmVmZXJlbmNlLnByZXZpZXcnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVycyBhcmU6IDA6IGZpbGVuYW1lLCAxOmxpbmUgbnVtYmVyLCAyOiBjb2x1bW4gbnVtYmVyLCAzOiBwcmV2aWV3IHNuaXBwZXQgb2Ygc291cmNlIGNvZGUnXSB9LCBcInswfSBpbiB7MX0gb24gbGluZSB7Mn0gYXQgY29sdW1uIHszfVwiLFxuXHRcdFx0XHRwcmV2aWV3LnZhbHVlLCBiYXNlbmFtZSh0aGlzLnVyaSksIHRoaXMucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0aGlzLnJhbmdlLnN0YXJ0Q29sdW1uXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVByZXZpZXcgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxSZWZlcmVuY2U6IElSZWZlcmVuY2U8SVRleHRFZGl0b3JNb2RlbD5cblx0KSB7IH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX21vZGVsUmVmZXJlbmNlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByZXZpZXcocmFuZ2U6IElSYW5nZSwgbjogbnVtYmVyID0gOCk6IHsgdmFsdWU6IHN0cmluZzsgaGlnaGxpZ2h0OiBJTWF0Y2ggfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbFJlZmVyZW5jZS5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB7IHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiB9ID0gcmFuZ2U7XG5cdFx0Y29uc3Qgd29yZCA9IG1vZGVsLmdldFdvcmRVbnRpbFBvc2l0aW9uKHsgbGluZU51bWJlcjogc3RhcnRMaW5lTnVtYmVyLCBjb2x1bW46IHN0YXJ0Q29sdW1uIC0gbiB9KTtcblx0XHRjb25zdCBiZWZvcmVSYW5nZSA9IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHdvcmQuc3RhcnRDb2x1bW4sIHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4pO1xuXHRcdGNvbnN0IGFmdGVyUmFuZ2UgPSBuZXcgUmFuZ2UoZW5kTGluZU51bWJlciwgZW5kQ29sdW1uLCBlbmRMaW5lTnVtYmVyLCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUik7XG5cblx0XHRjb25zdCBiZWZvcmUgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoYmVmb3JlUmFuZ2UpLnJlcGxhY2UoL15cXHMrLywgJycpO1xuXHRcdGNvbnN0IGluc2lkZSA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSk7XG5cdFx0Y29uc3QgYWZ0ZXIgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoYWZ0ZXJSYW5nZSkucmVwbGFjZSgvXFxzKyQvLCAnJyk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dmFsdWU6IGJlZm9yZSArIGluc2lkZSArIGFmdGVyLFxuXHRcdFx0aGlnaGxpZ2h0OiB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggKyBpbnNpZGUubGVuZ3RoIH1cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlUmVmZXJlbmNlcyBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRyZWFkb25seSBjaGlsZHJlbjogT25lUmVmZXJlbmNlW10gPSBbXTtcblxuXHRwcml2YXRlIF9wcmV2aWV3cyA9IG5ldyBSZXNvdXJjZU1hcDxGaWxlUHJldmlldz4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBwYXJlbnQ6IFJlZmVyZW5jZXNNb2RlbCxcblx0XHRyZWFkb25seSB1cmk6IFVSSVxuXHQpIHsgfVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLl9wcmV2aWV3cy52YWx1ZXMoKSk7XG5cdFx0dGhpcy5fcHJldmlld3MuY2xlYXIoKTtcblx0fVxuXG5cdGdldFByZXZpZXcoY2hpbGQ6IE9uZVJlZmVyZW5jZSk6IEZpbGVQcmV2aWV3IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJldmlld3MuZ2V0KGNoaWxkLnVyaSk7XG5cdH1cblxuXHRnZXQgYXJpYU1lc3NhZ2UoKTogc3RyaW5nIHtcblx0XHRjb25zdCBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDtcblx0XHRpZiAobGVuID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2FyaWEuZmlsZVJlZmVyZW5jZXMuMScsIFwiMSBzeW1ib2wgaW4gezB9LCBmdWxsIHBhdGggezF9XCIsIGJhc2VuYW1lKHRoaXMudXJpKSwgdGhpcy51cmkuZnNQYXRoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdhcmlhLmZpbGVSZWZlcmVuY2VzLk4nLCBcInswfSBzeW1ib2xzIGluIHsxfSwgZnVsbCBwYXRoIHsyfVwiLCBsZW4sIGJhc2VuYW1lKHRoaXMudXJpKSwgdGhpcy51cmkuZnNQYXRoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXNvbHZlKHRleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UpOiBQcm9taXNlPEZpbGVSZWZlcmVuY2VzPiB7XG5cdFx0aWYgKHRoaXMuX3ByZXZpZXdzLnNpemUgIT09IDApIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcblx0XHRcdGlmICh0aGlzLl9wcmV2aWV3cy5oYXMoY2hpbGQudXJpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShjaGlsZC51cmkpO1xuXHRcdFx0XHR0aGlzLl9wcmV2aWV3cy5zZXQoY2hpbGQudXJpLCBuZXcgRmlsZVByZXZpZXcocmVmKSk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZXNNb2RlbCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5rczogTG9jYXRpb25MaW5rW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RpdGxlOiBzdHJpbmc7XG5cblx0cmVhZG9ubHkgZ3JvdXBzOiBGaWxlUmVmZXJlbmNlc1tdID0gW107XG5cdHJlYWRvbmx5IHJlZmVyZW5jZXM6IE9uZVJlZmVyZW5jZVtdID0gW107XG5cblx0cmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVmZXJlbmNlUmFuZ2UgPSBuZXcgRW1pdHRlcjxPbmVSZWZlcmVuY2U+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVmZXJlbmNlUmFuZ2U6IEV2ZW50PE9uZVJlZmVyZW5jZT4gPSB0aGlzLl9vbkRpZENoYW5nZVJlZmVyZW5jZVJhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKGxpbmtzOiBMb2NhdGlvbkxpbmtbXSwgdGl0bGU6IHN0cmluZykge1xuXHRcdHRoaXMuX2xpbmtzID0gbGlua3M7XG5cdFx0dGhpcy5fdGl0bGUgPSB0aXRsZTtcblxuXHRcdC8vIGdyb3VwaW5nIGFuZCBzb3J0aW5nXG5cdFx0Y29uc3QgW3Byb3ZpZGVyc0ZpcnN0XSA9IGxpbmtzO1xuXHRcdGxpbmtzLnNvcnQoUmVmZXJlbmNlc01vZGVsLl9jb21wYXJlUmVmZXJlbmNlcyk7XG5cblx0XHRsZXQgY3VycmVudDogRmlsZVJlZmVyZW5jZXMgfCB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG5cdFx0XHRpZiAoIWN1cnJlbnQgfHwgIWV4dFVyaS5pc0VxdWFsKGN1cnJlbnQudXJpLCBsaW5rLnVyaSwgdHJ1ZSkpIHtcblx0XHRcdFx0Ly8gbmV3IGdyb3VwXG5cdFx0XHRcdGN1cnJlbnQgPSBuZXcgRmlsZVJlZmVyZW5jZXModGhpcywgbGluay51cmkpO1xuXHRcdFx0XHR0aGlzLmdyb3Vwcy5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBhcHBlbmQsIGNoZWNrIGZvciBlcXVhbGl0eSBmaXJzdCFcblx0XHRcdGlmIChjdXJyZW50LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCB8fCBSZWZlcmVuY2VzTW9kZWwuX2NvbXBhcmVSZWZlcmVuY2VzKGxpbmssIGN1cnJlbnQuY2hpbGRyZW5bY3VycmVudC5jaGlsZHJlbi5sZW5ndGggLSAxXSkgIT09IDApIHtcblxuXHRcdFx0XHRjb25zdCBvbmVSZWYgPSBuZXcgT25lUmVmZXJlbmNlKFxuXHRcdFx0XHRcdHByb3ZpZGVyc0ZpcnN0ID09PSBsaW5rLFxuXHRcdFx0XHRcdGN1cnJlbnQsXG5cdFx0XHRcdFx0bGluayxcblx0XHRcdFx0XHRyZWYgPT4gdGhpcy5fb25EaWRDaGFuZ2VSZWZlcmVuY2VSYW5nZS5maXJlKHJlZilcblx0XHRcdFx0KTtcblx0XHRcdFx0dGhpcy5yZWZlcmVuY2VzLnB1c2gob25lUmVmKTtcblx0XHRcdFx0Y3VycmVudC5jaGlsZHJlbi5wdXNoKG9uZVJlZik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuZ3JvdXBzKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlZmVyZW5jZVJhbmdlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmdyb3Vwcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0Y2xvbmUoKTogUmVmZXJlbmNlc01vZGVsIHtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbCh0aGlzLl9saW5rcywgdGhpcy5fdGl0bGUpO1xuXHR9XG5cblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3RpdGxlO1xuXHR9XG5cblx0Z2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ3JvdXBzLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdGdldCBhcmlhTWVzc2FnZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLmlzRW1wdHkpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnYXJpYS5yZXN1bHQuMCcsIFwiTm8gcmVzdWx0cyBmb3VuZFwiKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMucmVmZXJlbmNlcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnYXJpYS5yZXN1bHQuMScsIFwiRm91bmQgMSBzeW1ib2wgaW4gezB9XCIsIHRoaXMucmVmZXJlbmNlc1swXS51cmkuZnNQYXRoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuZ3JvdXBzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdhcmlhLnJlc3VsdC5uMScsIFwiRm91bmQgezB9IHN5bWJvbHMgaW4gezF9XCIsIHRoaXMucmVmZXJlbmNlcy5sZW5ndGgsIHRoaXMuZ3JvdXBzWzBdLnVyaS5mc1BhdGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2FyaWEucmVzdWx0Lm5tJywgXCJGb3VuZCB7MH0gc3ltYm9scyBpbiB7MX0gZmlsZXNcIiwgdGhpcy5yZWZlcmVuY2VzLmxlbmd0aCwgdGhpcy5ncm91cHMubGVuZ3RoKTtcblx0XHR9XG5cdH1cblxuXHRuZXh0T3JQcmV2aW91c1JlZmVyZW5jZShyZWZlcmVuY2U6IE9uZVJlZmVyZW5jZSwgbmV4dDogYm9vbGVhbik6IE9uZVJlZmVyZW5jZSB7XG5cblx0XHRjb25zdCB7IHBhcmVudCB9ID0gcmVmZXJlbmNlO1xuXG5cdFx0bGV0IGlkeCA9IHBhcmVudC5jaGlsZHJlbi5pbmRleE9mKHJlZmVyZW5jZSk7XG5cdFx0Y29uc3QgY2hpbGRDb3VudCA9IHBhcmVudC5jaGlsZHJlbi5sZW5ndGg7XG5cdFx0Y29uc3QgZ3JvdXBDb3VudCA9IHBhcmVudC5wYXJlbnQuZ3JvdXBzLmxlbmd0aDtcblxuXHRcdGlmIChncm91cENvdW50ID09PSAxIHx8IG5leHQgJiYgaWR4ICsgMSA8IGNoaWxkQ291bnQgfHwgIW5leHQgJiYgaWR4ID4gMCkge1xuXHRcdFx0Ly8gY3ljbGluZyB3aXRoaW4gb25lIGZpbGVcblx0XHRcdGlmIChuZXh0KSB7XG5cdFx0XHRcdGlkeCA9IChpZHggKyAxKSAlIGNoaWxkQ291bnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZHggPSAoaWR4ICsgY2hpbGRDb3VudCAtIDEpICUgY2hpbGRDb3VudDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwYXJlbnQuY2hpbGRyZW5baWR4XTtcblx0XHR9XG5cblx0XHRpZHggPSBwYXJlbnQucGFyZW50Lmdyb3Vwcy5pbmRleE9mKHBhcmVudCk7XG5cdFx0aWYgKG5leHQpIHtcblx0XHRcdGlkeCA9IChpZHggKyAxKSAlIGdyb3VwQ291bnQ7XG5cdFx0XHRyZXR1cm4gcGFyZW50LnBhcmVudC5ncm91cHNbaWR4XS5jaGlsZHJlblswXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWR4ID0gKGlkeCArIGdyb3VwQ291bnQgLSAxKSAlIGdyb3VwQ291bnQ7XG5cdFx0XHRyZXR1cm4gcGFyZW50LnBhcmVudC5ncm91cHNbaWR4XS5jaGlsZHJlbltwYXJlbnQucGFyZW50Lmdyb3Vwc1tpZHhdLmNoaWxkcmVuLmxlbmd0aCAtIDFdO1xuXHRcdH1cblx0fVxuXG5cdG5lYXJlc3RSZWZlcmVuY2UocmVzb3VyY2U6IFVSSSwgcG9zaXRpb246IFBvc2l0aW9uKTogT25lUmVmZXJlbmNlIHwgdW5kZWZpbmVkIHtcblxuXHRcdGNvbnN0IG5lYXJlc3QgPSB0aGlzLnJlZmVyZW5jZXMubWFwKChyZWYsIGlkeCkgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWR4LFxuXHRcdFx0XHRwcmVmaXhMZW46IHN0cmluZ3MuY29tbW9uUHJlZml4TGVuZ3RoKHJlZi51cmkudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSksXG5cdFx0XHRcdG9mZnNldERpc3Q6IE1hdGguYWJzKHJlZi5yYW5nZS5zdGFydExpbmVOdW1iZXIgLSBwb3NpdGlvbi5saW5lTnVtYmVyKSAqIDEwMCArIE1hdGguYWJzKHJlZi5yYW5nZS5zdGFydENvbHVtbiAtIHBvc2l0aW9uLmNvbHVtbilcblx0XHRcdH07XG5cdFx0fSkuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0aWYgKGEucHJlZml4TGVuID4gYi5wcmVmaXhMZW4pIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fSBlbHNlIGlmIChhLnByZWZpeExlbiA8IGIucHJlZml4TGVuKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fSBlbHNlIGlmIChhLm9mZnNldERpc3QgPCBiLm9mZnNldERpc3QpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fSBlbHNlIGlmIChhLm9mZnNldERpc3QgPiBiLm9mZnNldERpc3QpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblx0XHR9KVswXTtcblxuXHRcdGlmIChuZWFyZXN0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2VzW25lYXJlc3QuaWR4XTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHJlZmVyZW5jZUF0KHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBQb3NpdGlvbik6IE9uZVJlZmVyZW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0Zm9yIChjb25zdCByZWYgb2YgdGhpcy5yZWZlcmVuY2VzKSB7XG5cdFx0XHRpZiAocmVmLnVyaS50b1N0cmluZygpID09PSByZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdGlmIChSYW5nZS5jb250YWluc1Bvc2l0aW9uKHJlZi5yYW5nZSwgcG9zaXRpb24pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlZjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Zmlyc3RSZWZlcmVuY2UoKTogT25lUmVmZXJlbmNlIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IHJlZiBvZiB0aGlzLnJlZmVyZW5jZXMpIHtcblx0XHRcdGlmIChyZWYuaXNQcm92aWRlckZpcnN0KSB7XG5cdFx0XHRcdHJldHVybiByZWY7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJlZmVyZW5jZXNbMF07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY29tcGFyZVJlZmVyZW5jZXMoYTogTG9jYXRpb24sIGI6IExvY2F0aW9uKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gZXh0VXJpLmNvbXBhcmUoYS51cmksIGIudXJpKSB8fCBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBc0I7QUFFL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUF3QztBQUNqRCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFVBQVUsY0FBYztBQUNqQyxZQUFZLGFBQWE7QUFDekIsU0FBUyxpQkFBaUI7QUFHMUIsU0FBaUIsYUFBYTtBQUc5QixTQUFTLGdCQUFnQjtBQUVsQixNQUFNLGFBQWE7QUFBQSxFQU16QixZQUNVLGlCQUNBLFFBQ0EsTUFDRCxnQkFDUDtBQUpRO0FBQ0E7QUFDQTtBQUNEO0FBUlQsU0FBUyxLQUFhLGlCQUFpQixPQUFPO0FBQUEsRUFTMUM7QUFBQSxFQUVKLElBQUksTUFBTTtBQUNULFdBQU8sS0FBSyxLQUFLO0FBQUEsRUFDbEI7QUFBQSxFQUVBLElBQUksUUFBZ0I7QUFDbkIsV0FBTyxLQUFLLFVBQVUsS0FBSyxLQUFLLHdCQUF3QixLQUFLLEtBQUs7QUFBQSxFQUNuRTtBQUFBLEVBRUEsSUFBSSxNQUFNLE9BQWU7QUFDeEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyxlQUFlLElBQUk7QUFBQSxFQUN6QjtBQUFBLEVBRUEsSUFBSSxjQUFzQjtBQUV6QixVQUFNLFVBQVUsS0FBSyxPQUFPLFdBQVcsSUFBSSxHQUFHLFFBQVEsS0FBSyxLQUFLO0FBRWhFLFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTztBQUFBLFFBQ047QUFBQSxRQUFxQjtBQUFBLFFBQ3JCLFNBQVMsS0FBSyxHQUFHO0FBQUEsUUFBRyxLQUFLLE1BQU07QUFBQSxRQUFpQixLQUFLLE1BQU07QUFBQSxNQUM1RDtBQUFB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
