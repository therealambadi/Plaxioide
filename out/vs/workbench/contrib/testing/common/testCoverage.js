import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { deepClone } from "../../../../base/common/objects.js";
import { observableSignal } from "../../../../base/common/observable.js";
import { WellDefinedPrefixTree } from "../../../../base/common/prefixTree.js";
import { URI } from "../../../../base/common/uri.js";
import { DetailType, ICoverageCount } from "./testTypes.js";
let incId = 0;
class TestCoverage {
  constructor(result, fromTaskId, uriIdentityService, accessor) {
    this.result = result;
    this.fromTaskId = fromTaskId;
    this.uriIdentityService = uriIdentityService;
    this.accessor = accessor;
    this.fileCoverage = new ResourceMap();
    this.didAddCoverage = observableSignal(this);
    this.tree = new WellDefinedPrefixTree();
    this.associatedData = /* @__PURE__ */ new Map();
  }
  /** Gets all test IDs that were included in this test run. */
  *allPerTestIDs() {
    const seen = /* @__PURE__ */ new Set();
    for (const root of this.tree.nodes) {
      if (root.value && root.value.perTestData) {
        for (const id of root.value.perTestData) {
          if (!seen.has(id)) {
            seen.add(id);
            yield id;
          }
        }
      }
    }
  }
  append(coverage, tx) {
    const previous = this.getComputedForUri(coverage.uri);
    const result = this.result;
    const applyDelta = (kind, node) => {
      if (!node[kind]) {
        if (coverage[kind]) {
          node[kind] = { ...coverage[kind] };
        }
      } else {
        node[kind].covered += (coverage[kind]?.covered || 0) - (previous?.[kind]?.covered || 0);
        node[kind].total += (coverage[kind]?.total || 0) - (previous?.[kind]?.total || 0);
      }
    };
    const canonical = [...this.treePathForUri(
      coverage.uri,
      /* canonical = */
      true
    )];
    const chain = [];
    this.tree.mutatePath(this.treePathForUri(
      coverage.uri,
      /* canonical = */
      false
    ), (node) => {
      chain.push(node);
      if (chain.length === canonical.length) {
        if (node.value) {
          const v = node.value;
          v.id = coverage.id;
          v.statement = coverage.statement;
          v.branch = coverage.branch;
          v.declaration = coverage.declaration;
        } else {
          const v = node.value = new FileCoverage(coverage, result, this.accessor);
          this.fileCoverage.set(coverage.uri, v);
        }
      } else {
        if (!node.value) {
          const intermediate = deepClone(coverage);
          intermediate.id = String(incId++);
          intermediate.uri = this.treePathToUri(canonical.slice(0, chain.length));
          node.value = new ComputedFileCoverage(intermediate, result);
        } else {
          applyDelta("statement", node.value);
          applyDelta("branch", node.value);
          applyDelta("declaration", node.value);
          node.value.didChange.trigger(tx);
        }
      }
      if (coverage.testIds) {
        node.value.perTestData ??= /* @__PURE__ */ new Set();
        for (const id of coverage.testIds) {
          node.value.perTestData.add(id);
        }
      }
    });
    if (chain) {
      this.didAddCoverage.trigger(tx, chain);
    }
  }
  /**
   * Builds a new tree filtered to per-test coverage data for the given ID.
   */
  filterTreeForTest(testId) {
    const tree = new WellDefinedPrefixTree();
    for (const node of this.tree.values()) {
      if (node instanceof FileCoverage) {
        if (!node.perTestData?.has(testId.toString())) {
          continue;
        }
        const canonical = [...this.treePathForUri(
          node.uri,
          /* canonical = */
          true
        )];
        const chain = [];
        tree.mutatePath(this.treePathForUri(
          node.uri,
          /* canonical = */
          false
        ), (n) => {
          chain.push(n);
          n.value ??= new BypassedFileCoverage(this.treePathToUri(canonical.slice(0, chain.length)), node.fromResult);
        });
      }
    }
    return tree;
  }
  /**
   * Gets coverage information for all files.
   */
  getAllFiles() {
    return this.fileCoverage;
  }
  /**
   * Gets coverage information for a specific file.
   */
  getUri(uri) {
    return this.fileCoverage.get(uri);
  }
  /**
   * Gets computed information for a file, including DFS-computed information
   * from child tests.
   */
  getComputedForUri(uri) {
    return this.tree.find(this.treePathForUri(
      uri,
      /* canonical = */
      false
    ));
  }
  *treePathForUri(uri, canconicalPath) {
    yield uri.scheme;
    yield uri.authority;
    const path = !canconicalPath && this.uriIdentityService.extUri.ignorePathCasing(uri) ? uri.path.toLowerCase() : uri.path;
    yield* path.split("/");
  }
  treePathToUri(path) {
    return URI.from({ scheme: path[0], authority: path[1], path: path.slice(2).join("/") });
  }
}
const getTotalCoveragePercent = (statement, branch, function_) => {
  let numerator = statement.covered;
  let denominator = statement.total;
  if (branch) {
    numerator += branch.covered;
    denominator += branch.total;
  }
  if (function_) {
    numerator += function_.covered;
    denominator += function_.total;
  }
  return denominator === 0 ? 1 : numerator / denominator;
};
class AbstractFileCoverage {
  constructor(coverage, fromResult) {
    this.fromResult = fromResult;
    this.didChange = observableSignal(this);
    this.id = coverage.id;
    this.uri = coverage.uri;
    this.statement = coverage.statement;
    this.branch = coverage.branch;
    this.declaration = coverage.declaration;
  }
  /**
   * Gets the total coverage percent based on information provided.
   * This is based on the Clover total coverage formula
   */
  get tpc() {
    return getTotalCoveragePercent(this.statement, this.branch, this.declaration);
  }
}
class ComputedFileCoverage extends AbstractFileCoverage {
}
class BypassedFileCoverage extends ComputedFileCoverage {
  constructor(uri, result) {
    super({ id: String(incId++), uri, statement: { covered: 0, total: 0 } }, result);
  }
}
class FileCoverage extends AbstractFileCoverage {
  constructor(coverage, fromResult, accessor) {
    super(coverage, fromResult);
    this.accessor = accessor;
  }
  /** Gets whether details are synchronously available */
  get hasSynchronousDetails() {
    return this._details instanceof Array || this.resolved;
  }
  /**
   * Gets per-line coverage details.
   */
  async detailsForTest(_testId, token = CancellationToken.None) {
    this._detailsForTest ??= /* @__PURE__ */ new Map();
    const testId = _testId.toString();
    const prev = this._detailsForTest.get(testId);
    if (prev) {
      return prev;
    }
    const promise = (async () => {
      try {
        return await this.accessor.getCoverageDetails(this.id, testId, token);
      } catch (e) {
        this._detailsForTest?.delete(testId);
        throw e;
      }
    })();
    this._detailsForTest.set(testId, promise);
    return promise;
  }
  /**
   * Gets per-line coverage details.
   */
  async details(token = CancellationToken.None) {
    this._details ??= this.accessor.getCoverageDetails(this.id, void 0, token);
    try {
      const d = await this._details;
      this.resolved = true;
      return d;
    } catch (e) {
      this._details = void 0;
      throw e;
    }
  }
}
const totalFromCoverageDetails = (uri, details) => {
  const fc = {
    id: "",
    uri,
    statement: ICoverageCount.empty()
  };
  for (const detail of details) {
    if (detail.type === DetailType.Statement) {
      fc.statement.total++;
      fc.statement.total += detail.count ? 1 : 0;
      for (const branch of detail.branches || []) {
        fc.branch ??= ICoverageCount.empty();
        fc.branch.total++;
        fc.branch.covered += branch.count ? 1 : 0;
      }
    } else {
      fc.declaration ??= ICoverageCount.empty();
      fc.declaration.total++;
      fc.declaration.covered += detail.count ? 1 : 0;
    }
  }
  return fc;
};
export {
  AbstractFileCoverage,
  BypassedFileCoverage,
  ComputedFileCoverage,
  FileCoverage,
  TestCoverage,
  getTotalCoveragePercent,
  totalFromCoverageDetails
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0Q292ZXJhZ2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElUcmFuc2FjdGlvbiwgb2JzZXJ2YWJsZVNpZ25hbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSVByZWZpeFRyZWVOb2RlLCBXZWxsRGVmaW5lZFByZWZpeFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcmVmaXhUcmVlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4vdGVzdElkLmpzJztcbmltcG9ydCB7IExpdmVUZXN0UmVzdWx0IH0gZnJvbSAnLi90ZXN0UmVzdWx0LmpzJztcbmltcG9ydCB7IENvdmVyYWdlRGV0YWlscywgRGV0YWlsVHlwZSwgSUNvdmVyYWdlQ291bnQsIElGaWxlQ292ZXJhZ2UgfSBmcm9tICcuL3Rlc3RUeXBlcy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvdmVyYWdlQWNjZXNzb3Ige1xuXHRnZXRDb3ZlcmFnZURldGFpbHM6IChpZDogc3RyaW5nLCB0ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiBQcm9taXNlPENvdmVyYWdlRGV0YWlsc1tdPjtcbn1cblxubGV0IGluY0lkID0gMDtcblxuLyoqXG4gKiBDbGFzcyB0aGF0IGV4cG9zZXNlIGNvdmVyYWdlIGluZm9ybWF0aW9uIGZvciBhIHJ1bi5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlc3RDb3ZlcmFnZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZUNvdmVyYWdlID0gbmV3IFJlc291cmNlTWFwPEZpbGVDb3ZlcmFnZT4oKTtcblx0cHVibGljIHJlYWRvbmx5IGRpZEFkZENvdmVyYWdlID0gb2JzZXJ2YWJsZVNpZ25hbDxJUHJlZml4VHJlZU5vZGU8QWJzdHJhY3RGaWxlQ292ZXJhZ2U+W10+KHRoaXMpO1xuXHRwdWJsaWMgcmVhZG9ubHkgdHJlZSA9IG5ldyBXZWxsRGVmaW5lZFByZWZpeFRyZWU8QWJzdHJhY3RGaWxlQ292ZXJhZ2U+KCk7XG5cdHB1YmxpYyByZWFkb25seSBhc3NvY2lhdGVkRGF0YSA9IG5ldyBNYXA8dW5rbm93biwgdW5rbm93bj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVzdWx0OiBMaXZlVGVzdFJlc3VsdCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZnJvbVRhc2tJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzb3I6IElDb3ZlcmFnZUFjY2Vzc29yLFxuXHQpIHsgfVxuXG5cdC8qKiBHZXRzIGFsbCB0ZXN0IElEcyB0aGF0IHdlcmUgaW5jbHVkZWQgaW4gdGhpcyB0ZXN0IHJ1bi4gKi9cblx0cHVibGljICphbGxQZXJUZXN0SURzKCkge1xuXHRcdGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRmb3IgKGNvbnN0IHJvb3Qgb2YgdGhpcy50cmVlLm5vZGVzKSB7XG5cdFx0XHRpZiAocm9vdC52YWx1ZSAmJiByb290LnZhbHVlLnBlclRlc3REYXRhKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgaWQgb2Ygcm9vdC52YWx1ZS5wZXJUZXN0RGF0YSkge1xuXHRcdFx0XHRcdGlmICghc2Vlbi5oYXMoaWQpKSB7XG5cdFx0XHRcdFx0XHRzZWVuLmFkZChpZCk7XG5cdFx0XHRcdFx0XHR5aWVsZCBpZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXBwZW5kKGNvdmVyYWdlOiBJRmlsZUNvdmVyYWdlLCB0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB0aGlzLmdldENvbXB1dGVkRm9yVXJpKGNvdmVyYWdlLnVyaSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5yZXN1bHQ7XG5cdFx0Y29uc3QgYXBwbHlEZWx0YSA9IChraW5kOiAnc3RhdGVtZW50JyB8ICdicmFuY2gnIHwgJ2RlY2xhcmF0aW9uJywgbm9kZTogQ29tcHV0ZWRGaWxlQ292ZXJhZ2UpID0+IHtcblx0XHRcdGlmICghbm9kZVtraW5kXSkge1xuXHRcdFx0XHRpZiAoY292ZXJhZ2Vba2luZF0pIHtcblx0XHRcdFx0XHRub2RlW2tpbmRdID0geyAuLi5jb3ZlcmFnZVtraW5kXSEgfTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZVtraW5kXSEuY292ZXJlZCArPSAoY292ZXJhZ2Vba2luZF0/LmNvdmVyZWQgfHwgMCkgLSAocHJldmlvdXM/LltraW5kXT8uY292ZXJlZCB8fCAwKTtcblx0XHRcdFx0bm9kZVtraW5kXSEudG90YWwgKz0gKGNvdmVyYWdlW2tpbmRdPy50b3RhbCB8fCAwKSAtIChwcmV2aW91cz8uW2tpbmRdPy50b3RhbCB8fCAwKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gV2UgaW5zZXJ0IHVzaW5nIHRoZSBub24tY2Fub25pY2FsIHBhdGggdG8gbm9ybWFsaXplIGZvciBjYXNpbmcgZGlmZmVyZW5jZXNcblx0XHQvLyBiZXR3ZWVuIFVSSXMsIGJ1dCB3aGVuIGluc2VydGluZyBhbiBpbnRlcm1lZGlhdGUgbm9kZSBhbHdheXMgdXNlICdhJyBjYW5vbmljYWxcblx0XHQvLyB2ZXJzaW9uLlxuXHRcdGNvbnN0IGNhbm9uaWNhbCA9IFsuLi50aGlzLnRyZWVQYXRoRm9yVXJpKGNvdmVyYWdlLnVyaSwgLyogY2Fub25pY2FsID0gKi8gdHJ1ZSldO1xuXHRcdGNvbnN0IGNoYWluOiBJUHJlZml4VHJlZU5vZGU8QWJzdHJhY3RGaWxlQ292ZXJhZ2U+W10gPSBbXTtcblxuXHRcdHRoaXMudHJlZS5tdXRhdGVQYXRoKHRoaXMudHJlZVBhdGhGb3JVcmkoY292ZXJhZ2UudXJpLCAvKiBjYW5vbmljYWwgPSAqLyBmYWxzZSksIG5vZGUgPT4ge1xuXHRcdFx0Y2hhaW4ucHVzaChub2RlKTtcblxuXHRcdFx0aWYgKGNoYWluLmxlbmd0aCA9PT0gY2Fub25pY2FsLmxlbmd0aCkge1xuXHRcdFx0XHQvLyB3ZSByZWFjaGVkIG91ciBkZXN0aW5hdGlvbiBub2RlLCBhcHBseSB0aGUgY292ZXJhZ2UgYXMgbmVjZXNzYXJ5OlxuXHRcdFx0XHRpZiAobm9kZS52YWx1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHYgPSBub2RlLnZhbHVlO1xuXHRcdFx0XHRcdC8vIGlmIElEIHdhcyBnZW5lcmF0ZWQgZnJvbSBhIHRlc3Qtc3BlY2lmaWMgY292ZXJhZ2UsIHJlYXNzaWduIGl0IHRvIGdldCBpdHMgcmVhbCBJRCBpbiB0aGUgZXh0ZW5zaW9uIGhvc3QuXG5cdFx0XHRcdFx0di5pZCA9IGNvdmVyYWdlLmlkO1xuXHRcdFx0XHRcdHYuc3RhdGVtZW50ID0gY292ZXJhZ2Uuc3RhdGVtZW50O1xuXHRcdFx0XHRcdHYuYnJhbmNoID0gY292ZXJhZ2UuYnJhbmNoO1xuXHRcdFx0XHRcdHYuZGVjbGFyYXRpb24gPSBjb3ZlcmFnZS5kZWNsYXJhdGlvbjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCB2ID0gbm9kZS52YWx1ZSA9IG5ldyBGaWxlQ292ZXJhZ2UoY292ZXJhZ2UsIHJlc3VsdCwgdGhpcy5hY2Nlc3Nvcik7XG5cdFx0XHRcdFx0dGhpcy5maWxlQ292ZXJhZ2Uuc2V0KGNvdmVyYWdlLnVyaSwgdik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE90aGVyd2lzZSwgaWYgdGhpcyBpcyBub3QgYSBwYXJ0aWFsIHBlci10ZXN0IGNvdmVyYWdlLCBtZXJnZSB0aGVcblx0XHRcdFx0Ly8gY292ZXJhZ2UgY2hhbmdlcyBpbnRvIHRoZSBjaGFpbi4gUGVyLXRlc3QgY292ZXJhZ2VzIGFyZSBub3QgY29tcGxldGVcblx0XHRcdFx0Ly8gYW5kIHdlIGRvbid0IHdhbnQgdG8gY29uc2lkZXIgdGhlbSBmb3IgY29tcHV0YXRpb24uXG5cdFx0XHRcdGlmICghbm9kZS52YWx1ZSkge1xuXHRcdFx0XHRcdC8vIGNsb25lIGJlY2F1c2UgbGF0ZXIgaW50ZXJzZXJ0aW9ucyBjYW4gbW9kaWZ5IHRoZSBjb3VudHM6XG5cdFx0XHRcdFx0Y29uc3QgaW50ZXJtZWRpYXRlID0gZGVlcENsb25lKGNvdmVyYWdlKTtcblx0XHRcdFx0XHRpbnRlcm1lZGlhdGUuaWQgPSBTdHJpbmcoaW5jSWQrKyk7XG5cdFx0XHRcdFx0aW50ZXJtZWRpYXRlLnVyaSA9IHRoaXMudHJlZVBhdGhUb1VyaShjYW5vbmljYWwuc2xpY2UoMCwgY2hhaW4ubGVuZ3RoKSk7XG5cdFx0XHRcdFx0bm9kZS52YWx1ZSA9IG5ldyBDb21wdXRlZEZpbGVDb3ZlcmFnZShpbnRlcm1lZGlhdGUsIHJlc3VsdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXBwbHlEZWx0YSgnc3RhdGVtZW50Jywgbm9kZS52YWx1ZSk7XG5cdFx0XHRcdFx0YXBwbHlEZWx0YSgnYnJhbmNoJywgbm9kZS52YWx1ZSk7XG5cdFx0XHRcdFx0YXBwbHlEZWx0YSgnZGVjbGFyYXRpb24nLCBub2RlLnZhbHVlKTtcblx0XHRcdFx0XHRub2RlLnZhbHVlLmRpZENoYW5nZS50cmlnZ2VyKHR4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY292ZXJhZ2UudGVzdElkcykge1xuXHRcdFx0XHRub2RlLnZhbHVlIS5wZXJUZXN0RGF0YSA/Pz0gbmV3IFNldCgpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGNvdmVyYWdlLnRlc3RJZHMpIHtcblx0XHRcdFx0XHRub2RlLnZhbHVlIS5wZXJUZXN0RGF0YS5hZGQoaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoY2hhaW4pIHtcblx0XHRcdHRoaXMuZGlkQWRkQ292ZXJhZ2UudHJpZ2dlcih0eCwgY2hhaW4pO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZHMgYSBuZXcgdHJlZSBmaWx0ZXJlZCB0byBwZXItdGVzdCBjb3ZlcmFnZSBkYXRhIGZvciB0aGUgZ2l2ZW4gSUQuXG5cdCAqL1xuXHRwdWJsaWMgZmlsdGVyVHJlZUZvclRlc3QodGVzdElkOiBUZXN0SWQpIHtcblx0XHRjb25zdCB0cmVlID0gbmV3IFdlbGxEZWZpbmVkUHJlZml4VHJlZTxBYnN0cmFjdEZpbGVDb3ZlcmFnZT4oKTtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy50cmVlLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAobm9kZSBpbnN0YW5jZW9mIEZpbGVDb3ZlcmFnZSkge1xuXHRcdFx0XHRpZiAoIW5vZGUucGVyVGVzdERhdGE/Lmhhcyh0ZXN0SWQudG9TdHJpbmcoKSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGNhbm9uaWNhbCA9IFsuLi50aGlzLnRyZWVQYXRoRm9yVXJpKG5vZGUudXJpLCAvKiBjYW5vbmljYWwgPSAqLyB0cnVlKV07XG5cdFx0XHRcdGNvbnN0IGNoYWluOiBJUHJlZml4VHJlZU5vZGU8QWJzdHJhY3RGaWxlQ292ZXJhZ2U+W10gPSBbXTtcblx0XHRcdFx0dHJlZS5tdXRhdGVQYXRoKHRoaXMudHJlZVBhdGhGb3JVcmkobm9kZS51cmksIC8qIGNhbm9uaWNhbCA9ICovIGZhbHNlKSwgbiA9PiB7XG5cdFx0XHRcdFx0Y2hhaW4ucHVzaChuKTtcblx0XHRcdFx0XHRuLnZhbHVlID8/PSBuZXcgQnlwYXNzZWRGaWxlQ292ZXJhZ2UodGhpcy50cmVlUGF0aFRvVXJpKGNhbm9uaWNhbC5zbGljZSgwLCBjaGFpbi5sZW5ndGgpKSwgbm9kZS5mcm9tUmVzdWx0KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRyZWU7XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyBjb3ZlcmFnZSBpbmZvcm1hdGlvbiBmb3IgYWxsIGZpbGVzLlxuXHQgKi9cblx0cHVibGljIGdldEFsbEZpbGVzKCkge1xuXHRcdHJldHVybiB0aGlzLmZpbGVDb3ZlcmFnZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIGNvdmVyYWdlIGluZm9ybWF0aW9uIGZvciBhIHNwZWNpZmljIGZpbGUuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0VXJpKHVyaTogVVJJKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZUNvdmVyYWdlLmdldCh1cmkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgY29tcHV0ZWQgaW5mb3JtYXRpb24gZm9yIGEgZmlsZSwgaW5jbHVkaW5nIERGUy1jb21wdXRlZCBpbmZvcm1hdGlvblxuXHQgKiBmcm9tIGNoaWxkIHRlc3RzLlxuXHQgKi9cblx0cHVibGljIGdldENvbXB1dGVkRm9yVXJpKHVyaTogVVJJKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5maW5kKHRoaXMudHJlZVBhdGhGb3JVcmkodXJpLCAvKiBjYW5vbmljYWwgPSAqLyBmYWxzZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSAqdHJlZVBhdGhGb3JVcmkodXJpOiBVUkksIGNhbmNvbmljYWxQYXRoOiBib29sZWFuKSB7XG5cdFx0eWllbGQgdXJpLnNjaGVtZTtcblx0XHR5aWVsZCB1cmkuYXV0aG9yaXR5O1xuXG5cdFx0Y29uc3QgcGF0aCA9ICFjYW5jb25pY2FsUGF0aCAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaWdub3JlUGF0aENhc2luZyh1cmkpID8gdXJpLnBhdGgudG9Mb3dlckNhc2UoKSA6IHVyaS5wYXRoO1xuXHRcdHlpZWxkKiBwYXRoLnNwbGl0KCcvJyk7XG5cdH1cblxuXHRwcml2YXRlIHRyZWVQYXRoVG9VcmkocGF0aDogc3RyaW5nW10pIHtcblx0XHRyZXR1cm4gVVJJLmZyb20oeyBzY2hlbWU6IHBhdGhbMF0sIGF1dGhvcml0eTogcGF0aFsxXSwgcGF0aDogcGF0aC5zbGljZSgyKS5qb2luKCcvJykgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGdldFRvdGFsQ292ZXJhZ2VQZXJjZW50ID0gKHN0YXRlbWVudDogSUNvdmVyYWdlQ291bnQsIGJyYW5jaDogSUNvdmVyYWdlQ291bnQgfCB1bmRlZmluZWQsIGZ1bmN0aW9uXzogSUNvdmVyYWdlQ291bnQgfCB1bmRlZmluZWQpID0+IHtcblx0bGV0IG51bWVyYXRvciA9IHN0YXRlbWVudC5jb3ZlcmVkO1xuXHRsZXQgZGVub21pbmF0b3IgPSBzdGF0ZW1lbnQudG90YWw7XG5cblx0aWYgKGJyYW5jaCkge1xuXHRcdG51bWVyYXRvciArPSBicmFuY2guY292ZXJlZDtcblx0XHRkZW5vbWluYXRvciArPSBicmFuY2gudG90YWw7XG5cdH1cblxuXHRpZiAoZnVuY3Rpb25fKSB7XG5cdFx0bnVtZXJhdG9yICs9IGZ1bmN0aW9uXy5jb3ZlcmVkO1xuXHRcdGRlbm9taW5hdG9yICs9IGZ1bmN0aW9uXy50b3RhbDtcblx0fVxuXG5cdHJldHVybiBkZW5vbWluYXRvciA9PT0gMCA/IDEgOiBudW1lcmF0b3IgLyBkZW5vbWluYXRvcjtcbn07XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEZpbGVDb3ZlcmFnZSB7XG5cdHB1YmxpYyBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgdXJpOiBVUkk7XG5cdHB1YmxpYyBzdGF0ZW1lbnQ6IElDb3ZlcmFnZUNvdW50O1xuXHRwdWJsaWMgYnJhbmNoPzogSUNvdmVyYWdlQ291bnQ7XG5cdHB1YmxpYyBkZWNsYXJhdGlvbj86IElDb3ZlcmFnZUNvdW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgZGlkQ2hhbmdlID0gb2JzZXJ2YWJsZVNpZ25hbCh0aGlzKTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgdG90YWwgY292ZXJhZ2UgcGVyY2VudCBiYXNlZCBvbiBpbmZvcm1hdGlvbiBwcm92aWRlZC5cblx0ICogVGhpcyBpcyBiYXNlZCBvbiB0aGUgQ2xvdmVyIHRvdGFsIGNvdmVyYWdlIGZvcm11bGFcblx0ICovXG5cdHB1YmxpYyBnZXQgdHBjKCkge1xuXHRcdHJldHVybiBnZXRUb3RhbENvdmVyYWdlUGVyY2VudCh0aGlzLnN0YXRlbWVudCwgdGhpcy5icmFuY2gsIHRoaXMuZGVjbGFyYXRpb24pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlci10ZXN0IGNvdmVyYWdlIGRhdGEgZm9yIHRoaXMgZmlsZSwgaWYgYXZhaWxhYmxlLlxuXHQgKi9cblx0cHVibGljIHBlclRlc3REYXRhPzogU2V0PHN0cmluZz47XG5cblx0Y29uc3RydWN0b3IoY292ZXJhZ2U6IElGaWxlQ292ZXJhZ2UsIHB1YmxpYyByZWFkb25seSBmcm9tUmVzdWx0OiBMaXZlVGVzdFJlc3VsdCkge1xuXHRcdHRoaXMuaWQgPSBjb3ZlcmFnZS5pZDtcblx0XHR0aGlzLnVyaSA9IGNvdmVyYWdlLnVyaTtcblx0XHR0aGlzLnN0YXRlbWVudCA9IGNvdmVyYWdlLnN0YXRlbWVudDtcblx0XHR0aGlzLmJyYW5jaCA9IGNvdmVyYWdlLmJyYW5jaDtcblx0XHR0aGlzLmRlY2xhcmF0aW9uID0gY292ZXJhZ2UuZGVjbGFyYXRpb247XG5cdH1cbn1cblxuLyoqXG4gKiBGaWxlIGNvdmVyYWdlIGluZm8gY29tcHV0ZWQgZnJvbSBjaGlsZHJlbiBpbiB0aGUgdHJlZSwgbm90IHByb3ZpZGVkIGJ5IHRoZVxuICogZXh0ZW5zaW9uLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcHV0ZWRGaWxlQ292ZXJhZ2UgZXh0ZW5kcyBBYnN0cmFjdEZpbGVDb3ZlcmFnZSB7IH1cblxuLyoqXG4gKiBBIHZpcnR1YWwgbm9kZSB0aGF0IGRvZXNuJ3QgaGF2ZSBhbnkgYWRkZWQgY292ZXJhZ2UgaW5mby5cbiAqL1xuZXhwb3J0IGNsYXNzIEJ5cGFzc2VkRmlsZUNvdmVyYWdlIGV4dGVuZHMgQ29tcHV0ZWRGaWxlQ292ZXJhZ2Uge1xuXHRjb25zdHJ1Y3Rvcih1cmk6IFVSSSwgcmVzdWx0OiBMaXZlVGVzdFJlc3VsdCkge1xuXHRcdHN1cGVyKHsgaWQ6IFN0cmluZyhpbmNJZCsrKSwgdXJpLCBzdGF0ZW1lbnQ6IHsgY292ZXJlZDogMCwgdG90YWw6IDAgfSB9LCByZXN1bHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlQ292ZXJhZ2UgZXh0ZW5kcyBBYnN0cmFjdEZpbGVDb3ZlcmFnZSB7XG5cdHByaXZhdGUgX2RldGFpbHM/OiBQcm9taXNlPENvdmVyYWdlRGV0YWlsc1tdPjtcblx0cHJpdmF0ZSByZXNvbHZlZD86IGJvb2xlYW47XG5cdHByaXZhdGUgX2RldGFpbHNGb3JUZXN0PzogTWFwPHN0cmluZywgUHJvbWlzZTxDb3ZlcmFnZURldGFpbHNbXT4+O1xuXG5cdC8qKiBHZXRzIHdoZXRoZXIgZGV0YWlscyBhcmUgc3luY2hyb25vdXNseSBhdmFpbGFibGUgKi9cblx0cHVibGljIGdldCBoYXNTeW5jaHJvbm91c0RldGFpbHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RldGFpbHMgaW5zdGFuY2VvZiBBcnJheSB8fCB0aGlzLnJlc29sdmVkO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoY292ZXJhZ2U6IElGaWxlQ292ZXJhZ2UsIGZyb21SZXN1bHQ6IExpdmVUZXN0UmVzdWx0LCBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc29yOiBJQ292ZXJhZ2VBY2Nlc3Nvcikge1xuXHRcdHN1cGVyKGNvdmVyYWdlLCBmcm9tUmVzdWx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHBlci1saW5lIGNvdmVyYWdlIGRldGFpbHMuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgZGV0YWlsc0ZvclRlc3QoX3Rlc3RJZDogVGVzdElkLCB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpIHtcblx0XHR0aGlzLl9kZXRhaWxzRm9yVGVzdCA/Pz0gbmV3IE1hcCgpO1xuXHRcdGNvbnN0IHRlc3RJZCA9IF90ZXN0SWQudG9TdHJpbmcoKTtcblx0XHRjb25zdCBwcmV2ID0gdGhpcy5fZGV0YWlsc0ZvclRlc3QuZ2V0KHRlc3RJZCk7XG5cdFx0aWYgKHByZXYpIHtcblx0XHRcdHJldHVybiBwcmV2O1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuYWNjZXNzb3IuZ2V0Q292ZXJhZ2VEZXRhaWxzKHRoaXMuaWQsIHRlc3RJZCwgdG9rZW4pO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzRm9yVGVzdD8uZGVsZXRlKHRlc3RJZCk7XG5cdFx0XHRcdHRocm93IGU7XG5cdFx0XHR9XG5cdFx0fSkoKTtcblxuXHRcdHRoaXMuX2RldGFpbHNGb3JUZXN0LnNldCh0ZXN0SWQsIHByb21pc2UpO1xuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgcGVyLWxpbmUgY292ZXJhZ2UgZGV0YWlscy5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBkZXRhaWxzKHRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkge1xuXHRcdHRoaXMuX2RldGFpbHMgPz89IHRoaXMuYWNjZXNzb3IuZ2V0Q292ZXJhZ2VEZXRhaWxzKHRoaXMuaWQsIHVuZGVmaW5lZCwgdG9rZW4pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGQgPSBhd2FpdCB0aGlzLl9kZXRhaWxzO1xuXHRcdFx0dGhpcy5yZXNvbHZlZCA9IHRydWU7XG5cdFx0XHRyZXR1cm4gZDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9kZXRhaWxzID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IHRvdGFsRnJvbUNvdmVyYWdlRGV0YWlscyA9ICh1cmk6IFVSSSwgZGV0YWlsczogQ292ZXJhZ2VEZXRhaWxzW10pOiBJRmlsZUNvdmVyYWdlID0+IHtcblx0Y29uc3QgZmM6IElGaWxlQ292ZXJhZ2UgPSB7XG5cdFx0aWQ6ICcnLFxuXHRcdHVyaSxcblx0XHRzdGF0ZW1lbnQ6IElDb3ZlcmFnZUNvdW50LmVtcHR5KCksXG5cdH07XG5cblx0Zm9yIChjb25zdCBkZXRhaWwgb2YgZGV0YWlscykge1xuXHRcdGlmIChkZXRhaWwudHlwZSA9PT0gRGV0YWlsVHlwZS5TdGF0ZW1lbnQpIHtcblx0XHRcdGZjLnN0YXRlbWVudC50b3RhbCsrO1xuXHRcdFx0ZmMuc3RhdGVtZW50LnRvdGFsICs9IGRldGFpbC5jb3VudCA/IDEgOiAwO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGJyYW5jaCBvZiBkZXRhaWwuYnJhbmNoZXMgfHwgW10pIHtcblx0XHRcdFx0ZmMuYnJhbmNoID8/PSBJQ292ZXJhZ2VDb3VudC5lbXB0eSgpO1xuXHRcdFx0XHRmYy5icmFuY2gudG90YWwrKztcblx0XHRcdFx0ZmMuYnJhbmNoLmNvdmVyZWQgKz0gYnJhbmNoLmNvdW50ID8gMSA6IDA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZjLmRlY2xhcmF0aW9uID8/PSBJQ292ZXJhZ2VDb3VudC5lbXB0eSgpO1xuXHRcdFx0ZmMuZGVjbGFyYXRpb24udG90YWwrKztcblx0XHRcdGZjLmRlY2xhcmF0aW9uLmNvdmVyZWQgKz0gZGV0YWlsLmNvdW50ID8gMSA6IDA7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGZjO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQXVCLHdCQUF3QjtBQUMvQyxTQUEwQiw2QkFBNkI7QUFDdkQsU0FBUyxXQUFXO0FBSXBCLFNBQTBCLFlBQVksc0JBQXFDO0FBTTNFLElBQUksUUFBUTtBQUtMLE1BQU0sYUFBYTtBQUFBLEVBTXpCLFlBQ2lCLFFBQ0EsWUFDQyxvQkFDQSxVQUNoQjtBQUplO0FBQ0E7QUFDQztBQUNBO0FBVGxCLFNBQWlCLGVBQWUsSUFBSSxZQUEwQjtBQUM5RCxTQUFnQixpQkFBaUIsaUJBQTBELElBQUk7QUFDL0YsU0FBZ0IsT0FBTyxJQUFJLHNCQUE0QztBQUN2RSxTQUFnQixpQkFBaUIsb0JBQUksSUFBc0I7QUFBQSxFQU92RDtBQUFBO0FBQUEsRUFHSixDQUFRLGdCQUFnQjtBQUN2QixVQUFNLE9BQU8sb0JBQUksSUFBWTtBQUM3QixlQUFXLFFBQVEsS0FBSyxLQUFLLE9BQU87QUFDbkMsVUFBSSxLQUFLLFNBQVMsS0FBSyxNQUFNLGFBQWE7QUFDekMsbUJBQVcsTUFBTSxLQUFLLE1BQU0sYUFBYTtBQUN4QyxjQUFJLENBQUMs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NUUsU0FBSyxvQkFBb0Isb0JBQUksSUFBSTtBQUNqQyxVQUFNLFNBQVMsUUFBUSxTQUFTO0FBQ2hDLFVBQU0sT0FBTyxLQUFLLGdCQUFnQixJQUFJLE1BQU07QUFDNUMsUUFBSSxNQUFNO0FBQ1QsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFdBQVcsWUFBWTtBQUM1QixVQUFJO0FBQ0gsZUFBTyxNQUFNLEtBQUssU0FBUyxtQkFBbUIsS0FBSyxJQUFJLFFBQVEsS0FBSztBQUFBLE1BQ3JFLFNBQVMsR0FBRztBQUNYLGFBQUssaUJBQWlCLE9BQU8sTUFBTTtBQUNuQyxjQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0QsR0FBRztBQUVILFNBQUssZ0JBQWdCLElBQUksUUFBUSxPQUFPO0FBQ3hDLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFhLFFBQVEsUUFBUSxrQkFBa0IsTUFBTTtBQUNwRCxTQUFLLGFBQWEsS0FBSyxTQUFTLG1CQUFtQixLQUFLLElBQUksUUFBVyxLQUFLO0FBRTVFLFFBQUk7QUFDSCxZQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLFdBQUssV0FBVztBQUNoQixhQUFPO0FBQUEsSUFDUixTQUFTLEdBQUc7QUFDWCxXQUFLLFdBQVc7QUFDaEIsWUFBTTtBQUFBLElBQ1A7QUFBQSxFQUNEO0FBQ0Q7QUFFTyxNQUFNLDJCQUEyQixDQUFDLEtBQVUsWUFBOEM7QUFDaEcsUUFBTSxLQUFvQjtBQUFBLElBQ3pCLElBQUk7QUFBQSxJQUNKO0FBQUEsSUFDQSxXQUFXLGVBQWUsTUFBTTtBQUFBLEVBQ2pDO0FBRUEsYUFBVyxVQUFVLFNBQVM7QUFDN0IsUUFBSSxPQUFPLFNBQVMsV0FBVyxXQUFXO0FBQ3pDLFNBQUcsVUFBVTtBQUNiLFNBQUcsVUFBVSxTQUFTLE9BQU8sUUFBUSxJQUFJO0FBRXpDLGlCQUFXLFVBQVUsT0FBTyxZQUFZLENBQUMsR0FBRztBQUMzQyxXQUFHLFdBQVcsZUFBZSxNQUFNO0FBQ25DLFdBQUcsT0FBTztBQUNWLFdBQUcsT0FBTyxXQUFXLE9BQU8sUUFBUSxJQUFJO0FBQUEsTUFDekM7QUFBQSxJQUNELE9BQU87QUFDTixTQUFHLGdCQUFnQixlQUFlLE1BQU07QUFDeEMsU0FBRyxZQUFZO0FBQ2YsU0FBRyxZQUFZLFdBQVcsT0FBTyxRQUFRLElBQUk7QUFBQSxJQUM5QztBQUFBLEVBQ0Q7QUFFQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbXQp9Cg==
