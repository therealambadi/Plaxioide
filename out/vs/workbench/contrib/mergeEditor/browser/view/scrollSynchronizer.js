import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorunWithStore } from "../../../../../base/common/observable.js";
import { ScrollType } from "../../../../../editor/common/editorCommon.js";
import { DocumentLineRangeMap } from "../model/mapping.js";
import { ReentrancyBarrier } from "../../../../../base/common/controlFlow.js";
class ScrollSynchronizer extends Disposable {
  constructor(viewModel, input1View, input2View, baseView, inputResultView, layout) {
    super();
    this.viewModel = viewModel;
    this.input1View = input1View;
    this.input2View = input2View;
    this.baseView = baseView;
    this.inputResultView = inputResultView;
    this.layout = layout;
    this.reentrancyBarrier = new ReentrancyBarrier();
    const handleInput1OnScroll = this.updateScrolling = () => {
      if (!this.model) {
        return;
      }
      this.input2View.editor.setScrollTop(this.input1View.editor.getScrollTop(), ScrollType.Immediate);
      if (this.shouldAlignResult) {
        this.inputResultView.editor.setScrollTop(this.input1View.editor.getScrollTop(), ScrollType.Immediate);
      } else {
        const mappingInput1Result = this.model.input1ResultMapping.get();
        this.synchronizeScrolling(this.input1View.editor, this.inputResultView.editor, mappingInput1Result);
      }
      const baseView2 = this.baseView.get();
      if (baseView2) {
        if (this.shouldAlignBase) {
          this.baseView.get()?.editor.setScrollTop(this.input1View.editor.getScrollTop(), ScrollType.Immediate);
        } else {
          const mapping = new DocumentLineRangeMap(this.model.baseInput1Diffs.get(), -1).reverse();
          this.synchronizeScrolling(this.input1View.editor, baseView2.editor, mapping);
        }
      }
    };
    this._store.add(
      this.input1View.editor.onDidScrollChange(
        this.reentrancyBarrier.makeExclusiveOrSkip((c) => {
          if (c.scrollTopChanged) {
            handleInput1OnScroll();
          }
          if (c.scrollLeftChanged) {
            this.baseView.get()?.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.input2View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.inputResultView.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
          }
        })
      )
    );
    this._store.add(
      this.input2View.editor.onDidScrollChange(
        this.reentrancyBarrier.makeExclusiveOrSkip((c) => {
          if (!this.model) {
            return;
          }
          if (c.scrollTopChanged) {
            this.input1View.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
            if (this.shouldAlignResult) {
              this.inputResultView.editor.setScrollTop(this.input2View.editor.getScrollTop(), ScrollType.Immediate);
            } else {
              const mappingInput2Result = this.model.input2ResultMapping.get();
              this.synchronizeScrolling(this.input2View.editor, this.inputResultView.editor, mappingInput2Result);
            }
            const baseView2 = this.baseView.get();
            if (baseView2 && this.model) {
              if (this.shouldAlignBase) {
                this.baseView.get()?.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
              } else {
                const mapping = new DocumentLineRangeMap(this.model.baseInput2Diffs.get(), -1).reverse();
                this.synchronizeScrolling(this.input2View.editor, baseView2.editor, mapping);
              }
            }
          }
          if (c.scrollLeftChanged) {
            this.baseView.get()?.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.input1View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.inputResultView.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
          }
        })
      )
    );
    this._store.add(
      this.inputResultView.editor.onDidScrollChange(
        this.reentrancyBarrier.makeExclusiveOrSkip((c) => {
          if (c.scrollTopChanged) {
            if (this.shouldAlignResult) {
              this.input1View.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
              this.input2View.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
            } else {
              const mapping1 = this.model?.resultInput1Mapping.get();
              this.synchronizeScrolling(this.inputResultView.editor, this.input1View.editor, mapping1);
              const mapping2 = this.model?.resultInput2Mapping.get();
              this.synchronizeScrolling(this.inputResultView.editor, this.input2View.editor, mapping2);
            }
            const baseMapping = this.model?.resultBaseMapping.get();
            const baseView2 = this.baseView.get();
            if (baseView2 && this.model) {
              this.synchronizeScrolling(this.inputResultView.editor, baseView2.editor, baseMapping);
            }
          }
          if (c.scrollLeftChanged) {
            this.baseView.get()?.editor?.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.input1View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
            this.input2View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
          }
        })
      )
    );
    this._store.add(
      autorunWithStore((reader, store) => {
        const baseView2 = this.baseView.read(reader);
        if (baseView2) {
          store.add(baseView2.editor.onDidScrollChange(
            this.reentrancyBarrier.makeExclusiveOrSkip((c) => {
              if (c.scrollTopChanged) {
                if (!this.model) {
                  return;
                }
                if (this.shouldAlignBase) {
                  this.input1View.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
                  this.input2View.editor.setScrollTop(c.scrollTop, ScrollType.Immediate);
                } else {
                  const baseInput1Mapping = new DocumentLineRangeMap(this.model.baseInput1Diffs.get(), -1);
                  this.synchronizeScrolling(baseView2.editor, this.input1View.editor, baseInput1Mapping);
                  const baseInput2Mapping = new DocumentLineRangeMap(this.model.baseInput2Diffs.get(), -1);
                  this.synchronizeScrolling(baseView2.editor, this.input2View.editor, baseInput2Mapping);
                }
                const baseMapping = this.model?.baseResultMapping.get();
                this.synchronizeScrolling(baseView2.editor, this.inputResultView.editor, baseMapping);
              }
              if (c.scrollLeftChanged) {
                this.inputResultView.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
                this.input1View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
                this.input2View.editor.setScrollLeft(c.scrollLeft, ScrollType.Immediate);
              }
            })
          ));
        }
      })
    );
  }
  get model() {
    return this.viewModel.get()?.model;
  }
  get shouldAlignResult() {
    return this.layout.get().kind === "columns";
  }
  get shouldAlignBase() {
    return this.layout.get().kind === "mixed" && !this.layout.get().showBaseAtTop;
  }
  synchronizeScrolling(scrollingEditor, targetEditor, mapping) {
    if (!mapping) {
      return;
    }
    const visibleRanges = scrollingEditor.getVisibleRanges();
    if (visibleRanges.length === 0) {
      return;
    }
    const topLineNumber = visibleRanges[0].startLineNumber - 1;
    const result = mapping.project(topLineNumber);
    const sourceRange = result.inputRange;
    const targetRange = result.outputRange;
    const resultStartTopPx = targetEditor.getTopForLineNumber(targetRange.startLineNumber);
    const resultEndPx = targetEditor.getTopForLineNumber(targetRange.endLineNumberExclusive);
    const sourceStartTopPx = scrollingEditor.getTopForLineNumber(sourceRange.startLineNumber);
    const sourceEndPx = scrollingEditor.getTopForLineNumber(sourceRange.endLineNumberExclusive);
    const factor = Math.min((scrollingEditor.getScrollTop() - sourceStartTopPx) / (sourceEndPx - sourceStartTopPx), 1);
    const resultScrollPosition = resultStartTopPx + (resultEndPx - resultStartTopPx) * factor;
    targetEditor.setScrollTop(resultScrollPosition, ScrollType.Immediate);
  }
}
export {
  ScrollSynchronizer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvc2Nyb2xsU3luY2hyb25pemVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuV2l0aFN0b3JlLCBJT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IERvY3VtZW50TGluZVJhbmdlTWFwIH0gZnJvbSAnLi4vbW9kZWwvbWFwcGluZy5qcyc7XG5pbXBvcnQgeyBSZWVudHJhbmN5QmFycmllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbnRyb2xGbG93LmpzJztcbmltcG9ydCB7IEJhc2VDb2RlRWRpdG9yVmlldyB9IGZyb20gJy4vZWRpdG9ycy9iYXNlQ29kZUVkaXRvclZpZXcuanMnO1xuaW1wb3J0IHsgSU1lcmdlRWRpdG9yTGF5b3V0IH0gZnJvbSAnLi9tZXJnZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBNZXJnZUVkaXRvclZpZXdNb2RlbCB9IGZyb20gJy4vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IElucHV0Q29kZUVkaXRvclZpZXcgfSBmcm9tICcuL2VkaXRvcnMvaW5wdXRDb2RlRWRpdG9yVmlldy5qcyc7XG5pbXBvcnQgeyBSZXN1bHRDb2RlRWRpdG9yVmlldyB9IGZyb20gJy4vZWRpdG9ycy9yZXN1bHRDb2RlRWRpdG9yVmlldy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTY3JvbGxTeW5jaHJvbml6ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBnZXQgbW9kZWwoKSB7IHJldHVybiB0aGlzLnZpZXdNb2RlbC5nZXQoKT8ubW9kZWw7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlZW50cmFuY3lCYXJyaWVyID0gbmV3IFJlZW50cmFuY3lCYXJyaWVyKCk7XG5cblx0cHVibGljIHJlYWRvbmx5IHVwZGF0ZVNjcm9sbGluZzogKCkgPT4gdm9pZDtcblxuXHRwcml2YXRlIGdldCBzaG91bGRBbGlnblJlc3VsdCgpIHsgcmV0dXJuIHRoaXMubGF5b3V0LmdldCgpLmtpbmQgPT09ICdjb2x1bW5zJzsgfVxuXHRwcml2YXRlIGdldCBzaG91bGRBbGlnbkJhc2UoKSB7IHJldHVybiB0aGlzLmxheW91dC5nZXQoKS5raW5kID09PSAnbWl4ZWQnICYmICF0aGlzLmxheW91dC5nZXQoKS5zaG93QmFzZUF0VG9wOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3TW9kZWw6IElPYnNlcnZhYmxlPE1lcmdlRWRpdG9yVmlld01vZGVsIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGlucHV0MVZpZXc6IElucHV0Q29kZUVkaXRvclZpZXcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnB1dDJWaWV3OiBJbnB1dENvZGVFZGl0b3JWaWV3LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYmFzZVZpZXc6IElPYnNlcnZhYmxlPEJhc2VDb2RlRWRpdG9yVmlldyB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnB1dFJlc3VsdFZpZXc6IFJlc3VsdENvZGVFZGl0b3JWaWV3LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0OiBJT2JzZXJ2YWJsZTxJTWVyZ2VFZGl0b3JMYXlvdXQ+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgaGFuZGxlSW5wdXQxT25TY3JvbGwgPSB0aGlzLnVwZGF0ZVNjcm9sbGluZyA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5tb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuaW5wdXQyVmlldy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuaW5wdXQxVmlldy5lZGl0b3IuZ2V0U2Nyb2xsVG9wKCksIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblxuXHRcdFx0aWYgKHRoaXMuc2hvdWxkQWxpZ25SZXN1bHQpIHtcblx0XHRcdFx0dGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yLnNldFNjcm9sbFRvcCh0aGlzLmlucHV0MVZpZXcuZWRpdG9yLmdldFNjcm9sbFRvcCgpLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtYXBwaW5nSW5wdXQxUmVzdWx0ID0gdGhpcy5tb2RlbC5pbnB1dDFSZXN1bHRNYXBwaW5nLmdldCgpO1xuXHRcdFx0XHR0aGlzLnN5bmNocm9uaXplU2Nyb2xsaW5nKHRoaXMuaW5wdXQxVmlldy5lZGl0b3IsIHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvciwgbWFwcGluZ0lucHV0MVJlc3VsdCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJhc2VWaWV3ID0gdGhpcy5iYXNlVmlldy5nZXQoKTtcblx0XHRcdGlmIChiYXNlVmlldykge1xuXHRcdFx0XHRpZiAodGhpcy5zaG91bGRBbGlnbkJhc2UpIHtcblx0XHRcdFx0XHR0aGlzLmJhc2VWaWV3LmdldCgpPy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuaW5wdXQxVmlldy5lZGl0b3IuZ2V0U2Nyb2xsVG9wKCksIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBtYXBwaW5nID0gbmV3IERvY3VtZW50TGluZVJhbmdlTWFwKHRoaXMubW9kZWwuYmFzZUlucHV0MURpZmZzLmdldCgpLCAtMSkucmV2ZXJzZSgpO1xuXHRcdFx0XHRcdHRoaXMuc3luY2hyb25pemVTY3JvbGxpbmcodGhpcy5pbnB1dDFWaWV3LmVkaXRvciwgYmFzZVZpZXcuZWRpdG9yLCBtYXBwaW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQoXG5cdFx0XHR0aGlzLmlucHV0MVZpZXcuZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKFxuXHRcdFx0XHR0aGlzLnJlZW50cmFuY3lCYXJyaWVyLm1ha2VFeGNsdXNpdmVPclNraXAoKGMpID0+IHtcblx0XHRcdFx0XHRpZiAoYy5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRcdFx0XHRoYW5kbGVJbnB1dDFPblNjcm9sbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoYy5zY3JvbGxMZWZ0Q2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5iYXNlVmlldy5nZXQoKT8uZWRpdG9yLnNldFNjcm9sbExlZnQoYy5zY3JvbGxMZWZ0LCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLmlucHV0MlZpZXcuZWRpdG9yLnNldFNjcm9sbExlZnQoYy5zY3JvbGxMZWZ0LCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3Iuc2V0U2Nyb2xsTGVmdChjLnNjcm9sbExlZnQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChcblx0XHRcdHRoaXMuaW5wdXQyVmlldy5lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoXG5cdFx0XHRcdHRoaXMucmVlbnRyYW5jeUJhcnJpZXIubWFrZUV4Y2x1c2l2ZU9yU2tpcCgoYykgPT4ge1xuXHRcdFx0XHRcdGlmICghdGhpcy5tb2RlbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChjLnNjcm9sbFRvcENoYW5nZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKGMuc2Nyb2xsVG9wLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cblx0XHRcdFx0XHRcdGlmICh0aGlzLnNob3VsZEFsaWduUmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvci5zZXRTY3JvbGxUb3AodGhpcy5pbnB1dDJWaWV3LmVkaXRvci5nZXRTY3JvbGxUb3AoKSwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwcGluZ0lucHV0MlJlc3VsdCA9IHRoaXMubW9kZWwuaW5wdXQyUmVzdWx0TWFwcGluZy5nZXQoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5zeW5jaHJvbml6ZVNjcm9sbGluZyh0aGlzLmlucHV0MlZpZXcuZWRpdG9yLCB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsIG1hcHBpbmdJbnB1dDJSZXN1bHQpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCBiYXNlVmlldyA9IHRoaXMuYmFzZVZpZXcuZ2V0KCk7XG5cdFx0XHRcdFx0XHRpZiAoYmFzZVZpZXcgJiYgdGhpcy5tb2RlbCkge1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5zaG91bGRBbGlnbkJhc2UpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmJhc2VWaWV3LmdldCgpPy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKGMuc2Nyb2xsVG9wLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwcGluZyA9IG5ldyBEb2N1bWVudExpbmVSYW5nZU1hcCh0aGlzLm1vZGVsLmJhc2VJbnB1dDJEaWZmcy5nZXQoKSwgLTEpLnJldmVyc2UoKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnN5bmNocm9uaXplU2Nyb2xsaW5nKHRoaXMuaW5wdXQyVmlldy5lZGl0b3IsIGJhc2VWaWV3LmVkaXRvciwgbWFwcGluZyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGMuc2Nyb2xsTGVmdENoYW5nZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuYmFzZVZpZXcuZ2V0KCk/LmVkaXRvci5zZXRTY3JvbGxMZWZ0KGMuc2Nyb2xsTGVmdCwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0dGhpcy5pbnB1dDFWaWV3LmVkaXRvci5zZXRTY3JvbGxMZWZ0KGMuc2Nyb2xsTGVmdCwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0dGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yLnNldFNjcm9sbExlZnQoYy5zY3JvbGxMZWZ0LCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0KVxuXHRcdCk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKFxuXHRcdFx0dGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKFxuXHRcdFx0XHR0aGlzLnJlZW50cmFuY3lCYXJyaWVyLm1ha2VFeGNsdXNpdmVPclNraXAoKGMpID0+IHtcblx0XHRcdFx0XHRpZiAoYy5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5zaG91bGRBbGlnblJlc3VsdCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0MVZpZXcuZWRpdG9yLnNldFNjcm9sbFRvcChjLnNjcm9sbFRvcCwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0MlZpZXcuZWRpdG9yLnNldFNjcm9sbFRvcChjLnNjcm9sbFRvcCwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwcGluZzEgPSB0aGlzLm1vZGVsPy5yZXN1bHRJbnB1dDFNYXBwaW5nLmdldCgpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnN5bmNocm9uaXplU2Nyb2xsaW5nKHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvciwgdGhpcy5pbnB1dDFWaWV3LmVkaXRvciwgbWFwcGluZzEpO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IG1hcHBpbmcyID0gdGhpcy5tb2RlbD8ucmVzdWx0SW5wdXQyTWFwcGluZy5nZXQoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5zeW5jaHJvbml6ZVNjcm9sbGluZyh0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsIHRoaXMuaW5wdXQyVmlldy5lZGl0b3IsIG1hcHBpbmcyKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZU1hcHBpbmcgPSB0aGlzLm1vZGVsPy5yZXN1bHRCYXNlTWFwcGluZy5nZXQoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGJhc2VWaWV3ID0gdGhpcy5iYXNlVmlldy5nZXQoKTtcblx0XHRcdFx0XHRcdGlmIChiYXNlVmlldyAmJiB0aGlzLm1vZGVsKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc3luY2hyb25pemVTY3JvbGxpbmcodGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yLCBiYXNlVmlldy5lZGl0b3IsIGJhc2VNYXBwaW5nKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGMuc2Nyb2xsTGVmdENoYW5nZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuYmFzZVZpZXcuZ2V0KCk/LmVkaXRvcj8uc2V0U2Nyb2xsTGVmdChjLnNjcm9sbExlZnQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3Iuc2V0U2Nyb2xsTGVmdChjLnNjcm9sbExlZnQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHRcdHRoaXMuaW5wdXQyVmlldy5lZGl0b3Iuc2V0U2Nyb2xsTGVmdChjLnNjcm9sbExlZnQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChcblx0XHRcdGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBzZXQgYmFzZVZpZXdFZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UgKi9cblx0XHRcdFx0Y29uc3QgYmFzZVZpZXcgPSB0aGlzLmJhc2VWaWV3LnJlYWQocmVhZGVyKTtcblx0XHRcdFx0aWYgKGJhc2VWaWV3KSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGJhc2VWaWV3LmVkaXRvci5vbkRpZFNjcm9sbENoYW5nZShcblx0XHRcdFx0XHRcdHRoaXMucmVlbnRyYW5jeUJhcnJpZXIubWFrZUV4Y2x1c2l2ZU9yU2tpcCgoYykgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoYy5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCF0aGlzLm1vZGVsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGlmICh0aGlzLnNob3VsZEFsaWduQmFzZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5pbnB1dDFWaWV3LmVkaXRvci5zZXRTY3JvbGxUb3AoYy5zY3JvbGxUb3AsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXQyVmlldy5lZGl0b3Iuc2V0U2Nyb2xsVG9wKGMuc2Nyb2xsVG9wLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGJhc2VJbnB1dDFNYXBwaW5nID0gbmV3IERvY3VtZW50TGluZVJhbmdlTWFwKHRoaXMubW9kZWwuYmFzZUlucHV0MURpZmZzLmdldCgpLCAtMSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnN5bmNocm9uaXplU2Nyb2xsaW5nKGJhc2VWaWV3LmVkaXRvciwgdGhpcy5pbnB1dDFWaWV3LmVkaXRvciwgYmFzZUlucHV0MU1hcHBpbmcpO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBiYXNlSW5wdXQyTWFwcGluZyA9IG5ldyBEb2N1bWVudExpbmVSYW5nZU1hcCh0aGlzLm1vZGVsLmJhc2VJbnB1dDJEaWZmcy5nZXQoKSwgLTEpO1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5zeW5jaHJvbml6ZVNjcm9sbGluZyhiYXNlVmlldy5lZGl0b3IsIHRoaXMuaW5wdXQyVmlldy5lZGl0b3IsIGJhc2VJbnB1dDJNYXBwaW5nKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBiYXNlTWFwcGluZyA9IHRoaXMubW9kZWw/LmJhc2VSZXN1bHRNYXBwaW5nLmdldCgpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuc3luY2hyb25pemVTY3JvbGxpbmcoYmFzZVZpZXcuZWRpdG9yLCB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsIGJhc2VNYXBwaW5nKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoYy5zY3JvbGxMZWZ0Q2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvci5zZXRTY3JvbGxMZWZ0KGMuc2Nyb2xsTGVmdCwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3Iuc2V0U2Nyb2xsTGVmdChjLnNjcm9sbExlZnQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0MlZpZXcuZWRpdG9yLnNldFNjcm9sbExlZnQoYy5zY3JvbGxMZWZ0LCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgc3luY2hyb25pemVTY3JvbGxpbmcoc2Nyb2xsaW5nRWRpdG9yOiBDb2RlRWRpdG9yV2lkZ2V0LCB0YXJnZXRFZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQsIG1hcHBpbmc6IERvY3VtZW50TGluZVJhbmdlTWFwIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKCFtYXBwaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHNjcm9sbGluZ0VkaXRvci5nZXRWaXNpYmxlUmFuZ2VzKCk7XG5cdFx0aWYgKHZpc2libGVSYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRvcExpbmVOdW1iZXIgPSB2aXNpYmxlUmFuZ2VzWzBdLnN0YXJ0TGluZU51bWJlciAtIDE7XG5cblx0XHRjb25zdCByZXN1bHQgPSBtYXBwaW5nLnByb2plY3QodG9wTGluZU51bWJlcik7XG5cdFx0Y29uc3Qgc291cmNlUmFuZ2UgPSByZXN1bHQuaW5wdXRSYW5nZTtcblx0XHRjb25zdCB0YXJnZXRSYW5nZSA9IHJlc3VsdC5vdXRwdXRSYW5nZTtcblxuXHRcdGNvbnN0IHJlc3VsdFN0YXJ0VG9wUHggPSB0YXJnZXRFZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0YXJnZXRSYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHJlc3VsdEVuZFB4ID0gdGFyZ2V0RWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIodGFyZ2V0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSk7XG5cblx0XHRjb25zdCBzb3VyY2VTdGFydFRvcFB4ID0gc2Nyb2xsaW5nRWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIoc291cmNlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCBzb3VyY2VFbmRQeCA9IHNjcm9sbGluZ0VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHNvdXJjZVJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUpO1xuXG5cdFx0Y29uc3QgZmFjdG9yID0gTWF0aC5taW4oKHNjcm9sbGluZ0VkaXRvci5nZXRTY3JvbGxUb3AoKSAtIHNvdXJjZVN0YXJ0VG9wUHgpIC8gKHNvdXJjZUVuZFB4IC0gc291cmNlU3RhcnRUb3BQeCksIDEpO1xuXHRcdGNvbnN0IHJlc3VsdFNjcm9sbFBvc2l0aW9uID0gcmVzdWx0U3RhcnRUb3BQeCArIChyZXN1bHRFbmRQeCAtIHJlc3VsdFN0YXJ0VG9wUHgpICogZmFjdG9yO1xuXG5cdFx0dGFyZ2V0RWRpdG9yLnNldFNjcm9sbFRvcChyZXN1bHRTY3JvbGxQb3NpdGlvbiwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHdCQUFxQztBQUU5QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHlCQUF5QjtBQU8z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V0FBVztBQUFBLGNBQ3BGO0FBQ0Esa0JBQUksRUFBRSxtQkFBbUI7QUFDeEIscUJBQUssZ0JBQWdCLE9BQU8sY0FBYyxFQUFFLFlBQVksV0FBVyxTQUFTO0FBQzVFLHFCQUFLLFdBQVcsT0FBTyxjQUFjLEVBQUUsWUFBWSxXQUFXLFNBQVM7QUFDdkUscUJBQUssV0FBVyxPQUFPLGNBQWMsRUFBRSxZQUFZLFdBQVcsU0FBUztBQUFBLGNBQ3hFO0FBQUEsWUFDRCxDQUFDO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUEsRUEvSkEsSUFBWSxRQUFRO0FBQUUsV0FBTyxLQUFLLFVBQVUsSUFBSSxHQUFHO0FBQUEsRUFBTztBQUFBLEVBTTFELElBQVksb0JBQW9CO0FBQUUsV0FBTyxLQUFLLE9BQU8sSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUFXO0FBQUEsRUFDL0UsSUFBWSxrQkFBa0I7QUFBRSxXQUFPLEtBQUssT0FBTyxJQUFJLEVBQUUsU0FBUyxXQUFXLENBQUMsS0FBSyxPQUFPLElBQUksRUFBRTtBQUFBLEVBQWU7QUFBQSxFQTBKdkcscUJBQXFCLGlCQUFtQyxjQUFnQyxTQUEyQztBQUMxSSxRQUFJLENBQUMsU0FBUztBQUNiO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLGdCQUFnQixpQkFBaUI7QUFDdkQsUUFBSSxjQUFjLFdBQVcsR0FBRztBQUMvQjtBQUFBLElBQ0Q7QUFDQSxVQUFNLGdCQUFnQixjQUFjLENBQUMsRUFBRSxrQkFBa0I7QUFFekQsVUFBTSxTQUFTLFFBQVEsUUFBUSxhQUFhO0FBQzVDLFVBQU0sY0FBYyxPQUFPO0FBQzNCLFVBQU0sY0FBYyxPQUFPO0FBRTNCLFVBQU0sbUJBQW1CLGFBQWEsb0JBQW9CLFlBQVksZUFBZTtBQUNyRixVQUFNLGNBQWMsYUFBYSxvQkFBb0IsWUFBWSxzQkFBc0I7QUFFdkYsVUFBTSxtQkFBbUIsZ0JBQWdCLG9CQUFvQixZQUFZLGVBQWU7QUFDeEYsVUFBTSxjQUFjLGdCQUFnQixvQkFBb0IsWUFBWSxzQkFBc0I7QUFFMUYsVUFBTSxTQUFTLEtBQUssS0FBSyxnQkFBZ0IsYUFBYSxJQUFJLHFCQUFxQixjQUFjLG1CQUFtQixDQUFDO0FBQ2pILFVBQU0sdUJBQXVCLG9CQUFvQixjQUFjLG9CQUFvQjtBQUVuRixpQkFBYSxhQUFhLHNCQUFzQixXQUFXLFNBQVM7QUFBQSxFQUNyRTtBQUNEOyIsCiAgIm5hbWVzIjogWyJiYXNlVmlldyJdCn0K
