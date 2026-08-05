import { LcsDiff } from "../../../../../base/common/diff/diff.js";
import { doHash, hash, numberHash } from "../../../../../base/common/hash.js";
import { URI } from "../../../../../base/common/uri.js";
import { PieceTreeTextBufferBuilder } from "../../../../../editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder.js";
import { CellKind, NotebookCellsChangeType } from "../notebookCommon.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { SearchParams } from "../../../../../editor/common/model/textModelSearch.js";
import { MirrorModel } from "../../../../../editor/common/services/textModelSync/textModelSync.impl.js";
import { DefaultEndOfLine } from "../../../../../editor/common/model.js";
import { filter } from "../../../../../base/common/objects.js";
import { matchCellBasedOnSimilarties } from "./notebookCellMatching.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { DiffChange } from "../../../../../base/common/diff/diffChange.js";
import { computeDiff } from "../notebookDiff.js";
const PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS = `unmatchedOriginalCell`;
class MirrorCell {
  constructor(handle, uri, source, _eol, versionId, language, cellKind, outputs, metadata, internalMetadata) {
    this.handle = handle;
    this._eol = _eol;
    this.language = language;
    this.cellKind = cellKind;
    this.outputs = outputs;
    this.metadata = metadata;
    this.internalMetadata = internalMetadata;
    this.textModel = new MirrorModel(uri, source, _eol, versionId);
  }
  get eol() {
    return this._eol === "\r\n" ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF;
  }
  onEvents(e) {
    this.textModel.onEvents(e);
    this._hash = void 0;
  }
  getValue() {
    return this.textModel.getValue();
  }
  getLinesContent() {
    return this.textModel.getLinesContent();
  }
  getComparisonValue() {
    return this._hash ??= this._getHash();
  }
  _getHash() {
    let hashValue = numberHash(104579, 0);
    hashValue = doHash(this.language, hashValue);
    hashValue = doHash(this.getValue(), hashValue);
    hashValue = doHash(this.metadata, hashValue);
    hashValue = doHash(this.internalMetadata?.internalId || "", hashValue);
    for (const op of this.outputs) {
      hashValue = doHash(op.metadata, hashValue);
      for (const output of op.outputs) {
        hashValue = doHash(output.mime, hashValue);
      }
    }
    const digests = this.outputs.flatMap(
      (op) => op.outputs.map((o) => hash(Array.from(o.data.buffer)))
    );
    for (const digest of digests) {
      hashValue = numberHash(digest, hashValue);
    }
    return hashValue;
  }
}
class MirrorNotebookDocument {
  constructor(uri, cells, metadata, transientDocumentMetadata) {
    this.uri = uri;
    this.cells = cells;
    this.metadata = metadata;
    this.transientDocumentMetadata = transientDocumentMetadata;
  }
  acceptModelChanged(event) {
    event.rawEvents.forEach((e) => {
      if (e.kind === NotebookCellsChangeType.ModelChange) {
        this._spliceNotebookCells(e.changes);
      } else if (e.kind === NotebookCellsChangeType.Move) {
        const cells = this.cells.splice(e.index, 1);
        this.cells.splice(e.newIdx, 0, ...cells);
      } else if (e.kind === NotebookCellsChangeType.Output) {
        const cell = this.cells[e.index];
        cell.outputs = e.outputs;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellLanguage) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.language = e.language;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellMetadata) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.metadata = e.metadata;
      } else if (e.kind === NotebookCellsChangeType.ChangeCellInternalMetadata) {
        this._assertIndex(e.index);
        const cell = this.cells[e.index];
        cell.internalMetadata = e.internalMetadata;
      } else if (e.kind === NotebookCellsChangeType.ChangeDocumentMetadata) {
        this.metadata = e.metadata;
      }
    });
  }
  _assertIndex(index) {
    if (index < 0 || index >= this.cells.length) {
      throw new Error(`Illegal index ${index}. Cells length: ${this.cells.length}`);
    }
  }
  _spliceNotebookCells(splices) {
    splices.reverse().forEach((splice) => {
      const cellDtos = splice[2];
      const newCells = cellDtos.map((cell) => {
        return new MirrorCell(
          cell.handle,
          URI.parse(cell.url),
          cell.source,
          cell.eol,
          cell.versionId,
          cell.language,
          cell.cellKind,
          cell.outputs,
          cell.metadata
        );
      });
      this.cells.splice(splice[0], splice[1], ...newCells);
    });
  }
}
class CellSequence {
  constructor(hashValue) {
    this.hashValue = hashValue;
  }
  static create(textModel) {
    const hashValue = textModel.cells.map((c) => c.getComparisonValue());
    return new CellSequence(hashValue);
  }
  static createWithCellId(cells, includeCellContents) {
    const hashValue = cells.map((c) => {
      if (includeCellContents) {
        return `${doHash(c.internalMetadata?.internalId, numberHash(104579, 0))}#${c.getComparisonValue()}`;
      } else {
        return `${doHash(c.internalMetadata?.internalId, numberHash(104579, 0))}}`;
      }
    });
    return new CellSequence(hashValue);
  }
  getElements() {
    return this.hashValue;
  }
}
class NotebookWorker {
  constructor() {
    this._models = /* @__PURE__ */ Object.create(null);
  }
  dispose() {
  }
  $acceptNewModel(uri, metadata, transientDocumentMetadata, cells) {
    this._models[uri] = new MirrorNotebookDocument(URI.parse(uri), cells.map((dto) => new MirrorCell(
      dto.handle,
      URI.parse(dto.url),
      dto.source,
      dto.eol,
      dto.versionId,
      dto.language,
      dto.cellKind,
      dto.outputs,
      dto.metadata,
      dto.internalMetadata
    )), metadata, transientDocumentMetadata);
  }
  $acceptModelChanged(strURL, event) {
    const model = this._models[strURL];
    model?.acceptModelChanged(event);
  }
  $acceptCellModelChanged(strURL, handle, event) {
    const model = this._models[strURL];
    model.cells.find((cell) => cell.handle === handle)?.onEvents(event);
  }
  $acceptRemovedModel(strURL) {
    if (!this._models[strURL]) {
      return;
    }
    delete this._models[strURL];
  }
  async $computeDiff(originalUrl, modifiedUrl) {
    const original = this._getModel(originalUrl);
    const modified = this._getModel(modifiedUrl);
    const originalModel = new NotebookTextModelFacade(original);
    const modifiedModel = new NotebookTextModelFacade(modified);
    const originalMetadata = filter(original.metadata, (key) => !original.transientDocumentMetadata[key]);
    const modifiedMetadata = filter(modified.metadata, (key) => !modified.transientDocumentMetadata[key]);
    const metadataChanged = JSON.stringify(originalMetadata) !== JSON.stringify(modifiedMetadata);
    const originalDiff = new LcsDiff(CellSequence.create(original), CellSequence.create(modified)).ComputeDiff(false);
    if (originalDiff.changes.length === 0) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    const cellMapping = computeDiff(originalModel, modifiedModel, { cellsDiff: { changes: originalDiff.changes, quitEarly: false }, metadataChanged: false }).cellDiffInfo;
    if (cellMapping.every((c) => c.type === "modified")) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    let diffUsingCellIds = this.canComputeDiffWithCellIds(original, modified);
    if (!diffUsingCellIds) {
      const result = matchCellBasedOnSimilarties(modified.cells, original.cells);
      if (result.some((c) => c.original !== -1)) {
        this.updateCellIdsBasedOnMappings(result, original.cells, modified.cells);
        diffUsingCellIds = true;
      }
    }
    if (!diffUsingCellIds) {
      return {
        metadataChanged,
        cellsDiff: originalDiff
      };
    }
    const cellsInsertedOrDeletedDiff = new LcsDiff(CellSequence.createWithCellId(original.cells), CellSequence.createWithCellId(modified.cells)).ComputeDiff(false);
    const cellDiffInfo = computeDiff(originalModel, modifiedModel, { cellsDiff: { changes: cellsInsertedOrDeletedDiff.changes, quitEarly: false }, metadataChanged: false }).cellDiffInfo;
    let processedIndex = 0;
    const changes = [];
    cellsInsertedOrDeletedDiff.changes.forEach((change) => {
      if (!change.originalLength && change.modifiedLength) {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "insert" && c.modifiedCellIndex === change.modifiedStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      } else if (change.originalLength && !change.modifiedLength) {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "delete" && c.originalCellIndex === change.originalStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      } else {
        const changeIndex = cellDiffInfo.findIndex((c) => c.type === "delete" && c.originalCellIndex === change.originalStart || c.type === "insert" && c.modifiedCellIndex === change.modifiedStart);
        cellDiffInfo.slice(processedIndex, changeIndex).forEach((c) => {
          if (c.type === "unchanged" || c.type === "modified") {
            const originalCell = original.cells[c.originalCellIndex];
            const modifiedCell = modified.cells[c.modifiedCellIndex];
            const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
            if (changed) {
              changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
            }
          }
        });
        changes.push(change);
        processedIndex = changeIndex + 1;
      }
    });
    cellDiffInfo.slice(processedIndex).forEach((c) => {
      if (c.type === "unchanged" || c.type === "modified") {
        const originalCell = original.cells[c.originalCellIndex];
        const modifiedCell = modified.cells[c.modifiedCellIndex];
        const changed = c.type === "modified" || originalCell.getComparisonValue() !== modifiedCell.getComparisonValue();
        if (changed) {
          changes.push(new DiffChange(c.originalCellIndex, 1, c.modifiedCellIndex, 1));
        }
      }
    });
    return {
      metadataChanged,
      cellsDiff: {
        changes,
        quitEarly: false
      }
    };
  }
  canComputeDiffWithCellIds(original, modified) {
    return this.canComputeDiffWithCellInternalIds(original, modified) || this.canComputeDiffWithCellMetadataIds(original, modified);
  }
  canComputeDiffWithCellInternalIds(original, modified) {
    const originalCellIndexIds = original.cells.map((cell, index) => ({ index, id: cell.internalMetadata?.internalId || "" }));
    const modifiedCellIndexIds = modified.cells.map((cell, index) => ({ index, id: cell.internalMetadata?.internalId || "" }));
    if (originalCellIndexIds.some((c) => !c.id) || modifiedCellIndexIds.some((c) => !c.id)) {
      return false;
    }
    return originalCellIndexIds.some((c) => modifiedCellIndexIds.find((m) => m.id === c.id));
  }
  canComputeDiffWithCellMetadataIds(original, modified) {
    const originalCellIndexIds = original.cells.map((cell, index) => ({ index, id: cell.metadata?.id || "" }));
    const modifiedCellIndexIds = modified.cells.map((cell, index) => ({ index, id: cell.metadata?.id || "" }));
    if (originalCellIndexIds.some((c) => !c.id) || modifiedCellIndexIds.some((c) => !c.id)) {
      return false;
    }
    if (originalCellIndexIds.every((c) => !modifiedCellIndexIds.find((m) => m.id === c.id))) {
      return false;
    }
    original.cells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || {};
      cell.internalMetadata.internalId = cell.metadata?.id || "";
    });
    modified.cells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || {};
      cell.internalMetadata.internalId = cell.metadata?.id || "";
    });
    return true;
  }
  isOriginalCellMatchedWithModifiedCell(originalCell) {
    return (originalCell.internalMetadata?.internalId || "").startsWith(PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS);
  }
  updateCellIdsBasedOnMappings(mappings, originalCells, modifiedCells) {
    const uuids = /* @__PURE__ */ new Map();
    originalCells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || { internalId: "" };
      cell.internalMetadata.internalId = `${PREFIX_FOR_UNMATCHED_ORIGINAL_CELLS}${generateUuid()}`;
      const found = mappings.find((r) => r.original === index);
      if (found) {
        cell.internalMetadata.internalId = generateUuid();
        uuids.set(found.modified, cell.internalMetadata.internalId);
      }
    });
    modifiedCells.map((cell, index) => {
      cell.internalMetadata = cell.internalMetadata || { internalId: "" };
      cell.internalMetadata.internalId = uuids.get(index) ?? generateUuid();
    });
    return true;
  }
  $canPromptRecommendation(modelUrl) {
    const model = this._getModel(modelUrl);
    const cells = model.cells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.cellKind === CellKind.Markup) {
        continue;
      }
      if (cell.language !== "python") {
        continue;
      }
      const searchParams = new SearchParams("import\\s*pandas|from\\s*pandas", true, false, null);
      const searchData = searchParams.parseSearchRequest();
      if (!searchData) {
        continue;
      }
      const builder = new PieceTreeTextBufferBuilder();
      builder.acceptChunk(cell.getValue());
      const bufferFactory = builder.finish(true);
      const textBuffer = bufferFactory.create(cell.eol).textBuffer;
      const lineCount = textBuffer.getLineCount();
      const maxLineCount = Math.min(lineCount, 20);
      const range = new Range(1, 1, maxLineCount, textBuffer.getLineLength(maxLineCount) + 1);
      const cellMatches = textBuffer.findMatchesLineByLine(range, searchData, true, 1);
      if (cellMatches.length > 0) {
        return true;
      }
    }
    return false;
  }
  _getModel(uri) {
    return this._models[uri];
  }
}
function create() {
  return new NotebookWorker();
}
class NotebookTextModelFacade {
  constructor(notebook) {
    this.notebook = notebook;
    this.cells = notebook.cells.map((cell) => new NotebookCellTextModelFacade(cell));
  }
}
class NotebookCellTextModelFacade {
  constructor(cell) {
    this.cell = cell;
  }
  get cellKind() {
    return this.cell.cellKind;
  }
  getHashValue() {
    return this.cell.getComparisonValue();
  }
  equal(cell) {
    if (cell.cellKind !== this.cellKind) {
      return false;
    }
    return this.getHashValue() === cell.getHashValue();
  }
}
export {
  NotebookWorker,
  create
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXZWJXb3JrZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IHsgSURpZmZDaGFuZ2UsIElTZXF1ZW5jZSwgTGNzRGlmZiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RpZmYvZGlmZi5qcyc7XG5pbXBvcnQgeyBkb0hhc2gsIGhhc2gsIG51bWJlckhhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJV2ViV29ya2VyU2VydmVyUmVxdWVzdEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi93b3JrZXIvd2ViV29ya2VyLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC9waWVjZVRyZWVUZXh0QnVmZmVyL3BpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBJTWFpbkNlbGxEdG8sIElOb3RlYm9va0RpZmZSZXN1bHQsIElPdXRwdXREdG8sIE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIE5vdGVib29rQ2VsbE1ldGFkYXRhLCBOb3RlYm9va0NlbGxzQ2hhbmdlZEV2ZW50RHRvLCBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZSwgTm90ZWJvb2tDZWxsVGV4dE1vZGVsU3BsaWNlLCBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEsIFRyYW5zaWVudERvY3VtZW50TWV0YWRhdGEgfSBmcm9tICcuLi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWFyY2hQYXJhbXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbFNlYXJjaC5qcyc7XG5pbXBvcnQgeyBNaXJyb3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dE1vZGVsU3luYy90ZXh0TW9kZWxTeW5jLmltcGwuanMnO1xuaW1wb3J0IHsgRGVmYXVsdEVuZE9mTGluZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC9taXJyb3JUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBtYXRjaENlbGxCYXNlZE9uU2ltaWxhcnRpZXMgfSBmcm9tICcuL25vdGVib29rQ2VsbE1hdGNoaW5nLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgRGlmZkNoYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RpZmYvZGlmZkNoYW5nZS5qcyc7XG5pbXBvcnQgeyBjb21wdXRlRGlmZiB9IGZyb20gJy4uL25vdGVib29rRGlmZi5qcyc7XG5cbmNvbnN0IFBSRUZJWF9GT1JfVU5NQVRDSEVEX09SSUdJTkFMX0NFTExTID0gYHVubWF0Y2hlZE9yaWdpbmFsQ2VsbGA7XG5cbmNsYXNzIE1pcnJvckNlbGwge1xuXHRwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbDogTWlycm9yTW9kZWw7XG5cdHByaXZhdGUgX2hhc2g/OiBudW1iZXI7XG5cdHB1YmxpYyBnZXQgZW9sKCkge1xuXHRcdHJldHVybiB0aGlzLl9lb2wgPT09ICdcXHJcXG4nID8gRGVmYXVsdEVuZE9mTGluZS5DUkxGIDogRGVmYXVsdEVuZE9mTGluZS5MRjtcblx0fVxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaGFuZGxlOiBudW1iZXIsXG5cdFx0dXJpOiBVUkksXG5cdFx0c291cmNlOiBzdHJpbmdbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lb2w6IHN0cmluZyxcblx0XHR2ZXJzaW9uSWQ6IG51bWJlcixcblx0XHRwdWJsaWMgbGFuZ3VhZ2U6IHN0cmluZyxcblx0XHRwdWJsaWMgY2VsbEtpbmQ6IENlbGxLaW5kLFxuXHRcdHB1YmxpYyBvdXRwdXRzOiBJT3V0cHV0RHRvW10sXG5cdFx0cHVibGljIG1ldGFkYXRhPzogTm90ZWJvb2tDZWxsTWV0YWRhdGEsXG5cdFx0cHVibGljIGludGVybmFsTWV0YWRhdGE/OiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhLFxuXG5cdCkge1xuXHRcdHRoaXMudGV4dE1vZGVsID0gbmV3IE1pcnJvck1vZGVsKHVyaSwgc291cmNlLCBfZW9sLCB2ZXJzaW9uSWQpO1xuXHR9XG5cblx0b25FdmVudHMoZTogSU1vZGVsQ2hhbmdlZEV2ZW50KSB7XG5cdFx0dGhpcy50ZXh0TW9kZWwub25FdmVudHMoZSk7XG5cdFx0dGhpcy5faGFzaCA9IHVuZGVmaW5lZDtcblx0fVxuXHRnZXRWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXHR9XG5cblx0Z2V0TGluZXNDb250ZW50KCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy50ZXh0TW9kZWwuZ2V0TGluZXNDb250ZW50KCk7XG5cdH1cblx0Z2V0Q29tcGFyaXNvblZhbHVlKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2hhc2ggPz89IHRoaXMuX2dldEhhc2goKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhhc2goKSB7XG5cdFx0bGV0IGhhc2hWYWx1ZSA9IG51bWJlckhhc2goMTA0NTc5LCAwKTtcblxuXHRcdGhhc2hWYWx1ZSA9IGRvSGFzaCh0aGlzLmxhbmd1YWdlLCBoYXNoVmFsdWUpO1xuXHRcdGhhc2hWYWx1ZSA9IGRvSGFzaCh0aGlzLmdldFZhbHVlKCksIGhhc2hWYWx1ZSk7XG5cdFx0aGFzaFZhbHVlID0gZG9IYXNoKHRoaXMubWV0YWRhdGEsIGhhc2hWYWx1ZSk7XG5cdFx0Ly8gRm9yIHB1cnBvc2Ugb2YgZGlmZmluZyBvbmx5IGNlbGxJZCBtYXR0ZXJzLCByZXN0IGRvIG5vdFxuXHRcdGhhc2hWYWx1ZSA9IGRvSGFzaCh0aGlzLmludGVybmFsTWV0YWRhdGE/LmludGVybmFsSWQgfHwgJycsIGhhc2hWYWx1ZSk7XG5cdFx0Zm9yIChjb25zdCBvcCBvZiB0aGlzLm91dHB1dHMpIHtcblx0XHRcdGhhc2hWYWx1ZSA9IGRvSGFzaChvcC5tZXRhZGF0YSwgaGFzaFZhbHVlKTtcblx0XHRcdGZvciAoY29uc3Qgb3V0cHV0IG9mIG9wLm91dHB1dHMpIHtcblx0XHRcdFx0aGFzaFZhbHVlID0gZG9IYXNoKG91dHB1dC5taW1lLCBoYXNoVmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGRpZ2VzdHMgPSB0aGlzLm91dHB1dHMuZmxhdE1hcChvcCA9PlxuXHRcdFx0b3Aub3V0cHV0cy5tYXAobyA9PiBoYXNoKEFycmF5LmZyb20oby5kYXRhLmJ1ZmZlcikpKVxuXHRcdCk7XG5cdFx0Zm9yIChjb25zdCBkaWdlc3Qgb2YgZGlnZXN0cykge1xuXHRcdFx0aGFzaFZhbHVlID0gbnVtYmVySGFzaChkaWdlc3QsIGhhc2hWYWx1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGhhc2hWYWx1ZTtcblx0fVxufVxuXG5jbGFzcyBNaXJyb3JOb3RlYm9va0RvY3VtZW50IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdXJpOiBVUkksXG5cdFx0cHVibGljIGNlbGxzOiBNaXJyb3JDZWxsW10sXG5cdFx0cHVibGljIG1ldGFkYXRhOiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEsXG5cdFx0cHVibGljIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IFRyYW5zaWVudERvY3VtZW50TWV0YWRhdGEsXG5cdCkge1xuXHR9XG5cblx0YWNjZXB0TW9kZWxDaGFuZ2VkKGV2ZW50OiBOb3RlYm9va0NlbGxzQ2hhbmdlZEV2ZW50RHRvKSB7XG5cdFx0Ly8gbm90ZSB0aGF0IHRoZSBjZWxsIGNvbnRlbnQgY2hhbmdlIGlzIG5vdCBhcHBsaWVkIHRvIHRoZSBNaXJyb3JDZWxsXG5cdFx0Ly8gYnV0IGl0J3MgZmluZSBhcyBpZiBhIGNlbGwgY29udGVudCBpcyBtb2RpZmllZCBhZnRlciB0aGUgZmlyc3QgZGlmZiwgaXRzIHBvc2l0aW9uIHdpbGwgbm90IGNoYW5nZSBhbnkgbW9yZVxuXHRcdC8vIFRPRE9AcmVib3JuaXgsIGJ1dCBpdCBtaWdodCBsZWFkIHRvIGludGVyZXN0aW5nIGJ1Z3MgaW4gdGhlIGZ1dHVyZS5cblx0XHRldmVudC5yYXdFdmVudHMuZm9yRWFjaChlID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMuX3NwbGljZU5vdGVib29rQ2VsbHMoZS5jaGFuZ2VzKTtcblx0XHRcdH0gZWxzZSBpZiAoZS5raW5kID09PSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb3ZlKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGxzID0gdGhpcy5jZWxscy5zcGxpY2UoZS5pbmRleCwgMSk7XG5cdFx0XHRcdHRoaXMuY2VsbHMuc3BsaWNlKGUubmV3SWR4LCAwLCAuLi5jZWxscyk7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuT3V0cHV0KSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmNlbGxzW2UuaW5kZXhdO1xuXHRcdFx0XHRjZWxsLm91dHB1dHMgPSBlLm91dHB1dHM7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbExhbmd1YWdlKSB7XG5cdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGUuaW5kZXgpO1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5jZWxsc1tlLmluZGV4XTtcblx0XHRcdFx0Y2VsbC5sYW5ndWFnZSA9IGUubGFuZ3VhZ2U7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbE1ldGFkYXRhKSB7XG5cdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGUuaW5kZXgpO1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5jZWxsc1tlLmluZGV4XTtcblx0XHRcdFx0Y2VsbC5tZXRhZGF0YSA9IGUubWV0YWRhdGE7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbEludGVybmFsTWV0YWRhdGEpIHtcblx0XHRcdFx0dGhpcy5fYXNzZXJ0SW5kZXgoZS5pbmRleCk7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmNlbGxzW2UuaW5kZXhdO1xuXHRcdFx0XHRjZWxsLmludGVybmFsTWV0YWRhdGEgPSBlLmludGVybmFsTWV0YWRhdGE7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlRG9jdW1lbnRNZXRhZGF0YSkge1xuXHRcdFx0XHR0aGlzLm1ldGFkYXRhID0gZS5tZXRhZGF0YTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2Fzc2VydEluZGV4KGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuY2VsbHMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgaW5kZXggJHtpbmRleH0uIENlbGxzIGxlbmd0aDogJHt0aGlzLmNlbGxzLmxlbmd0aH1gKTtcblx0XHR9XG5cdH1cblxuXHRfc3BsaWNlTm90ZWJvb2tDZWxscyhzcGxpY2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8SU1haW5DZWxsRHRvPltdKSB7XG5cdFx0c3BsaWNlcy5yZXZlcnNlKCkuZm9yRWFjaChzcGxpY2UgPT4ge1xuXHRcdFx0Y29uc3QgY2VsbER0b3MgPSBzcGxpY2VbMl07XG5cdFx0XHRjb25zdCBuZXdDZWxscyA9IGNlbGxEdG9zLm1hcChjZWxsID0+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNaXJyb3JDZWxsKFxuXHRcdFx0XHRcdGNlbGwuaGFuZGxlLFxuXHRcdFx0XHRcdFVSSS5wYXJzZShjZWxsLnVybCksXG5cdFx0XHRcdFx0Y2VsbC5zb3VyY2UsXG5cdFx0XHRcdFx0Y2VsbC5lb2wsXG5cdFx0XHRcdFx0Y2VsbC52ZXJzaW9uSWQsXG5cdFx0XHRcdFx0Y2VsbC5sYW5ndWFnZSxcblx0XHRcdFx0XHRjZWxsLmNlbGxLaW5kLFxuXHRcdFx0XHRcdGNlbGwub3V0cHV0cyxcblx0XHRcdFx0XHRjZWxsLm1ldGFkYXRhLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuY2VsbHMuc3BsaWNlKHNwbGljZVswXSwgc3BsaWNlWzFdLCAuLi5uZXdDZWxscyk7XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgQ2VsbFNlcXVlbmNlIGltcGxlbWVudHMgSVNlcXVlbmNlIHtcblxuXHRzdGF0aWMgY3JlYXRlKHRleHRNb2RlbDogTWlycm9yTm90ZWJvb2tEb2N1bWVudCkge1xuXHRcdGNvbnN0IGhhc2hWYWx1ZSA9IHRleHRNb2RlbC5jZWxscy5tYXAoYyA9PiBjLmdldENvbXBhcmlzb25WYWx1ZSgpKTtcblx0XHRyZXR1cm4gbmV3IENlbGxTZXF1ZW5jZShoYXNoVmFsdWUpO1xuXHR9XG5cdHN0YXRpYyBjcmVhdGVXaXRoQ2VsbElkKGNlbGxzOiBNaXJyb3JDZWxsW10sIGluY2x1ZGVDZWxsQ29udGVudHM/OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgaGFzaFZhbHVlID0gY2VsbHMubWFwKChjKSA9PiB7XG5cdFx0XHRpZiAoaW5jbHVkZUNlbGxDb250ZW50cykge1xuXHRcdFx0XHRyZXR1cm4gYCR7ZG9IYXNoKGMuaW50ZXJuYWxNZXRhZGF0YT8uaW50ZXJuYWxJZCwgbnVtYmVySGFzaCgxMDQ1NzksIDApKX0jJHtjLmdldENvbXBhcmlzb25WYWx1ZSgpfWA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gYCR7ZG9IYXNoKGMuaW50ZXJuYWxNZXRhZGF0YT8uaW50ZXJuYWxJZCwgbnVtYmVySGFzaCgxMDQ1NzksIDApKX19YDtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gbmV3IENlbGxTZXF1ZW5jZShoYXNoVmFsdWUpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocmVhZG9ubHkgaGFzaFZhbHVlOiBudW1iZXJbXSB8IHN0cmluZ1tdKSB7IH1cblxuXHRnZXRFbGVtZW50cygpOiBzdHJpbmdbXSB8IG51bWJlcltdIHwgSW50MzJBcnJheSB7XG5cdFx0cmV0dXJuIHRoaXMuaGFzaFZhbHVlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1dvcmtlciBpbXBsZW1lbnRzIElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciwgSURpc3Bvc2FibGUge1xuXHRfcmVxdWVzdEhhbmRsZXJCcmFuZDogYW55O1xuXG5cdHByaXZhdGUgX21vZGVsczogeyBbdXJpOiBzdHJpbmddOiBNaXJyb3JOb3RlYm9va0RvY3VtZW50IH07XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fbW9kZWxzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHR9XG5cblx0cHVibGljICRhY2NlcHROZXdNb2RlbCh1cmk6IHN0cmluZywgbWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YSwgdHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YTogVHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YSwgY2VsbHM6IElNYWluQ2VsbER0b1tdKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxzW3VyaV0gPSBuZXcgTWlycm9yTm90ZWJvb2tEb2N1bWVudChVUkkucGFyc2UodXJpKSwgY2VsbHMubWFwKGR0byA9PiBuZXcgTWlycm9yQ2VsbChcblx0XHRcdGR0by5oYW5kbGUsXG5cdFx0XHRVUkkucGFyc2UoZHRvLnVybCksXG5cdFx0XHRkdG8uc291cmNlLFxuXHRcdFx0ZHRvLmVvbCxcblx0XHRcdGR0by52ZXJzaW9uSWQsXG5cdFx0XHRkdG8ubGFuZ3VhZ2UsXG5cdFx0XHRkdG8uY2VsbEtpbmQsXG5cdFx0XHRkdG8ub3V0cHV0cyxcblx0XHRcdGR0by5tZXRhZGF0YSxcblx0XHRcdGR0by5pbnRlcm5hbE1ldGFkYXRhXG5cdFx0KSksIG1ldGFkYXRhLCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0TW9kZWxDaGFuZ2VkKHN0clVSTDogc3RyaW5nLCBldmVudDogTm90ZWJvb2tDZWxsc0NoYW5nZWRFdmVudER0bykge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWxzW3N0clVSTF07XG5cdFx0bW9kZWw/LmFjY2VwdE1vZGVsQ2hhbmdlZChldmVudCk7XG5cdH1cblxuXHRwdWJsaWMgJGFjY2VwdENlbGxNb2RlbENoYW5nZWQoc3RyVVJMOiBzdHJpbmcsIGhhbmRsZTogbnVtYmVyLCBldmVudDogSU1vZGVsQ2hhbmdlZEV2ZW50KSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbHNbc3RyVVJMXTtcblx0XHRtb2RlbC5jZWxscy5maW5kKGNlbGwgPT4gY2VsbC5oYW5kbGUgPT09IGhhbmRsZSk/Lm9uRXZlbnRzKGV2ZW50KTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0UmVtb3ZlZE1vZGVsKHN0clVSTDogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbHNbc3RyVVJMXSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkZWxldGUgdGhpcy5fbW9kZWxzW3N0clVSTF07XG5cdH1cblxuXHRhc3luYyAkY29tcHV0ZURpZmYob3JpZ2luYWxVcmw6IHN0cmluZywgbW9kaWZpZWRVcmw6IHN0cmluZyk6IFByb21pc2U8SU5vdGVib29rRGlmZlJlc3VsdD4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdGhpcy5fZ2V0TW9kZWwob3JpZ2luYWxVcmwpO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5fZ2V0TW9kZWwobW9kaWZpZWRVcmwpO1xuXG5cdFx0Y29uc3Qgb3JpZ2luYWxNb2RlbCA9IG5ldyBOb3RlYm9va1RleHRNb2RlbEZhY2FkZShvcmlnaW5hbCk7XG5cdFx0Y29uc3QgbW9kaWZpZWRNb2RlbCA9IG5ldyBOb3RlYm9va1RleHRNb2RlbEZhY2FkZShtb2RpZmllZCk7XG5cblx0XHRjb25zdCBvcmlnaW5hbE1ldGFkYXRhID0gZmlsdGVyKG9yaWdpbmFsLm1ldGFkYXRhLCBrZXkgPT4gIW9yaWdpbmFsLnRyYW5zaWVudERvY3VtZW50TWV0YWRhdGFba2V5XSk7XG5cdFx0Y29uc3QgbW9kaWZpZWRNZXRhZGF0YSA9IGZpbHRlcihtb2RpZmllZC5tZXRhZGF0YSwga2V5ID0+ICFtb2RpZmllZC50cmFuc2llbnREb2N1bWVudE1ldGFkYXRhW2tleV0pO1xuXHRcdGNvbnN0IG1ldGFkYXRhQ2hhbmdlZCA9IEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsTWV0YWRhdGEpICE9PSBKU09OLnN0cmluZ2lmeShtb2RpZmllZE1ldGFkYXRhKTtcblx0XHQvLyBUT0RPQERvbkpheWFtYW5uZVxuXHRcdC8vIEluIHRoZSBmdXR1cmUgd2UgbWlnaHQgd2FudCB0byBhdm9pZCBjb21wdXRpbmcgTENTIG9mIG91dHB1dHNcblx0XHQvLyBUaGF0IHdpbGwgbWFrZSB0aGlzIGZhc3Rlci5cblx0XHRjb25zdCBvcmlnaW5hbERpZmYgPSBuZXcgTGNzRGlmZihDZWxsU2VxdWVuY2UuY3JlYXRlKG9yaWdpbmFsKSwgQ2VsbFNlcXVlbmNlLmNyZWF0ZShtb2RpZmllZCkpLkNvbXB1dGVEaWZmKGZhbHNlKTtcblx0XHRpZiAob3JpZ2luYWxEaWZmLmNoYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtZXRhZGF0YUNoYW5nZWQsXG5cdFx0XHRcdGNlbGxzRGlmZjogb3JpZ2luYWxEaWZmXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgd2lsbCByZXR1cm4gdGhlIG1hcHBpbmcgb2YgdGhlIGNlbGxzIGFuZCB3aGF0IGNlbGxzIHdlcmUgaW5zZXJ0ZWQvZGVsZXRlZC5cblx0XHQvLyBXZSBkbyBub3QgY2FyZSBtdWNoIGFib3V0IGFjY3VyYWN5IG9mIHRoZSBkaWZmLCBidXQgY2FyZSBhYm91dCB0aGUgbWFwcGluZyBvZiB1bm1vZGlmaWVkIGNlbGxzLlxuXHRcdC8vIFRoYXQgY2FuIGJlIHVzZWQgYXMgYW5jaG9yIHBvaW50cyB0byBmaW5kIHRoZSBjZWxscyB0aGF0IGhhdmUgY2hhbmdlZC5cblx0XHQvLyBBbmQgb24gY2VsbHMgdGhhdCBoYXZlIGNoYW5nZWQsIHdlIGNhbiB1c2Ugc2ltaWxhcml0eSBhbGdvcml0aG1zIHRvIGZpbmQgdGhlIG1hcHBpbmcuXG5cdFx0Ly8gRWcgYXMgbWVudGlvbmVkIGVhcmxpZXIsIGl0cyBwb3NzaWJsZSBhZnRlciBzaW1pbGFyaXR5IGFsZ29yaXRobXMgd2UgZmluZCB0aGF0IGNlbGxzIHdlcmVuJ3QgaW5zZXJ0ZWQvZGVsZXRlZCBidXQgd2VyZSBqdXN0IG1vZGlmaWVkLlxuXHRcdGNvbnN0IGNlbGxNYXBwaW5nID0gY29tcHV0ZURpZmYob3JpZ2luYWxNb2RlbCwgbW9kaWZpZWRNb2RlbCwgeyBjZWxsc0RpZmY6IHsgY2hhbmdlczogb3JpZ2luYWxEaWZmLmNoYW5nZXMsIHF1aXRFYXJseTogZmFsc2UgfSwgbWV0YWRhdGFDaGFuZ2VkOiBmYWxzZSwgfSkuY2VsbERpZmZJbmZvO1xuXG5cdFx0Ly8gSWYgd2UgaGF2ZSBubyBpbnNlcnRpb25zL2RlbGV0aW9ucywgdGhlbiB0aGlzIGlzIGEgZ29vZCBkaWZmaW5nLlxuXHRcdGlmIChjZWxsTWFwcGluZy5ldmVyeShjID0+IGMudHlwZSA9PT0gJ21vZGlmaWVkJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1ldGFkYXRhQ2hhbmdlZCxcblx0XHRcdFx0Y2VsbHNEaWZmOiBvcmlnaW5hbERpZmZcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0bGV0IGRpZmZVc2luZ0NlbGxJZHMgPSB0aGlzLmNhbkNvbXB1dGVEaWZmV2l0aENlbGxJZHMob3JpZ2luYWwsIG1vZGlmaWVkKTtcblx0XHRpZiAoIWRpZmZVc2luZ0NlbGxJZHMpIHtcblx0XHRcdC8qKlxuXHRcdFx0ICogQXNzdW1lIHdlIGhhdmUgY2VsbHMgYXMgZm9sbG93c1xuXHRcdFx0ICogT3JpZ2luYWwgICBNb2RpZmllZFxuXHRcdFx0ICogQVx0ICBcdFx0QVxuXHRcdFx0ICogQlx0XHRcdEJcblx0XHRcdCAqIENcdFx0XHRlXG5cdFx0XHQgKiBEXHRcdFx0RlxuXHRcdFx0ICogRVxuXHRcdFx0ICogRlxuXHRcdFx0ICpcblx0XHRcdCAqIFVzaW5nIExDUyB3ZSBrbm93IGVhc2lseSB0aGF0IEEsIEIgY2VsbHMgbWF0Y2guXG5cdFx0XHQgKiBVc2luZyBMQ1MgaXQgd291bGQgbG9vayBsaWtlIEMgY2hhbmdlZCB0byBlXG5cdFx0XHQgKiBVc2luZyBMQ1MgRCAmIEUgd2VyZSByZW1vdmVkLlxuXHRcdFx0ICpcblx0XHRcdCAqIEEgaHVtYW4gd291bGQgYmUgYWJsZSB0byB0ZWxsIHRoYXQgY2VsbCBDLCBEIHdlcmUgcmVtb3ZlZC5cblx0XHRcdCAqIEEgaHVtYW4gY2FuIHRlbGwgdGhhdCBFIGNoYW5nZWQgdG8gZSBiZWNhdXNlIHRoZSBjb2RlIGluIHRoZSBjZWxscyBhcmUgdmVyeSBzaW1pbGFyLlxuXHRcdFx0ICogTm90ZSB0aGUgd29yZHMgYHNpbWlsYXJgLCBodW1hbnMgdHJ5IHRvIG1hdGNoIGNlbGxzIGJhc2VkIG9uIGNlcnRhaW4gaGV1cmlzdGljcy5cblx0XHRcdCAqICYgdGhlIG1vc3Qgb2J2aW91cyBvbmUgaXMgdGhlIHNpbWlsYXJpdHkgb2YgdGhlIGNvZGUgaW4gdGhlIGNlbGxzLlxuXHRcdFx0ICpcblx0XHRcdCAqIExDUyBoYXMgbm8gbm90aW9uIG9mIHNpbWlsYXJpdHksIGl0IG9ubHkga25vd3MgYWJvdXQgZXF1YWxpdHkuXG5cdFx0XHQgKiBXZSBjYW4gdXNlIG90aGVyIGFsZ29yaXRobXMgdG8gZmluZCBzaW1pbGFyaXR5LlxuXHRcdFx0ICogU28gaWYgd2UgZWxpbWluYXRlIEEsIEIsIHdlIGFyZSBsZWZ0IHdpdGggQywgRCwgRSwgRiBhbmQgd2UgbmVlZCB0byBmaW5kIHdoYXQgdGhleSBtYXAgdG8gaW4gYGUsIEZgIGluIG1vZGlmZWQgZG9jdW1lbnQuXG5cdFx0XHQgKiBXZSBjYW4gdXNlIGEgc2ltaWxhcml0eSBhbGdvcml0aG0gdG8gZmluZCB0aGF0LlxuXHRcdFx0ICpcblx0XHRcdCAqIFRoZSBwdXJwb3NlIG9mIHVzaW5nIExDUyBmaXJzdCBpcyB0byBmaW5kIHRoZSBjZWxscyB0aGF0IGhhdmUgbm90IGNoYW5nZWQuXG5cdFx0XHQgKiBUaGlzIGF2b2lkcyB0aGUgbmVlZCB0byB1c2Ugc2ltaWxhcml0eSBhbGdvcml0aG1zIG9uIGFsbCBjZWxscy5cblx0XHRcdCAqXG5cdFx0XHQgKiBBdCB0aGUgZW5kIG9mIHRoZSBkYXkgd2hhdCB3ZSBuZWVkIGlzIGFzIGZvbGxvd3Ncblx0XHRcdCAqIEEgPD0+IEFcblx0XHRcdCAqIEIgPD0+IEJcblx0XHRcdCAqIEMgPT4gRGVsZXRlZFxuXHRcdFx0ICogRCA9PiBEZWxldGVkXG5cdFx0XHQgKiBFID0+IGVcblx0XHRcdCAqIEYgPT4gRlxuXHRcdFx0ICovXG5cblxuXG5cdFx0XHQvLyBOb3RlLCBpZiBjZWxscyBhcmUgc3dhcHBlZCwgdGhlbiB0aGlzIGNvbXBpbGljYXRlcyB0aGluZ3Ncblx0XHRcdC8vIFRyeWluZyB0byBzb2x2ZSBkaWZmIG1hbnVhbGx5IGlzIG5vdCBlYXN5LlxuXHRcdFx0Ly8gTGV0cyBpbnN0ZWFkIHVzZSBMQ1MgZmluZCB0aGUgY2VsbHMgdGhhdCBoYXZlbid0IGNoYW5nZWQsXG5cdFx0XHQvLyAmIHRoZSBjZWxscyB0aGF0IGhhdmUuXG5cdFx0XHQvLyBGb3IgdGhlIHJhbmdlIG9mIGNlbGxzIHRoYXQgaGF2ZSBjaGFuZ2UsIGxldHMgc2VlIGlmIHdlIGNhbiBnZXQgYmV0dGVyIHJlc3VsdHMgdXNpbmcgc2ltaWxhcml0eSBhbGdvcml0aG1zLlxuXHRcdFx0Ly8gQXNzdW1lIHdlIGhhdmVcblx0XHRcdC8vIENvZGUgQ2VsbCA9IHByaW50KFwiSGVsbG8gV29ybGRcIilcblx0XHRcdC8vIENvZGUgQ2VsbCA9IHByaW50KFwiRm9vIEJhclwiKVxuXHRcdFx0Ly8gV2Ugbm93IGNoYW5nZSB0aGlzIHRvXG5cdFx0XHQvLyBNRCBDZWxsID0gIyBEZXNjcmlwdGlvblxuXHRcdFx0Ly8gQ29kZSBDZWxsID0gcHJpbnQoXCJIZWxsbyBXb3JsZFpcIilcblx0XHRcdC8vIENvZGUgQ2VsbCA9IHByaW50KFwiRm9vIEJhclpcIilcblx0XHRcdC8vIExDUyB3aWxsIHRlbGwgdXMgdGhhdCBldmVyeXRoaW5nIGNoYW5nZWQuXG5cdFx0XHQvLyBCdXQgdXNpbmcgc2ltaWxhcml0eSBhbGdvcml0aG1zIHdlIGNhbiB0ZWxsIHRoYXQgdGhlIGZpcnN0IGNlbGwgaXMgbmV3IGFuZCBsYXN0IDIgY2hhbmdlZC5cblxuXG5cblx0XHRcdC8vIExldHMgdHJ5IHRoZSBzaW1pbGFyaXR5IGFsZ29yaXRobXMgb24gYWxsIGNlbGxzLlxuXHRcdFx0Ly8gV2UgbWlnaHQgZmFyZSBiZXR0ZXIuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBtYXRjaENlbGxCYXNlZE9uU2ltaWxhcnRpZXMobW9kaWZpZWQuY2VsbHMsIG9yaWdpbmFsLmNlbGxzKTtcblx0XHRcdC8vIElmIHdlIGhhdmUgYXQgbGVhc3Qgb25lIG1hdGNoLCB0aGVuIGdyZWF0LlxuXHRcdFx0aWYgKHJlc3VsdC5zb21lKGMgPT4gYy5vcmlnaW5hbCAhPT0gLTEpKSB7XG5cdFx0XHRcdC8vIFdlIGhhdmUgbWFuYWdlZCB0byBmaW5kIHNpbWlsYXJpdGllcyBiZXR3ZWVuIGNlbGxzLlxuXHRcdFx0XHQvLyBOb3cgd2UgY2FuIGRlZmluaXRlbHkgZmluZCB3aGF0IGNlbGwgaXMgbmV3L3JlbW92ZWQuXG5cdFx0XHRcdHRoaXMudXBkYXRlQ2VsbElkc0Jhc2VkT25NYXBwaW5ncyhyZXN1bHQsIG9yaWdpbmFsLmNlbGxzLCBtb2RpZmllZC5jZWxscyk7XG5cdFx0XHRcdGRpZmZVc2luZ0NlbGxJZHMgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZGlmZlVzaW5nQ2VsbElkcykge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWV0YWRhdGFDaGFuZ2VkLFxuXHRcdFx0XHRjZWxsc0RpZmY6IG9yaWdpbmFsRGlmZlxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBBdCB0aGlzIHN0YWdlIHdlIGNhbiB1c2UgaW50ZXJuYWxNZXRhZGF0YS5jZWxsSWQgZm9yIHRyYWNraW5nIGNoYW5nZXMuXG5cdFx0Ly8gSS5lLiB3ZSBjb21wdXRlIExDUyBkaWZmIGFuZCB0aGUgaGFzaGVzIG9mIHNvbWUgY2VsbHMgZnJvbSBvcmlnaW5hbCB3aWxsIGJlIGVxdWFsIHRvIHRoYXQgaW4gbW9kaWZpZWQgYXMgd2UncmUgdXNpbmcgY2VsbElkLlxuXHRcdC8vIFRodXMgd2UgY2FuIGZpbmQgd2hhdCBjZWxscyBhcmUgbmV3L2RlbGV0ZWQuXG5cdFx0Ly8gQWZ0ZXIgdGhhdCB3ZSBjYW4gZmluZCB3aGV0aGVyIHRoZSBjb250ZW50cyBvZiB0aGUgY2VsbHMgY2hhbmdlZC5cblx0XHRjb25zdCBjZWxsc0luc2VydGVkT3JEZWxldGVkRGlmZiA9IG5ldyBMY3NEaWZmKENlbGxTZXF1ZW5jZS5jcmVhdGVXaXRoQ2VsbElkKG9yaWdpbmFsLmNlbGxzKSwgQ2VsbFNlcXVlbmNlLmNyZWF0ZVdpdGhDZWxsSWQobW9kaWZpZWQuY2VsbHMpKS5Db21wdXRlRGlmZihmYWxzZSk7XG5cdFx0Y29uc3QgY2VsbERpZmZJbmZvID0gY29tcHV0ZURpZmYob3JpZ2luYWxNb2RlbCwgbW9kaWZpZWRNb2RlbCwgeyBjZWxsc0RpZmY6IHsgY2hhbmdlczogY2VsbHNJbnNlcnRlZE9yRGVsZXRlZERpZmYuY2hhbmdlcywgcXVpdEVhcmx5OiBmYWxzZSB9LCBtZXRhZGF0YUNoYW5nZWQ6IGZhbHNlLCB9KS5jZWxsRGlmZkluZm87XG5cblx0XHRsZXQgcHJvY2Vzc2VkSW5kZXggPSAwO1xuXHRcdGNvbnN0IGNoYW5nZXM6IElEaWZmQ2hhbmdlW10gPSBbXTtcblx0XHRjZWxsc0luc2VydGVkT3JEZWxldGVkRGlmZi5jaGFuZ2VzLmZvckVhY2goY2hhbmdlID0+IHtcblx0XHRcdGlmICghY2hhbmdlLm9yaWdpbmFsTGVuZ3RoICYmIGNoYW5nZS5tb2RpZmllZExlbmd0aCkge1xuXHRcdFx0XHQvLyBJbnNlcnRlZC5cblx0XHRcdFx0Ly8gRmluZCBhbGwgbW9kaWZpZWQgY2VsbHMgYmVmb3JlIHRoaXMuXG5cdFx0XHRcdGNvbnN0IGNoYW5nZUluZGV4ID0gY2VsbERpZmZJbmZvLmZpbmRJbmRleChjID0+IGMudHlwZSA9PT0gJ2luc2VydCcgJiYgYy5tb2RpZmllZENlbGxJbmRleCA9PT0gY2hhbmdlLm1vZGlmaWVkU3RhcnQpO1xuXHRcdFx0XHRjZWxsRGlmZkluZm8uc2xpY2UocHJvY2Vzc2VkSW5kZXgsIGNoYW5nZUluZGV4KS5mb3JFYWNoKGMgPT4ge1xuXHRcdFx0XHRcdGlmIChjLnR5cGUgPT09ICd1bmNoYW5nZWQnIHx8IGMudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDZWxsID0gb3JpZ2luYWwuY2VsbHNbYy5vcmlnaW5hbENlbGxJbmRleF07XG5cdFx0XHRcdFx0XHRjb25zdCBtb2RpZmllZENlbGwgPSBtb2RpZmllZC5jZWxsc1tjLm1vZGlmaWVkQ2VsbEluZGV4XTtcblx0XHRcdFx0XHRcdGNvbnN0IGNoYW5nZWQgPSBjLnR5cGUgPT09ICdtb2RpZmllZCcgfHwgb3JpZ2luYWxDZWxsLmdldENvbXBhcmlzb25WYWx1ZSgpICE9PSBtb2RpZmllZENlbGwuZ2V0Q29tcGFyaXNvblZhbHVlKCk7XG5cdFx0XHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0XHRjaGFuZ2VzLnB1c2gobmV3IERpZmZDaGFuZ2UoYy5vcmlnaW5hbENlbGxJbmRleCwgMSwgYy5tb2RpZmllZENlbGxJbmRleCwgMSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuXHRcdFx0XHRwcm9jZXNzZWRJbmRleCA9IGNoYW5nZUluZGV4ICsgMTtcblx0XHRcdH0gZWxzZSBpZiAoY2hhbmdlLm9yaWdpbmFsTGVuZ3RoICYmICFjaGFuZ2UubW9kaWZpZWRMZW5ndGgpIHtcblx0XHRcdFx0Ly8gRGVsZXRlZC5cblx0XHRcdFx0Ly8gRmluZCBhbGwgbW9kaWZpZWQgY2VsbHMgYmVmb3JlIHRoaXMuXG5cdFx0XHRcdGNvbnN0IGNoYW5nZUluZGV4ID0gY2VsbERpZmZJbmZvLmZpbmRJbmRleChjID0+IGMudHlwZSA9PT0gJ2RlbGV0ZScgJiYgYy5vcmlnaW5hbENlbGxJbmRleCA9PT0gY2hhbmdlLm9yaWdpbmFsU3RhcnQpO1xuXHRcdFx0XHRjZWxsRGlmZkluZm8uc2xpY2UocHJvY2Vzc2VkSW5kZXgsIGNoYW5nZUluZGV4KS5mb3JFYWNoKGMgPT4ge1xuXHRcdFx0XHRcdGlmIChjLnR5cGUgPT09ICd1bmNoYW5nZWQnIHx8IGMudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDZWxsID0gb3JpZ2luYWwuY2VsbHNbYy5vcmlnaW5hbENlbGxJbmRleF07XG5cdFx0XHRcdFx0XHRjb25zdCBtb2RpZmllZENlbGwgPSBtb2RpZmllZC5jZWxsc1tjLm1vZGlmaWVkQ2VsbEluZGV4XTtcblx0XHRcdFx0XHRcdGNvbnN0IGNoYW5nZWQgPSBjLnR5cGUgPT09ICdtb2RpZmllZCcgfHwgb3JpZ2luYWxDZWxsLmdldENvbXBhcmlzb25WYWx1ZSgpICE9PSBtb2RpZmllZENlbGwuZ2V0Q29tcGFyaXNvblZhbHVlKCk7XG5cdFx0XHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0XHRjaGFuZ2VzLnB1c2gobmV3IERpZmZDaGFuZ2UoYy5vcmlnaW5hbENlbGxJbmRleCwgMSwgYy5tb2RpZmllZENlbGxJbmRleCwgMSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuXHRcdFx0XHRwcm9jZXNzZWRJbmRleCA9IGNoYW5nZUluZGV4ICsgMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRoaXMgY291bGQgYmUgYSBzaXR1YXRpb24gd2hlcmUgYSBjZWxsIGhhcyBiZWVuIGRlbGV0ZWQgb24gbGVmdCBhbmQgaW5zZXJ0ZWQgb24gdGhlIHJpZ2h0LlxuXHRcdFx0XHQvLyBFLmcuIG1hcmtkb3duIGNlbGwgZGVsZXRlZCBhbmQgY29kZSBjZWxsIGluc2VydGVkLlxuXHRcdFx0XHQvLyBCdXQgTENTIHNob3dzIHRoZW0gYXMgYSBtb2RpZmljYXRpb24uXG5cdFx0XHRcdGNvbnN0IGNoYW5nZUluZGV4ID0gY2VsbERpZmZJbmZvLmZpbmRJbmRleChjID0+IChjLnR5cGUgPT09ICdkZWxldGUnICYmIGMub3JpZ2luYWxDZWxsSW5kZXggPT09IGNoYW5nZS5vcmlnaW5hbFN0YXJ0KSB8fCAoYy50eXBlID09PSAnaW5zZXJ0JyAmJiBjLm1vZGlmaWVkQ2VsbEluZGV4ID09PSBjaGFuZ2UubW9kaWZpZWRTdGFydCkpO1xuXHRcdFx0XHRjZWxsRGlmZkluZm8uc2xpY2UocHJvY2Vzc2VkSW5kZXgsIGNoYW5nZUluZGV4KS5mb3JFYWNoKGMgPT4ge1xuXHRcdFx0XHRcdGlmIChjLnR5cGUgPT09ICd1bmNoYW5nZWQnIHx8IGMudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDZWxsID0gb3JpZ2luYWwuY2VsbHNbYy5vcmlnaW5hbENlbGxJbmRleF07XG5cdFx0XHRcdFx0XHRjb25zdCBtb2RpZmllZENlbGwgPSBtb2RpZmllZC5jZWxsc1tjLm1vZGlmaWVkQ2VsbEluZGV4XTtcblx0XHRcdFx0XHRcdGNvbnN0IGNoYW5nZWQgPSBjLnR5cGUgPT09ICdtb2RpZmllZCcgfHwgb3JpZ2luYWxDZWxsLmdldENvbXBhcmlzb25WYWx1ZSgpICE9PSBtb2RpZmllZENlbGwuZ2V0Q29tcGFyaXNvblZhbHVlKCk7XG5cdFx0XHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0XHRjaGFuZ2VzLnB1c2gobmV3IERpZmZDaGFuZ2UoYy5vcmlnaW5hbENlbGxJbmRleCwgMSwgYy5tb2RpZmllZENlbGxJbmRleCwgMSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuXHRcdFx0XHRwcm9jZXNzZWRJbmRleCA9IGNoYW5nZUluZGV4ICsgMTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRjZWxsRGlmZkluZm8uc2xpY2UocHJvY2Vzc2VkSW5kZXgpLmZvckVhY2goYyA9PiB7XG5cdFx0XHRpZiAoYy50eXBlID09PSAndW5jaGFuZ2VkJyB8fCBjLnR5cGUgPT09ICdtb2RpZmllZCcpIHtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDZWxsID0gb3JpZ2luYWwuY2VsbHNbYy5vcmlnaW5hbENlbGxJbmRleF07XG5cdFx0XHRcdGNvbnN0IG1vZGlmaWVkQ2VsbCA9IG1vZGlmaWVkLmNlbGxzW2MubW9kaWZpZWRDZWxsSW5kZXhdO1xuXHRcdFx0XHRjb25zdCBjaGFuZ2VkID0gYy50eXBlID09PSAnbW9kaWZpZWQnIHx8IG9yaWdpbmFsQ2VsbC5nZXRDb21wYXJpc29uVmFsdWUoKSAhPT0gbW9kaWZpZWRDZWxsLmdldENvbXBhcmlzb25WYWx1ZSgpO1xuXHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdGNoYW5nZXMucHVzaChuZXcgRGlmZkNoYW5nZShjLm9yaWdpbmFsQ2VsbEluZGV4LCAxLCBjLm1vZGlmaWVkQ2VsbEluZGV4LCAxKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRtZXRhZGF0YUNoYW5nZWQsXG5cdFx0XHRjZWxsc0RpZmY6IHtcblx0XHRcdFx0Y2hhbmdlcyxcblx0XHRcdFx0cXVpdEVhcmx5OiBmYWxzZVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRjYW5Db21wdXRlRGlmZldpdGhDZWxsSWRzKG9yaWdpbmFsOiBNaXJyb3JOb3RlYm9va0RvY3VtZW50LCBtb2RpZmllZDogTWlycm9yTm90ZWJvb2tEb2N1bWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNhbkNvbXB1dGVEaWZmV2l0aENlbGxJbnRlcm5hbElkcyhvcmlnaW5hbCwgbW9kaWZpZWQpIHx8IHRoaXMuY2FuQ29tcHV0ZURpZmZXaXRoQ2VsbE1ldGFkYXRhSWRzKG9yaWdpbmFsLCBtb2RpZmllZCk7XG5cdH1cblxuXHRjYW5Db21wdXRlRGlmZldpdGhDZWxsSW50ZXJuYWxJZHMob3JpZ2luYWw6IE1pcnJvck5vdGVib29rRG9jdW1lbnQsIG1vZGlmaWVkOiBNaXJyb3JOb3RlYm9va0RvY3VtZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxDZWxsSW5kZXhJZHMgPSBvcmlnaW5hbC5jZWxscy5tYXAoKGNlbGwsIGluZGV4KSA9PiAoeyBpbmRleCwgaWQ6IChjZWxsLmludGVybmFsTWV0YWRhdGE/LmludGVybmFsSWQgfHwgJycpIGFzIHN0cmluZyB9KSk7XG5cdFx0Y29uc3QgbW9kaWZpZWRDZWxsSW5kZXhJZHMgPSBtb2RpZmllZC5jZWxscy5tYXAoKGNlbGwsIGluZGV4KSA9PiAoeyBpbmRleCwgaWQ6IChjZWxsLmludGVybmFsTWV0YWRhdGE/LmludGVybmFsSWQgfHwgJycpIGFzIHN0cmluZyB9KSk7XG5cdFx0Ly8gSWYgd2UgaGF2ZSBhIGNlbGwgd2l0aG91dCBhbiBpZCwgZG8gbm90IHVzZSBtZXRhZGF0YS5pZCBmb3IgZGlmZmluZy5cblx0XHRpZiAob3JpZ2luYWxDZWxsSW5kZXhJZHMuc29tZShjID0+ICFjLmlkKSB8fCBtb2RpZmllZENlbGxJbmRleElkcy5zb21lKGMgPT4gIWMuaWQpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIElmIG5vbmUgb2YgdGhlIGlkcyBpbiBvcmlnaW5hbCBjYW4gYmUgZm91bmQgaW4gbW9kaWZpZWQsIHRoZW4gd2UgY2FuJ3QgdXNlIG1ldGFkYXRhLmlkIGZvciBkaWZmaW5nLlxuXHRcdC8vIEkuZS4gZXZlcnl0aGluZyBpcyBuZXcsIG5vIHBvaW50IHRyeWluZy5cblx0XHRyZXR1cm4gb3JpZ2luYWxDZWxsSW5kZXhJZHMuc29tZShjID0+IG1vZGlmaWVkQ2VsbEluZGV4SWRzLmZpbmQobSA9PiBtLmlkID09PSBjLmlkKSk7XG5cdH1cblxuXHRjYW5Db21wdXRlRGlmZldpdGhDZWxsTWV0YWRhdGFJZHMob3JpZ2luYWw6IE1pcnJvck5vdGVib29rRG9jdW1lbnQsIG1vZGlmaWVkOiBNaXJyb3JOb3RlYm9va0RvY3VtZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxDZWxsSW5kZXhJZHMgPSBvcmlnaW5hbC5jZWxscy5tYXAoKGNlbGwsIGluZGV4KSA9PiAoeyBpbmRleCwgaWQ6IChjZWxsLm1ldGFkYXRhPy5pZCB8fCAnJykgYXMgc3RyaW5nIH0pKTtcblx0XHRjb25zdCBtb2RpZmllZENlbGxJbmRleElkcyA9IG1vZGlmaWVkLmNlbGxzLm1hcCgoY2VsbCwgaW5kZXgpID0+ICh7IGluZGV4LCBpZDogKGNlbGwubWV0YWRhdGE/LmlkIHx8ICcnKSBhcyBzdHJpbmcgfSkpO1xuXHRcdC8vIElmIHdlIGhhdmUgYSBjZWxsIHdpdGhvdXQgYW4gaWQsIGRvIG5vdCB1c2UgbWV0YWRhdGEuaWQgZm9yIGRpZmZpbmcuXG5cdFx0aWYgKG9yaWdpbmFsQ2VsbEluZGV4SWRzLnNvbWUoYyA9PiAhYy5pZCkgfHwgbW9kaWZpZWRDZWxsSW5kZXhJZHMuc29tZShjID0+ICFjLmlkKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHQvLyBJZiBub25lIG9mIHRoZSBpZHMgaW4gb3JpZ2luYWwgY2FuIGJlIGZvdW5kIGluIG1vZGlmaWVkLCB0aGVuIHdlIGNhbid0IHVzZSBtZXRhZGF0YS5pZCBmb3IgZGlmZmluZy5cblx0XHQvLyBJLmUuIGV2ZXJ5dGhpbmcgaXMgbmV3LCBubyBwb2ludCB0cnlpbmcuXG5cdFx0aWYgKG9yaWdpbmFsQ2VsbEluZGV4SWRzLmV2ZXJ5KGMgPT4gIW1vZGlmaWVkQ2VsbEluZGV4SWRzLmZpbmQobSA9PiBtLmlkID09PSBjLmlkKSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJbnRlcm5hbGx5IHdlIHVzZSBpbnRlcm5hbE1ldGFkYXRhLmNlbGxJZCBmb3IgZGlmZmluZywgaGVuY2UgdXBkYXRlIHRoZSBpbnRlcm5hbE1ldGFkYXRhLmNlbGxJZFxuXHRcdG9yaWdpbmFsLmNlbGxzLm1hcCgoY2VsbCwgaW5kZXgpID0+IHtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YSA9IGNlbGwuaW50ZXJuYWxNZXRhZGF0YSB8fCB7fTtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5pbnRlcm5hbElkID0gY2VsbC5tZXRhZGF0YT8uaWQgYXMgc3RyaW5nIHx8ICcnO1xuXHRcdH0pO1xuXHRcdG1vZGlmaWVkLmNlbGxzLm1hcCgoY2VsbCwgaW5kZXgpID0+IHtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YSA9IGNlbGwuaW50ZXJuYWxNZXRhZGF0YSB8fCB7fTtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5pbnRlcm5hbElkID0gY2VsbC5tZXRhZGF0YT8uaWQgYXMgc3RyaW5nIHx8ICcnO1xuXHRcdH0pO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblxuXHRpc09yaWdpbmFsQ2VsbE1hdGNoZWRXaXRoTW9kaWZpZWRDZWxsKG9yaWdpbmFsQ2VsbDogTWlycm9yQ2VsbCkge1xuXHRcdHJldHVybiAob3JpZ2luYWxDZWxsLmludGVybmFsTWV0YWRhdGE/LmludGVybmFsSWQgYXMgc3RyaW5nIHx8ICcnKS5zdGFydHNXaXRoKFBSRUZJWF9GT1JfVU5NQVRDSEVEX09SSUdJTkFMX0NFTExTKTtcblx0fVxuXHR1cGRhdGVDZWxsSWRzQmFzZWRPbk1hcHBpbmdzKG1hcHBpbmdzOiB7IG1vZGlmaWVkOiBudW1iZXI7IG9yaWdpbmFsOiBudW1iZXIgfVtdLCBvcmlnaW5hbENlbGxzOiBNaXJyb3JDZWxsW10sIG1vZGlmaWVkQ2VsbHM6IE1pcnJvckNlbGxbXSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHV1aWRzID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZz4oKTtcblx0XHRvcmlnaW5hbENlbGxzLm1hcCgoY2VsbCwgaW5kZXgpID0+IHtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YSA9IGNlbGwuaW50ZXJuYWxNZXRhZGF0YSB8fCB7IGludGVybmFsSWQ6ICcnIH07XG5cdFx0XHRjZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZCA9IGAke1BSRUZJWF9GT1JfVU5NQVRDSEVEX09SSUdJTkFMX0NFTExTfSR7Z2VuZXJhdGVVdWlkKCl9YDtcblx0XHRcdGNvbnN0IGZvdW5kID0gbWFwcGluZ3MuZmluZChyID0+IHIub3JpZ2luYWwgPT09IGluZGV4KTtcblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHQvLyBEbyBub3QgdXNlIHRoZSBpbmRleGVzIGFzIGlkcy5cblx0XHRcdFx0Ly8gSWYgd2UgZG8sIHRoZW4gdGhlIGhhc2hlcyB3aWxsIGJlIHZlcnkgc2ltaWxhciBleGNlcHQgZm9yIGxhc3QgZGlnaXQuXG5cdFx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5pbnRlcm5hbElkID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0XHRcdHV1aWRzLnNldChmb3VuZC5tb2RpZmllZCwgY2VsbC5pbnRlcm5hbE1ldGFkYXRhLmludGVybmFsSWQgYXMgc3RyaW5nKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRtb2RpZmllZENlbGxzLm1hcCgoY2VsbCwgaW5kZXgpID0+IHtcblx0XHRcdGNlbGwuaW50ZXJuYWxNZXRhZGF0YSA9IGNlbGwuaW50ZXJuYWxNZXRhZGF0YSB8fCB7IGludGVybmFsSWQ6ICcnIH07XG5cdFx0XHRjZWxsLmludGVybmFsTWV0YWRhdGEuaW50ZXJuYWxJZCA9IHV1aWRzLmdldChpbmRleCkgPz8gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQkY2FuUHJvbXB0UmVjb21tZW5kYXRpb24obW9kZWxVcmw6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZ2V0TW9kZWwobW9kZWxVcmwpO1xuXHRcdGNvbnN0IGNlbGxzID0gbW9kZWwuY2VsbHM7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNlbGxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBjZWxsID0gY2VsbHNbaV07XG5cdFx0XHRpZiAoY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2VsbC5sYW5ndWFnZSAhPT0gJ3B5dGhvbicpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNlYXJjaFBhcmFtcyA9IG5ldyBTZWFyY2hQYXJhbXMoJ2ltcG9ydFxcXFxzKnBhbmRhc3xmcm9tXFxcXHMqcGFuZGFzJywgdHJ1ZSwgZmFsc2UsIG51bGwpO1xuXHRcdFx0Y29uc3Qgc2VhcmNoRGF0YSA9IHNlYXJjaFBhcmFtcy5wYXJzZVNlYXJjaFJlcXVlc3QoKTtcblxuXHRcdFx0aWYgKCFzZWFyY2hEYXRhKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBidWlsZGVyID0gbmV3IFBpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyKCk7XG5cdFx0XHRidWlsZGVyLmFjY2VwdENodW5rKGNlbGwuZ2V0VmFsdWUoKSk7XG5cdFx0XHRjb25zdCBidWZmZXJGYWN0b3J5ID0gYnVpbGRlci5maW5pc2godHJ1ZSk7XG5cdFx0XHRjb25zdCB0ZXh0QnVmZmVyID0gYnVmZmVyRmFjdG9yeS5jcmVhdGUoY2VsbC5lb2wpLnRleHRCdWZmZXI7XG5cblx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IHRleHRCdWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHRjb25zdCBtYXhMaW5lQ291bnQgPSBNYXRoLm1pbihsaW5lQ291bnQsIDIwKTtcblx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKDEsIDEsIG1heExpbmVDb3VudCwgdGV4dEJ1ZmZlci5nZXRMaW5lTGVuZ3RoKG1heExpbmVDb3VudCkgKyAxKTtcblx0XHRcdGNvbnN0IGNlbGxNYXRjaGVzID0gdGV4dEJ1ZmZlci5maW5kTWF0Y2hlc0xpbmVCeUxpbmUocmFuZ2UsIHNlYXJjaERhdGEsIHRydWUsIDEpO1xuXHRcdFx0aWYgKGNlbGxNYXRjaGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRNb2RlbCh1cmk6IHN0cmluZyk6IE1pcnJvck5vdGVib29rRG9jdW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbHNbdXJpXTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlKCk6IElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB7XG5cdHJldHVybiBuZXcgTm90ZWJvb2tXb3JrZXIoKTtcbn1cblxuZXhwb3J0IHR5cGUgQ2VsbERpZmZJbmZvID0ge1xuXHRvcmlnaW5hbENlbGxJbmRleDogbnVtYmVyO1xuXHRtb2RpZmllZENlbGxJbmRleDogbnVtYmVyO1xuXHR0eXBlOiAndW5jaGFuZ2VkJyB8ICdtb2RpZmllZCc7XG59IHxcbntcblx0b3JpZ2luYWxDZWxsSW5kZXg6IG51bWJlcjtcblx0dHlwZTogJ2RlbGV0ZSc7XG59IHxcbntcblx0bW9kaWZpZWRDZWxsSW5kZXg6IG51bWJlcjtcblx0dHlwZTogJ2luc2VydCc7XG59O1xuXG5pbnRlcmZhY2UgSUNlbGwge1xuXHRjZWxsS2luZDogQ2VsbEtpbmQ7XG5cdGdldEhhc2hWYWx1ZSgpOiBudW1iZXI7XG5cdGVxdWFsKGNlbGw6IElDZWxsKTogYm9vbGVhbjtcbn1cblxuY2xhc3MgTm90ZWJvb2tUZXh0TW9kZWxGYWNhZGUge1xuXHRwdWJsaWMgcmVhZG9ubHkgY2VsbHM6IHJlYWRvbmx5IElDZWxsW107XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5vdGVib29rOiBNaXJyb3JOb3RlYm9va0RvY3VtZW50XG5cdCkge1xuXG5cdFx0dGhpcy5jZWxscyA9IG5vdGVib29rLmNlbGxzLm1hcChjZWxsID0+IG5ldyBOb3RlYm9va0NlbGxUZXh0TW9kZWxGYWNhZGUoY2VsbCkpO1xuXHR9XG5cbn1cbmNsYXNzIE5vdGVib29rQ2VsbFRleHRNb2RlbEZhY2FkZSBpbXBsZW1lbnRzIElDZWxsIHtcblx0Z2V0IGNlbGxLaW5kKCk6IENlbGxLaW5kIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsLmNlbGxLaW5kO1xuXHR9XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY2VsbDogTWlycm9yQ2VsbFxuXHQpIHtcblx0fVxuXHRnZXRIYXNoVmFsdWUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsLmdldENvbXBhcmlzb25WYWx1ZSgpO1xuXHR9XG5cdGVxdWFsKGNlbGw6IElDZWxsKTogYm9vbGVhbiB7XG5cdFx0aWYgKGNlbGwuY2VsbEtpbmQgIT09IHRoaXMuY2VsbEtpbmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0SGFzaFZhbHVlKCkgPT09IGNlbGwuZ2V0SGFzaFZhbHVlKCk7XG5cdH1cblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsU0FBaUMsZUFBZTtBQUNoRCxTQUFTLFFBQVEsTUFBTSxrQkFBa0I7QUFFekMsU0FBUyxXQUFXO0FBRXBCLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsVUFBMkksK0JBQWlIO0FBQ3JRLFNBQVMsYUFBYTtBQUN0QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUI7QUFFNUIsTUFBTSxzQ0FBc0M7QUFFNUMsTUFBTSxXQUFXO0FBQUEs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
