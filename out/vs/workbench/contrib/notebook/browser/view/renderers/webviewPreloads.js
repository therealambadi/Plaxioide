async function webviewPreloads(ctx) {
  const userAgent = navigator.userAgent;
  const isChrome = userAgent.indexOf("Chrome") >= 0;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  function promiseWithResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  let currentOptions = ctx.options;
  const isWorkspaceTrusted = ctx.isWorkspaceTrusted;
  let currentRenderOptions = ctx.renderOptions;
  const settingChange = createEmitter();
  const acquireVsCodeApi = globalThis.acquireVsCodeApi;
  const vscode = acquireVsCodeApi();
  delete globalThis.acquireVsCodeApi;
  const tokenizationStyle = new CSSStyleSheet();
  tokenizationStyle.replaceSync(ctx.style.tokenizationCss);
  const runWhenIdle = typeof requestIdleCallback !== "function" || typeof cancelIdleCallback !== "function" ? (runner) => {
    setTimeout(() => {
      if (disposed) {
        return;
      }
      const end = Date.now() + 15;
      runner(Object.freeze({
        didTimeout: true,
        timeRemaining() {
          return Math.max(0, end - Date.now());
        }
      }));
    });
    let disposed = false;
    return {
      dispose() {
        if (disposed) {
          return;
        }
        disposed = true;
      }
    };
  } : (runner, timeout) => {
    const handle = requestIdleCallback(runner, typeof timeout === "number" ? { timeout } : void 0);
    let disposed = false;
    return {
      dispose() {
        if (disposed) {
          return;
        }
        disposed = true;
        cancelIdleCallback(handle);
      }
    };
  };
  function getOutputContainer(event) {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.classList.contains("output")) {
        return {
          id: node.id
        };
      }
    }
    return;
  }
  let lastFocusedOutput = void 0;
  const handleOutputFocusOut = (event) => {
    const outputFocus = event && getOutputContainer(event);
    if (!outputFocus) {
      return;
    }
    lastFocusedOutput = void 0;
    setTimeout(() => {
      if (lastFocusedOutput?.id === outputFocus.id) {
        return;
      }
      postNotebookMessage("outputBlur", outputFocus);
    }, 0);
  };
  const isEditableElement = (element) => {
    return element.tagName.toLowerCase() === "input" || element.tagName.toLowerCase() === "textarea" || "editContext" in element && !!element.editContext;
  };
  const checkOutputInputFocus = (e) => {
    lastFocusedOutput = getOutputContainer(e);
    const activeElement = window.document.activeElement;
    if (!activeElement) {
      return;
    }
    const id = lastFocusedOutput?.id;
    if (id && (isEditableElement(activeElement) || activeElement.tagName === "SELECT")) {
      postNotebookMessage("outputInputFocus", { inputFocused: true, id });
      activeElement.addEventListener("blur", () => {
        postNotebookMessage("outputInputFocus", { inputFocused: false, id });
      }, { once: true });
    }
  };
  const handleInnerClick = (event) => {
    if (!event || !event.view || !event.view.document) {
      return;
    }
    const outputFocus = lastFocusedOutput = getOutputContainer(event);
    for (const node of event.composedPath()) {
      if (node instanceof HTMLAnchorElement && node.href) {
        if (node.href.startsWith("blob:")) {
          if (outputFocus) {
            postNotebookMessage("outputFocus", outputFocus);
          }
          handleBlobUrlClick(node.href, node.download);
        } else if (node.href.startsWith("data:")) {
          if (outputFocus) {
            postNotebookMessage("outputFocus", outputFocus);
          }
          handleDataUrl(node.href, node.download);
        } else if (node.getAttribute("href")?.trim().startsWith("#")) {
          if (!node.hash) {
            postNotebookMessage("scroll-to-reveal", { scrollTop: 0 });
            return;
          }
          const targetId = node.hash.substring(1);
          let scrollTarget = event.view.document.getElementById(targetId);
          if (!scrollTarget) {
            for (const preview of event.view.document.querySelectorAll(".preview")) {
              scrollTarget = preview.shadowRoot?.getElementById(targetId);
              if (scrollTarget) {
                break;
              }
            }
          }
          if (scrollTarget) {
            const scrollTop = scrollTarget.getBoundingClientRect().top + event.view.scrollY;
            postNotebookMessage("scroll-to-reveal", { scrollTop });
            return;
          }
        } else {
          const href = node.getAttribute("href");
          if (href) {
            if (href.startsWith("command:") && outputFocus) {
              postNotebookMessage("outputFocus", outputFocus);
            }
            postNotebookMessage("clicked-link", { href });
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (outputFocus) {
      postNotebookMessage("outputFocus", outputFocus);
    }
  };
  const blurOutput = () => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    selection.removeAllRanges();
  };
  const selectOutputContents = (cellOrOutputId) => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const cellOutputContainer = window.document.getElementById(cellOrOutputId);
    if (!cellOutputContainer) {
      return;
    }
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNode(cellOutputContainer);
    selection.addRange(range);
  };
  const selectInputContents = (cellOrOutputId) => {
    const cellOutputContainer = window.document.getElementById(cellOrOutputId);
    if (!cellOutputContainer) {
      return;
    }
    const activeElement = window.document.activeElement;
    if (activeElement && isEditableElement(activeElement)) {
      activeElement.select();
    }
  };
  const onPageUpDownSelectionHandler = (e) => {
    if (!lastFocusedOutput?.id || !e.shiftKey) {
      return;
    }
    if (e.shiftKey && (e.code === "ArrowUp" || e.code === "ArrowDown")) {
      e.stopPropagation();
      return;
    }
    if (!(e.code === "PageUp" || e.code === "PageDown") && !(e.metaKey && (e.code === "ArrowDown" || e.code === "ArrowUp"))) {
      return;
    }
    const outputContainer = window.document.getElementById(lastFocusedOutput.id);
    const selection = window.getSelection();
    if (!outputContainer || !selection?.anchorNode) {
      return;
    }
    const activeElement = window.document.activeElement;
    if (activeElement && isEditableElement(activeElement)) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    const { anchorNode, anchorOffset } = selection;
    const range = document.createRange();
    if (e.code === "PageDown" || e.code === "ArrowDown") {
      range.setStart(anchorNode, anchorOffset);
      range.setEnd(outputContainer, 1);
    } else {
      range.setStart(outputContainer, 0);
      range.setEnd(anchorNode, anchorOffset);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const disableNativeSelectAll = (e) => {
    if (!lastFocusedOutput?.id) {
      return;
    }
    const activeElement = window.document.activeElement;
    if (activeElement && isEditableElement(activeElement)) {
      return;
    }
    if (e.key === "a" && e.ctrlKey || e.metaKey && e.key === "a") {
      e.preventDefault();
      return;
    }
  };
  const handleDataUrl = async (data, downloadName) => {
    postNotebookMessage("clicked-data-url", {
      data,
      downloadName
    });
  };
  const handleBlobUrlClick = async (url, downloadName) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        handleDataUrl(reader.result, downloadName);
      });
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e.message);
    }
  };
  window.document.body.addEventListener("click", handleInnerClick);
  window.document.body.addEventListener("focusin", checkOutputInputFocus);
  window.document.body.addEventListener("focusout", handleOutputFocusOut);
  window.document.body.addEventListener("keydown", onPageUpDownSelectionHandler);
  window.document.body.addEventListener("keydown", disableNativeSelectAll);
  function createKernelContext() {
    return Object.freeze({
      onDidReceiveKernelMessage: onDidReceiveKernelMessage.event,
      postKernelMessage: (data) => postNotebookMessage("customKernelMessage", { message: data })
    });
  }
  async function runKernelPreload(url) {
    try {
      return await activateModuleKernelPreload(url);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
  async function activateModuleKernelPreload(url) {
    const module = await __import(url);
    if (!module.activate) {
      console.error(`Notebook preload '${url}' was expected to be a module but it does not export an 'activate' function`);
      return;
    }
    return module.activate(createKernelContext());
  }
  const dimensionUpdater = new class {
    constructor() {
      this.pending = /* @__PURE__ */ new Map();
    }
    updateHeight(id, height, options) {
      if (!this.pending.size) {
        setTimeout(() => {
          this.updateImmediately();
        }, 0);
      }
      const update = this.pending.get(id);
      if (update && update.isOutput) {
        this.pending.set(id, {
          id,
          height,
          init: update.init,
          isOutput: update.isOutput
        });
      } else {
        this.pending.set(id, {
          id,
          height,
          ...options
        });
      }
    }
    updateImmediately() {
      if (!this.pending.size) {
        return;
      }
      postNotebookMessage("dimension", {
        updates: Array.from(this.pending.values())
      });
      this.pending.clear();
    }
  }();
  function elementHasContent(height) {
    return height > 2.1;
  }
  const resizeObserver = new class {
    constructor() {
      this._observedElements = /* @__PURE__ */ new WeakMap();
      this._observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (!window.document.body.contains(entry.target)) {
            continue;
          }
          const observedElementInfo = this._observedElements.get(entry.target);
          if (!observedElementInfo) {
            continue;
          }
          this.postResizeMessage(observedElementInfo.cellId);
          if (entry.target.id !== observedElementInfo.id) {
            continue;
          }
          if (!entry.contentRect) {
            continue;
          }
          if (!observedElementInfo.output) {
            this.updateHeight(observedElementInfo, entry.target.offsetHeight);
            continue;
          }
          const hasContent = elementHasContent(entry.contentRect.height);
          const shouldUpdatePadding = hasContent && observedElementInfo.lastKnownPadding === 0 || !hasContent && observedElementInfo.lastKnownPadding !== 0;
          if (shouldUpdatePadding) {
            window.requestAnimationFrame(() => {
              if (hasContent) {
                entry.target.style.padding = `${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodeLeftPadding}px`;
              } else {
                entry.target.style.padding = `0px`;
              }
              this.updateHeight(observedElementInfo, hasContent ? entry.target.offsetHeight : 0);
            });
          } else {
            this.updateHeight(observedElementInfo, hasContent ? entry.target.offsetHeight : 0);
          }
        }
      });
    }
    updateHeight(observedElementInfo, offsetHeight) {
      if (observedElementInfo.lastKnownHeight !== offsetHeight) {
        observedElementInfo.lastKnownHeight = offsetHeight;
        dimensionUpdater.updateHeight(observedElementInfo.id, offsetHeight, {
          isOutput: observedElementInfo.output
        });
      }
    }
    observe(container, id, output, cellId) {
      if (this._observedElements.has(container)) {
        return;
      }
      this._observedElements.set(container, { id, output, lastKnownPadding: ctx.style.outputNodePadding, lastKnownHeight: -1, cellId });
      this._observer.observe(container);
    }
    postResizeMessage(cellId) {
      clearTimeout(this._outputResizeTimer);
      this._outputResizeTimer = setTimeout(() => {
        postNotebookMessage("outputResized", {
          cellId
        });
      }, 250);
    }
  }();
  let previousDelta;
  let scrollTimeout;
  let scrolledElement;
  let lastTimeScrolled;
  function flagRecentlyScrolled(node, deltaY) {
    scrolledElement = node;
    if (deltaY === void 0) {
      lastTimeScrolled = Date.now();
      previousDelta = void 0;
      node.setAttribute("recentlyScrolled", "true");
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scrolledElement?.removeAttribute("recentlyScrolled");
      }, 300);
      return true;
    }
    if (node.hasAttribute("recentlyScrolled")) {
      if (lastTimeScrolled && Date.now() - lastTimeScrolled > 400) {
        if (!!previousDelta && deltaY < 0 && deltaY < previousDelta - 8) {
          clearTimeout(scrollTimeout);
          scrolledElement?.removeAttribute("recentlyScrolled");
          return false;
        } else if (!!previousDelta && deltaY > 0 && deltaY > previousDelta + 8) {
          clearTimeout(scrollTimeout);
          scrolledElement?.removeAttribute("recentlyScrolled");
          return false;
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          scrolledElement?.removeAttribute("recentlyScrolled");
        }, 50);
      } else {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          scrolledElement?.removeAttribute("recentlyScrolled");
        }, 300);
      }
      previousDelta = deltaY;
      return true;
    }
    return false;
  }
  function eventTargetShouldHandleScroll(event) {
    for (let node = event.target; node; node = node.parentNode) {
      if (!(node instanceof Element) || node.id === "container" || node.classList.contains("cell_container") || node.classList.contains("markup") || node.classList.contains("output_container")) {
        return false;
      }
      if (event.deltaY < 0 && node.scrollTop > 0) {
        flagRecentlyScrolled(node);
        return true;
      }
      if (event.deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight) {
        if (node.scrollHeight - node.scrollTop - node.clientHeight < 2) {
          continue;
        }
        if (window.getComputedStyle(node).overflowY === "hidden" || window.getComputedStyle(node).overflowY === "visible") {
          continue;
        }
        flagRecentlyScrolled(node);
        return true;
      }
      if (flagRecentlyScrolled(node, event.deltaY)) {
        return true;
      }
    }
    return false;
  }
  const handleWheel = (event) => {
    if (event.defaultPrevented || eventTargetShouldHandleScroll(event)) {
      return;
    }
    postNotebookMessage("did-scroll-wheel", {
      payload: {
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        // Refs https://github.com/microsoft/vscode/issues/146403#issuecomment-1854538928
        wheelDelta: event.wheelDelta && isChrome ? event.wheelDelta / window.devicePixelRatio : event.wheelDelta,
        wheelDeltaX: event.wheelDeltaX && isChrome ? event.wheelDeltaX / window.devicePixelRatio : event.wheelDeltaX,
        wheelDeltaY: event.wheelDeltaY && isChrome ? event.wheelDeltaY / window.devicePixelRatio : event.wheelDeltaY,
        detail: event.detail,
        shiftKey: event.shiftKey,
        type: event.type
      }
    });
  };
  function focusFirstFocusableOrContainerInOutput(cellOrOutputId, alternateId) {
    const cellOutputContainer = window.document.getElementById(cellOrOutputId) ?? (alternateId ? window.document.getElementById(alternateId) : void 0);
    if (cellOutputContainer) {
      if (cellOutputContainer.contains(window.document.activeElement)) {
        return;
      }
      const id = cellOutputContainer.id;
      let focusableElement = cellOutputContainer.querySelector('[tabindex="0"], [href], button, input, option, select, textarea');
      if (!focusableElement) {
        focusableElement = cellOutputContainer;
        focusableElement.tabIndex = -1;
        postNotebookMessage("outputInputFocus", { inputFocused: false, id });
      } else {
        const inputFocused = isEditableElement(focusableElement);
        postNotebookMessage("outputInputFocus", { inputFocused, id });
      }
      lastFocusedOutput = cellOutputContainer;
      postNotebookMessage("outputFocus", { id: cellOutputContainer.id });
      focusableElement.focus();
    }
  }
  function createFocusSink(cellId, focusNext) {
    const element = document.createElement("div");
    element.id = `focus-sink-${cellId}`;
    element.tabIndex = 0;
    element.addEventListener("focus", () => {
      postNotebookMessage("focus-editor", {
        cellId,
        focusNext
      });
    });
    return element;
  }
  function _internalHighlightRange(range, tagName = "mark", attributes = {}) {
    function _textNodesInRange(range2) {
      if (!range2.startContainer.ownerDocument) {
        return [];
      }
      if (range2.startContainer.nodeType === Node.TEXT_NODE && range2.startOffset > 0) {
        const startContainer = range2.startContainer;
        const endOffset = range2.endOffset;
        const createdNode = startContainer.splitText(range2.startOffset);
        if (range2.endContainer === startContainer) {
          range2.setEnd(createdNode, endOffset - range2.startOffset);
        }
        range2.setStart(createdNode, 0);
      }
      if (range2.endContainer.nodeType === Node.TEXT_NODE && range2.endOffset < range2.endContainer.length) {
        range2.endContainer.splitText(range2.endOffset);
      }
      const walker = range2.startContainer.ownerDocument.createTreeWalker(
        range2.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        (node) => range2.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      );
      walker.currentNode = range2.startContainer;
      const nodes2 = [];
      if (walker.currentNode.nodeType === Node.TEXT_NODE) {
        nodes2.push(walker.currentNode);
      }
      while (walker.nextNode() && range2.comparePoint(walker.currentNode, 0) !== 1) {
        if (walker.currentNode.nodeType === Node.TEXT_NODE) {
          nodes2.push(walker.currentNode);
        }
      }
      return nodes2;
    }
    function wrapNodeInHighlight(node, tagName2, attributes2) {
      const highlightElement = node.ownerDocument.createElement(tagName2);
      Object.keys(attributes2).forEach((key) => {
        highlightElement.setAttribute(key, attributes2[key]);
      });
      const tempRange = node.ownerDocument.createRange();
      tempRange.selectNode(node);
      tempRange.surroundContents(highlightElement);
      return highlightElement;
    }
    if (range.collapsed) {
      return {
        remove: () => {
        },
        update: () => {
        }
      };
    }
    const nodes = _textNodesInRange(range);
    const highlightElements = [];
    for (const nodeIdx in nodes) {
      const highlightElement = wrapNodeInHighlight(nodes[nodeIdx], tagName, attributes);
      highlightElements.push(highlightElement);
    }
    function _removeHighlight(highlightElement) {
      if (highlightElement.childNodes.length === 1) {
        highlightElement.parentNode?.replaceChild(highlightElement.firstChild, highlightElement);
      } else {
        while (highlightElement.firstChild) {
          highlightElement.parentNode?.insertBefore(highlightElement.firstChild, highlightElement);
        }
        highlightElement.remove();
      }
    }
    function _removeHighlights() {
      for (const highlightIdx in highlightElements) {
        _removeHighlight(highlightElements[highlightIdx]);
      }
    }
    function _updateHighlight(highlightElement, attributes2 = {}) {
      Object.keys(attributes2).forEach((key) => {
        highlightElement.setAttribute(key, attributes2[key]);
      });
    }
    function updateHighlights(attributes2) {
      for (const highlightIdx in highlightElements) {
        _updateHighlight(highlightElements[highlightIdx], attributes2);
      }
    }
    return {
      remove: _removeHighlights,
      update: updateHighlights
    };
  }
  function selectRange(_range) {
    const sel = window.getSelection();
    if (sel) {
      try {
        sel.removeAllRanges();
        const r = document.createRange();
        r.setStart(_range.startContainer, _range.startOffset);
        r.setEnd(_range.endContainer, _range.endOffset);
        sel.addRange(r);
      } catch (e) {
        console.log(e);
      }
    }
  }
  function highlightRange(range, useCustom, tagName = "mark", attributes = {}) {
    if (useCustom) {
      const ret = _internalHighlightRange(range, tagName, attributes);
      return {
        range,
        dispose: ret.remove,
        update: (color, className) => {
          if (className === void 0) {
            ret.update({
              "style": `background-color: ${color}`
            });
          } else {
            ret.update({
              "class": className
            });
          }
        }
      };
    } else {
      window.document.execCommand("hiliteColor", false, matchColor);
      const cloneRange = window.getSelection().getRangeAt(0).cloneRange();
      const _range = {
        collapsed: cloneRange.collapsed,
        commonAncestorContainer: cloneRange.commonAncestorContainer,
        endContainer: cloneRange.endContainer,
        endOffset: cloneRange.endOffset,
        startContainer: cloneRange.startContainer,
        startOffset: cloneRange.startOffset
      };
      return {
        range: _range,
        dispose: () => {
          selectRange(_range);
          try {
            document.designMode = "On";
            window.document.execCommand("removeFormat", false, void 0);
            document.designMode = "Off";
            window.getSelection()?.removeAllRanges();
          } catch (e) {
            console.log(e);
          }
        },
        update: (color, className) => {
          selectRange(_range);
          try {
            document.designMode = "On";
            window.document.execCommand("removeFormat", false, void 0);
            window.document.execCommand("hiliteColor", false, color);
            document.designMode = "Off";
            window.getSelection()?.removeAllRanges();
          } catch (e) {
            console.log(e);
          }
        }
      };
    }
  }
  function createEmitter(listenerChange = () => void 0) {
    const listeners = /* @__PURE__ */ new Set();
    return {
      fire(data) {
        for (const listener of [...listeners]) {
          listener.fn.call(listener.thisArg, data);
        }
      },
      event(fn, thisArg, disposables) {
        const listenerObj = { fn, thisArg };
        const disposable = {
          dispose: () => {
            listeners.delete(listenerObj);
            listenerChange(listeners);
          }
        };
        listeners.add(listenerObj);
        listenerChange(listeners);
        if (disposables instanceof Array) {
          disposables.push(disposable);
        } else if (disposables) {
          disposables.add(disposable);
        }
        return disposable;
      }
    };
  }
  function showRenderError(errorText, outputNode, errors) {
    outputNode.innerText = errorText;
    const errList = document.createElement("ul");
    for (const result of errors) {
      console.error(result);
      const item = document.createElement("li");
      item.innerText = result.message;
      errList.appendChild(item);
    }
    outputNode.appendChild(errList);
  }
  const outputItemRequests = new class {
    constructor() {
      this._requestPool = 0;
      this._requests = /* @__PURE__ */ new Map();
    }
    getOutputItem(outputId, mime) {
      const requestId = this._requestPool++;
      const { promise, resolve } = promiseWithResolvers();
      this._requests.set(requestId, { resolve });
      postNotebookMessage("getOutputItem", { requestId, outputId, mime });
      return promise;
    }
    resolveOutputItem(requestId, output) {
      const request = this._requests.get(requestId);
      if (!request) {
        return;
      }
      this._requests.delete(requestId);
      request.resolve(output);
    }
  }();
  let hasWarnedAboutAllOutputItemsProposal = false;
  function createOutputItem(id, mime, metadata, valueBytes, allOutputItemData, appended) {
    function create(id2, mime2, metadata2, valueBytes2, appended2) {
      return Object.freeze({
        id: id2,
        mime: mime2,
        metadata: metadata2,
        appendedText() {
          if (appended2) {
            return textDecoder.decode(appended2.valueBytes);
          }
          return void 0;
        },
        data() {
          return valueBytes2;
        },
        text() {
          return textDecoder.decode(valueBytes2);
        },
        json() {
          return JSON.parse(this.text());
        },
        blob() {
          return new Blob([valueBytes2], { type: this.mime });
        },
        get _allOutputItems() {
          if (!hasWarnedAboutAllOutputItemsProposal) {
            hasWarnedAboutAllOutputItemsProposal = true;
            console.warn(`'_allOutputItems' is proposed API. DO NOT ship an extension that depends on it!`);
          }
          return allOutputItemList;
        }
      });
    }
    const allOutputItemCache = /* @__PURE__ */ new Map();
    const allOutputItemList = Object.freeze(allOutputItemData.map((outputItem) => {
      const mime2 = outputItem.mime;
      return Object.freeze({
        mime: mime2,
        getItem() {
          const existingTask = allOutputItemCache.get(mime2);
          if (existingTask) {
            return existingTask;
          }
          const task = outputItemRequests.getOutputItem(id, mime2).then((item2) => {
            return item2 ? create(id, item2.mime, metadata, item2.valueBytes) : void 0;
          });
          allOutputItemCache.set(mime2, task);
          return task;
        }
      });
    }));
    const item = create(id, mime, metadata, valueBytes, appended);
    allOutputItemCache.set(mime, Promise.resolve(item));
    return item;
  }
  const onDidReceiveKernelMessage = createEmitter();
  const ttPolicy = window.trustedTypes?.createPolicy("notebookRenderer", {
    createHTML: (value) => value,
    // CodeQL [SM03712] The rendered content is provided by renderer extensions, which are responsible for sanitizing their content themselves. The notebook webview is also sandboxed.
    createScript: (value) => value
    // CodeQL [SM03712] The rendered content is provided by renderer extensions, which are responsible for sanitizing their content themselves. The notebook webview is also sandboxed.
  });
  window.addEventListener("wheel", handleWheel);
  const matchColor = window.getComputedStyle(window.document.getElementById("_defaultColorPalatte")).color;
  const currentMatchColor = window.getComputedStyle(window.document.getElementById("_defaultColorPalatte")).backgroundColor;
  class JSHighlighter {
    constructor() {
      this._activeHighlightInfo = /* @__PURE__ */ new Map();
    }
    addHighlights(matches, ownerID) {
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const ret = highlightRange(match.originalRange, true, "mark", match.isShadow ? {
          "style": "background-color: " + matchColor + ";"
        } : {
          "class": "find-match"
        });
        match.highlightResult = ret;
      }
      const highlightInfo = {
        matches,
        currentMatchIndex: -1
      };
      this._activeHighlightInfo.set(ownerID, highlightInfo);
    }
    removeHighlights(ownerID) {
      this._activeHighlightInfo.get(ownerID)?.matches.forEach((match) => {
        match.highlightResult?.dispose();
      });
      this._activeHighlightInfo.delete(ownerID);
    }
    highlightCurrentMatch(index, ownerID) {
      const highlightInfo = this._activeHighlightInfo.get(ownerID);
      if (!highlightInfo) {
        console.error("Modified current highlight match before adding highlight list.");
        return;
      }
      const oldMatch = highlightInfo.matches[highlightInfo.currentMatchIndex];
      oldMatch?.highlightResult?.update(matchColor, oldMatch.isShadow ? void 0 : "find-match");
      const match = highlightInfo.matches[index];
      highlightInfo.currentMatchIndex = index;
      const sel = window.getSelection();
      if (!!match && !!sel && match.highlightResult) {
        let offset = 0;
        try {
          const outputOffset = window.document.getElementById(match.id).getBoundingClientRect().top;
          const tempRange = document.createRange();
          tempRange.selectNode(match.highlightResult.range.startContainer);
          match.highlightResult.range.startContainer.parentElement?.scrollIntoView({ behavior: "auto", block: "end", inline: "nearest" });
          const rangeOffset = tempRange.getBoundingClientRect().top;
          tempRange.detach();
          offset = rangeOffset - outputOffset;
        } catch (e) {
          console.error(e);
        }
        match.highlightResult?.update(currentMatchColor, match.isShadow ? void 0 : "current-find-match");
        window.document.getSelection()?.removeAllRanges();
        postNotebookMessage("didFindHighlightCurrent", {
          offset
        });
      }
    }
    unHighlightCurrentMatch(index, ownerID) {
      const highlightInfo = this._activeHighlightInfo.get(ownerID);
      if (!highlightInfo) {
        return;
      }
      const oldMatch = highlightInfo.matches[index];
      if (oldMatch && oldMatch.highlightResult) {
        oldMatch.highlightResult.update(matchColor, oldMatch.isShadow ? void 0 : "find-match");
      }
    }
    dispose() {
      window.document.getSelection()?.removeAllRanges();
      this._activeHighlightInfo.forEach((highlightInfo) => {
        highlightInfo.matches.forEach((match) => {
          match.highlightResult?.dispose();
        });
      });
    }
  }
  class CSSHighlighter {
    constructor() {
      this._activeHighlightInfo = /* @__PURE__ */ new Map();
      this._matchesHighlight = new Highlight();
      this._matchesHighlight.priority = 1;
      this._currentMatchesHighlight = new Highlight();
      this._currentMatchesHighlight.priority = 2;
      CSS.highlights?.set(`find-highlight`, this._matchesHighlight);
      CSS.highlights?.set(`current-find-highlight`, this._currentMatchesHighlight);
    }
    _refreshRegistry(updateMatchesHighlight = true) {
      if (updateMatchesHighlight) {
        this._matchesHighlight.clear();
      }
      this._currentMatchesHighlight.clear();
      this._activeHighlightInfo.forEach((highlightInfo) => {
        if (updateMatchesHighlight) {
          for (let i = 0; i < highlightInfo.matches.length; i++) {
            this._matchesHighlight.add(highlightInfo.matches[i].originalRange);
          }
        }
        if (highlightInfo.currentMatchIndex < highlightInfo.matches.length && highlightInfo.currentMatchIndex >= 0) {
          this._currentMatchesHighlight.add(highlightInfo.matches[highlightInfo.currentMatchIndex].originalRange);
        }
      });
    }
    addHighlights(matches, ownerID) {
      for (let i = 0; i < matches.length; i++) {
        this._matchesHighlight.add(matches[i].originalRange);
      }
      const newEntry = {
        matches,
        currentMatchIndex: -1
      };
      this._activeHighlightInfo.set(ownerID, newEntry);
    }
    highlightCurrentMatch(index, ownerID) {
      const highlightInfo = this._activeHighlightInfo.get(ownerID);
      if (!highlightInfo) {
        console.error("Modified current highlight match before adding highlight list.");
        return;
      }
      highlightInfo.currentMatchIndex = index;
      const match = highlightInfo.matches[index];
      if (match) {
        let offset = 0;
        try {
          const outputOffset = window.document.getElementById(match.id).getBoundingClientRect().top;
          match.originalRange.startContainer.parentElement?.scrollIntoView({ behavior: "auto", block: "end", inline: "nearest" });
          const rangeOffset = match.originalRange.getBoundingClientRect().top;
          offset = rangeOffset - outputOffset;
          postNotebookMessage("didFindHighlightCurrent", {
            offset
          });
        } catch (e) {
          console.error(e);
        }
      }
      this._refreshRegistry(false);
    }
    unHighlightCurrentMatch(index, ownerID) {
      const highlightInfo = this._activeHighlightInfo.get(ownerID);
      if (!highlightInfo) {
        return;
      }
      highlightInfo.currentMatchIndex = -1;
    }
    removeHighlights(ownerID) {
      this._activeHighlightInfo.delete(ownerID);
      this._refreshRegistry();
    }
    dispose() {
      window.document.getSelection()?.removeAllRanges();
      this._currentMatchesHighlight.clear();
      this._matchesHighlight.clear();
    }
  }
  const _highlighter = CSS.highlights ? new CSSHighlighter() : new JSHighlighter();
  function extractSelectionLine(selection) {
    const range = selection.getRangeAt(0);
    const oldRange = range.cloneRange();
    const captureLength = selection.toString().length;
    selection.collapseToStart();
    selection.modify("move", "backward", "lineboundary");
    selection.modify("extend", "forward", "lineboundary");
    const line = selection.toString();
    const rangeStart = getStartOffset(selection.getRangeAt(0), oldRange);
    const lineRange = {
      start: rangeStart,
      end: rangeStart + captureLength
    };
    selection.removeAllRanges();
    selection.addRange(oldRange);
    return { line, range: lineRange };
  }
  function getStartOffset(lineRange, originalRange) {
    const firstCommonAncestor = findFirstCommonAncestor(lineRange.startContainer, originalRange.startContainer);
    const selectionOffset = getSelectionOffsetRelativeTo(firstCommonAncestor, lineRange.startContainer) + lineRange.startOffset;
    const textOffset = getSelectionOffsetRelativeTo(firstCommonAncestor, originalRange.startContainer) + originalRange.startOffset;
    return textOffset - selectionOffset;
  }
  function findFirstCommonAncestor(nodeA, nodeB) {
    const range = new Range();
    range.setStart(nodeA, 0);
    range.setEnd(nodeB, 0);
    return range.commonAncestorContainer;
  }
  function getTextContentLength(node) {
    let length = 0;
    if (node.nodeType === Node.TEXT_NODE) {
      length += node.textContent?.length || 0;
    } else {
      for (const childNode of node.childNodes) {
        length += getTextContentLength(childNode);
      }
    }
    return length;
  }
  function getSelectionOffsetRelativeTo(parentElement, currentNode) {
    if (!currentNode) {
      return 0;
    }
    let offset = 0;
    if (currentNode === parentElement || !parentElement.contains(currentNode)) {
      return offset;
    }
    let prevSibling = currentNode.previousSibling;
    while (prevSibling) {
      offset += getTextContentLength(prevSibling);
      prevSibling = prevSibling.previousSibling;
    }
    return offset + getSelectionOffsetRelativeTo(parentElement, currentNode.parentNode);
  }
  const find = (query, options) => {
    let find2 = true;
    let matches = [];
    const range = document.createRange();
    range.selectNodeContents(window.document.getElementById("findStart"));
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    viewModel.toggleDragDropEnabled(false);
    try {
      document.designMode = "On";
      while (find2 && matches.length < 500) {
        find2 = window.find(
          query,
          /* caseSensitive*/
          !!options.caseSensitive,
          /* backwards*/
          false,
          /* wrapAround*/
          false,
          /* wholeWord */
          !!options.wholeWord,
          /* searchInFrames*/
          true,
          false
        );
        if (find2) {
          const selection = window.getSelection();
          if (!selection) {
            console.log("no selection");
            break;
          }
          if (options.includeMarkup && selection.rangeCount > 0 && selection.getRangeAt(0).startContainer.nodeType === 1 && selection.getRangeAt(0).startContainer.classList.contains("markup")) {
            const preview = selection.anchorNode?.firstChild;
            const root = preview.shadowRoot;
            const shadowSelection = root?.getSelection ? root?.getSelection() : null;
            if (shadowSelection && shadowSelection.anchorNode) {
              matches.push({
                type: "preview",
                id: preview.id,
                cellId: preview.id,
                container: preview,
                isShadow: true,
                originalRange: shadowSelection.getRangeAt(0),
                searchPreviewInfo: options.shouldGetSearchPreviewInfo ? extractSelectionLine(shadowSelection) : void 0
              });
            }
          }
          if (options.includeOutput && selection.rangeCount > 0 && selection.getRangeAt(0).startContainer.nodeType === 1 && selection.getRangeAt(0).startContainer.classList.contains("output_container")) {
            const cellId = selection.getRangeAt(0).startContainer.parentElement.id;
            const outputNode = selection.anchorNode?.firstChild;
            const root = outputNode.shadowRoot;
            const shadowSelection = root?.getSelection ? root?.getSelection() : null;
            if (shadowSelection && shadowSelection.anchorNode) {
              matches.push({
                type: "output",
                id: outputNode.id,
                cellId,
                container: outputNode,
                isShadow: true,
                originalRange: shadowSelection.getRangeAt(0),
                searchPreviewInfo: options.shouldGetSearchPreviewInfo ? extractSelectionLine(shadowSelection) : void 0
              });
            }
          }
          const anchorNode = selection.anchorNode?.parentElement;
          if (anchorNode) {
            const lastEl = matches.length ? matches[matches.length - 1] : null;
            if (lastEl && lastEl.container.contains(anchorNode) && options.includeOutput) {
              matches.push({
                type: lastEl.type,
                id: lastEl.id,
                cellId: lastEl.cellId,
                container: lastEl.container,
                isShadow: false,
                originalRange: selection.getRangeAt(0),
                searchPreviewInfo: options.shouldGetSearchPreviewInfo ? extractSelectionLine(selection) : void 0
              });
            } else {
              for (let node = anchorNode; node; node = node.parentElement) {
                if (!(node instanceof Element)) {
                  break;
                }
                if (node.classList.contains("output") && options.includeOutput) {
                  const cellId = node.parentElement?.parentElement?.id;
                  if (cellId) {
                    matches.push({
                      type: "output",
                      id: node.id,
                      cellId,
                      container: node,
                      isShadow: false,
                      originalRange: selection.getRangeAt(0),
                      searchPreviewInfo: options.shouldGetSearchPreviewInfo ? extractSelectionLine(selection) : void 0
                    });
                  }
                  break;
                }
                if (node.id === "container" || node === window.document.body) {
                  break;
                }
              }
            }
          } else {
            break;
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
    matches = matches.filter((match) => options.findIds.length ? options.findIds.includes(match.cellId) : true);
    _highlighter.addHighlights(matches, options.ownerID);
    window.document.getSelection()?.removeAllRanges();
    viewModel.toggleDragDropEnabled(currentOptions.dragAndDropEnabled);
    document.designMode = "Off";
    postNotebookMessage("didFind", {
      matches: matches.map((match, index) => ({
        type: match.type,
        id: match.id,
        cellId: match.cellId,
        index,
        searchPreviewInfo: match.searchPreviewInfo
      }))
    });
  };
  const copyOutputImage = async (outputId, altOutputId, retries = 5) => {
    if (!window.document.hasFocus() && retries > 0) {
      setTimeout(() => {
        copyOutputImage(outputId, altOutputId, retries - 1);
      }, 50);
      return;
    }
    try {
      const outputElement = window.document.getElementById(outputId) ?? window.document.getElementById(altOutputId);
      let image = outputElement?.querySelector("img");
      if (!image) {
        const svgImage = outputElement?.querySelector("svg.output-image") ?? outputElement?.querySelector("div.svgContainerStyle > svg");
        if (svgImage) {
          image = new Image();
          image.src = "data:image/svg+xml," + encodeURIComponent(svgImage.outerHTML);
        }
      }
      if (image) {
        const imageToCopy = image;
        await navigator.clipboard.write([new ClipboardItem({
          "image/png": new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            canvas.width = imageToCopy.naturalWidth;
            canvas.height = imageToCopy.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(imageToCopy, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                console.error("No blob data to write to clipboard");
              }
              canvas.remove();
            }, "image/png");
          })
        })]);
      } else {
        console.error("Could not find image element to copy for output with id", outputId);
      }
    } catch (e) {
      console.error("Could not copy image:", e);
    }
  };
  window.addEventListener("message", async (rawEvent) => {
    const event = rawEvent;
    switch (event.data.type) {
      case "initializeMarkup": {
        try {
          await Promise.all(event.data.cells.map((info) => viewModel.ensureMarkupCell(info)));
        } finally {
          dimensionUpdater.updateImmediately();
          postNotebookMessage("initializedMarkup", { requestId: event.data.requestId });
        }
        break;
      }
      case "createMarkupCell":
        viewModel.ensureMarkupCell(event.data.cell);
        break;
      case "showMarkupCell":
        viewModel.showMarkupCell(event.data.id, event.data.top, event.data.content, event.data.metadata);
        break;
      case "hideMarkupCells":
        for (const id of event.data.ids) {
          viewModel.hideMarkupCell(id);
        }
        break;
      case "unhideMarkupCells":
        for (const id of event.data.ids) {
          viewModel.unhideMarkupCell(id);
        }
        break;
      case "deleteMarkupCell":
        for (const id of event.data.ids) {
          viewModel.deleteMarkupCell(id);
        }
        break;
      case "updateSelectedMarkupCells":
        viewModel.updateSelectedCells(event.data.selectedCellIds);
        break;
      case "html": {
        const data = event.data;
        if (data.createOnIdle) {
          outputRunner.enqueueIdle(data.outputId, (signal) => {
            return viewModel.renderOutputCell(data, signal);
          });
        } else {
          outputRunner.enqueue(data.outputId, (signal) => {
            return viewModel.renderOutputCell(data, signal);
          });
        }
        break;
      }
      case "view-scroll": {
        event.data.widgets.forEach((widget) => {
          outputRunner.enqueue(widget.outputId, () => {
            viewModel.updateOutputsScroll([widget]);
          });
        });
        viewModel.updateMarkupScrolls(event.data.markupCells);
        break;
      }
      case "clear":
        renderers.clearAll();
        viewModel.clearAll();
        window.document.getElementById("container").innerText = "";
        break;
      case "clearOutput": {
        const { cellId, rendererId, outputId } = event.data;
        outputRunner.cancelOutput(outputId);
        viewModel.clearOutput(cellId, outputId, rendererId);
        break;
      }
      case "hideOutput": {
        const { cellId, outputId } = event.data;
        outputRunner.enqueue(outputId, () => {
          viewModel.hideOutput(cellId);
        });
        break;
      }
      case "showOutput": {
        const { outputId, cellTop, cellId, content } = event.data;
        outputRunner.enqueue(outputId, () => {
          viewModel.showOutput(cellId, outputId, cellTop);
          if (content) {
            viewModel.updateAndRerender(cellId, outputId, content);
          }
        });
        break;
      }
      case "copyImage": {
        await copyOutputImage(event.data.outputId, event.data.altOutputId);
        break;
      }
      case "ack-dimension": {
        for (const { cellId, outputId, height } of event.data.updates) {
          viewModel.updateOutputHeight(cellId, outputId, height);
        }
        break;
      }
      case "preload": {
        const resources = event.data.resources;
        for (const { uri } of resources) {
          kernelPreloads.load(uri);
        }
        break;
      }
      case "updateRenderers": {
        const { rendererData } = event.data;
        renderers.updateRendererData(rendererData);
        break;
      }
      case "focus-output":
        focusFirstFocusableOrContainerInOutput(event.data.cellOrOutputId, event.data.alternateId);
        break;
      case "blur-output":
        blurOutput();
        break;
      case "select-output-contents":
        selectOutputContents(event.data.cellOrOutputId);
        break;
      case "select-input-contents":
        selectInputContents(event.data.cellOrOutputId);
        break;
      case "decorations": {
        let outputContainer = window.document.getElementById(event.data.cellId);
        if (!outputContainer) {
          viewModel.ensureOutputCell(event.data.cellId, -1e5, true);
          outputContainer = window.document.getElementById(event.data.cellId);
        }
        outputContainer?.classList.add(...event.data.addedClassNames);
        outputContainer?.classList.remove(...event.data.removedClassNames);
        break;
      }
      case "markupDecorations": {
        const markupCell = window.document.getElementById(event.data.cellId);
        if (markupCell) {
          markupCell?.classList.add(...event.data.addedClassNames);
          markupCell?.classList.remove(...event.data.removedClassNames);
        }
        break;
      }
      case "customKernelMessage":
        onDidReceiveKernelMessage.fire(event.data.message);
        break;
      case "customRendererMessage":
        renderers.getRenderer(event.data.rendererId)?.receiveMessage(event.data.message);
        break;
      case "notebookStyles": {
        const documentStyle = window.document.documentElement.style;
        for (let i = documentStyle.length - 1; i >= 0; i--) {
          const property = documentStyle[i];
          if (property && property.startsWith("--notebook-")) {
            documentStyle.removeProperty(property);
          }
        }
        for (const [name, value] of Object.entries(event.data.styles)) {
          documentStyle.setProperty(`--${name}`, value);
        }
        break;
      }
      case "notebookOptions":
        currentOptions = event.data.options;
        viewModel.toggleDragDropEnabled(currentOptions.dragAndDropEnabled);
        currentRenderOptions = event.data.renderOptions;
        settingChange.fire(currentRenderOptions);
        break;
      case "tokenizedCodeBlock": {
        const { codeBlockId, html } = event.data;
        MarkdownCodeBlock.highlightCodeBlock(codeBlockId, html);
        break;
      }
      case "tokenizedStylesChanged": {
        tokenizationStyle.replaceSync(event.data.css);
        break;
      }
      case "find": {
        _highlighter.removeHighlights(event.data.options.ownerID);
        find(event.data.query, event.data.options);
        break;
      }
      case "findHighlightCurrent": {
        _highlighter?.highlightCurrentMatch(event.data.index, event.data.ownerID);
        break;
      }
      case "findUnHighlightCurrent": {
        _highlighter?.unHighlightCurrentMatch(event.data.index, event.data.ownerID);
        break;
      }
      case "findStop": {
        _highlighter.removeHighlights(event.data.ownerID);
        break;
      }
      case "returnOutputItem": {
        outputItemRequests.resolveOutputItem(event.data.requestId, event.data.output);
      }
    }
  });
  const renderFallbackErrorName = "vscode.fallbackToNextRenderer";
  class Renderer {
    constructor(data) {
      this.data = data;
      this._onMessageEvent = createEmitter();
    }
    receiveMessage(message) {
      this._onMessageEvent.fire(message);
    }
    async renderOutputItem(item, element, signal) {
      try {
        await this.load();
      } catch (e) {
        if (!signal.aborted) {
          showRenderError(`Error loading renderer '${this.data.id}'`, element, e instanceof Error ? [e] : []);
        }
        return;
      }
      if (!this._api) {
        if (!signal.aborted) {
          showRenderError(`Renderer '${this.data.id}' does not implement renderOutputItem`, element, []);
        }
        return;
      }
      try {
        const renderStart = performance.now();
        await this._api.renderOutputItem(item, element, signal);
        this.postDebugMessage("Rendered output item", { id: item.id, duration: `${performance.now() - renderStart}ms` });
      } catch (e) {
        if (signal.aborted) {
          return;
        }
        if (e instanceof Error && e.name === renderFallbackErrorName) {
          throw e;
        }
        showRenderError(`Error rendering output item using '${this.data.id}'`, element, e instanceof Error ? [e] : []);
        this.postDebugMessage("Rendering output item failed", { id: item.id, error: e + "" });
      }
    }
    disposeOutputItem(id) {
      this._api?.disposeOutputItem?.(id);
    }
    createRendererContext() {
      const { id, messaging } = this.data;
      const context = {
        setState: (newState) => vscode.setState({ ...vscode.getState(), [id]: newState }),
        getState: () => {
          const state = vscode.getState();
          return typeof state === "object" && state ? state[id] : void 0;
        },
        getRenderer: async (id2) => {
          const renderer = renderers.getRenderer(id2);
          if (!renderer) {
            return void 0;
          }
          if (renderer._api) {
            return renderer._api;
          }
          return renderer.load();
        },
        workspace: {
          get isTrusted() {
            return isWorkspaceTrusted;
          }
        },
        settings: {
          get lineLimit() {
            return currentRenderOptions.lineLimit;
          },
          get outputScrolling() {
            return currentRenderOptions.outputScrolling;
          },
          get outputWordWrap() {
            return currentRenderOptions.outputWordWrap;
          },
          get linkifyFilePaths() {
            return currentRenderOptions.linkifyFilePaths;
          },
          get minimalError() {
            return currentRenderOptions.minimalError;
          }
        },
        get onDidChangeSettings() {
          return settingChange.event;
        }
      };
      if (messaging) {
        context.onDidReceiveMessage = this._onMessageEvent.event;
        context.postMessage = (message) => postNotebookMessage("customRendererMessage", { rendererId: id, message });
      }
      return Object.freeze(context);
    }
    load() {
      this._loadPromise ??= this._load();
      return this._loadPromise;
    }
    /** Inner function cached in the _loadPromise(). */
    async _load() {
      this.postDebugMessage("Start loading renderer");
      try {
        await kernelPreloads.waitForAllCurrent();
        const importStart = performance.now();
        const module = await __import(this.data.entrypoint.path);
        this.postDebugMessage("Imported renderer", { duration: `${performance.now() - importStart}ms` });
        if (!module) {
          return;
        }
        this._api = await module.activate(this.createRendererContext());
        this.postDebugMessage("Activated renderer", { duration: `${performance.now() - importStart}ms` });
        const dependantRenderers = ctx.rendererData.filter((d) => d.entrypoint.extends === this.data.id);
        if (dependantRenderers.length) {
          this.postDebugMessage("Activating dependant renderers", { dependents: dependantRenderers.map((x) => x.id).join(", ") });
        }
        await Promise.all(dependantRenderers.map(async (d) => {
          const renderer = renderers.getRenderer(d.id);
          if (!renderer) {
            throw new Error(`Could not find extending renderer: ${d.id}`);
          }
          try {
            return await renderer.load();
          } catch (e) {
            console.error(e);
            this.postDebugMessage("Activating dependant renderer failed", { dependent: d.id, error: e + "" });
            return void 0;
          }
        }));
        return this._api;
      } catch (e) {
        this.postDebugMessage("Loading renderer failed");
        throw e;
      }
    }
    postDebugMessage(msg, data) {
      postNotebookMessage("logRendererDebugMessage", {
        message: `[renderer ${this.data.id}] - ${msg}`,
        data
      });
    }
  }
  const kernelPreloads = new class {
    constructor() {
      this.preloads = /* @__PURE__ */ new Map();
    }
    /**
     * Returns a promise that resolves when the given preload is activated.
     */
    waitFor(uri) {
      return this.preloads.get(uri) || Promise.resolve(new Error(`Preload not ready: ${uri}`));
    }
    /**
     * Loads a preload.
     * @param uri URI to load from
     * @param originalUri URI to show in an error message if the preload is invalid.
     */
    load(uri) {
      const promise = Promise.all([
        runKernelPreload(uri),
        this.waitForAllCurrent()
      ]);
      this.preloads.set(uri, promise);
      return promise;
    }
    /**
     * Returns a promise that waits for all currently-registered preloads to
     * activate before resolving.
     */
    waitForAllCurrent() {
      return Promise.all([...this.preloads.values()].map((p) => p.catch((err) => err)));
    }
  }();
  const outputRunner = new class {
    constructor() {
      this.outputs = /* @__PURE__ */ new Map();
      this.pendingOutputCreationRequest = /* @__PURE__ */ new Map();
    }
    /**
     * Pushes the action onto the list of actions for the given output ID,
     * ensuring that it's run in-order.
     */
    enqueue(outputId, action) {
      this.pendingOutputCreationRequest.get(outputId)?.dispose();
      this.pendingOutputCreationRequest.delete(outputId);
      const record = this.outputs.get(outputId);
      if (!record) {
        const controller = new AbortController();
        this.outputs.set(outputId, { abort: controller, queue: new Promise((r) => r(action(controller.signal))) });
      } else {
        record.queue = record.queue.then(async (r) => {
          if (!record.abort.signal.aborted) {
            await action(record.abort.signal);
          }
        });
      }
    }
    enqueueIdle(outputId, action) {
      this.pendingOutputCreationRequest.get(outputId)?.dispose();
      outputRunner.pendingOutputCreationRequest.set(outputId, runWhenIdle(() => {
        outputRunner.enqueue(outputId, action);
        outputRunner.pendingOutputCreationRequest.delete(outputId);
      }));
    }
    /**
     * Cancels the rendering of all outputs.
     */
    cancelAll() {
      this.pendingOutputCreationRequest.forEach((r) => r.dispose());
      this.pendingOutputCreationRequest.clear();
      for (const { abort } of this.outputs.values()) {
        abort.abort();
      }
      this.outputs.clear();
    }
    /**
     * Cancels any ongoing rendering out an output.
     */
    cancelOutput(outputId) {
      this.pendingOutputCreationRequest.get(outputId)?.dispose();
      this.pendingOutputCreationRequest.delete(outputId);
      const output = this.outputs.get(outputId);
      if (output) {
        output.abort.abort();
        this.outputs.delete(outputId);
      }
    }
  }();
  const renderers = new class {
    constructor() {
      this._renderers = /* @__PURE__ */ new Map();
      for (const renderer of ctx.rendererData) {
        this.addRenderer(renderer);
      }
    }
    getRenderer(id) {
      return this._renderers.get(id);
    }
    rendererEqual(a, b) {
      if (a.id !== b.id || a.entrypoint.path !== b.entrypoint.path || a.entrypoint.extends !== b.entrypoint.extends || a.messaging !== b.messaging) {
        return false;
      }
      if (a.mimeTypes.length !== b.mimeTypes.length) {
        return false;
      }
      for (let i = 0; i < a.mimeTypes.length; i++) {
        if (a.mimeTypes[i] !== b.mimeTypes[i]) {
          return false;
        }
      }
      return true;
    }
    updateRendererData(rendererData) {
      const oldKeys = new Set(this._renderers.keys());
      const newKeys = new Set(rendererData.map((d) => d.id));
      for (const renderer of rendererData) {
        const existing = this._renderers.get(renderer.id);
        if (existing && this.rendererEqual(existing.data, renderer)) {
          continue;
        }
        this.addRenderer(renderer);
      }
      for (const key of oldKeys) {
        if (!newKeys.has(key)) {
          this._renderers.delete(key);
        }
      }
    }
    addRenderer(renderer) {
      this._renderers.set(renderer.id, new Renderer(renderer));
    }
    clearAll() {
      outputRunner.cancelAll();
      for (const renderer of this._renderers.values()) {
        renderer.disposeOutputItem();
      }
    }
    clearOutput(rendererId, outputId) {
      outputRunner.cancelOutput(outputId);
      this._renderers.get(rendererId)?.disposeOutputItem(outputId);
    }
    async render(item, preferredRendererId, element, signal) {
      const primaryRenderer = this.findRenderer(preferredRendererId, item);
      if (!primaryRenderer) {
        const errorMessage2 = (window.document.documentElement.style.getPropertyValue("--notebook-cell-renderer-not-found-error") || "").replace("$0", () => item.mime);
        this.showRenderError(item, element, errorMessage2);
        return;
      }
      if (!(await this._doRender(item, element, primaryRenderer, signal)).continue) {
        return;
      }
      for (const additionalItemData of item._allOutputItems) {
        if (additionalItemData.mime === item.mime) {
          continue;
        }
        const additionalItem = await additionalItemData.getItem();
        if (signal.aborted) {
          return;
        }
        if (additionalItem) {
          const renderer = this.findRenderer(void 0, additionalItem);
          if (renderer) {
            if (!(await this._doRender(additionalItem, element, renderer, signal)).continue) {
              return;
            }
          }
        }
      }
      const errorMessage = (window.document.documentElement.style.getPropertyValue("--notebook-cell-renderer-fallbacks-exhausted") || "").replace("$0", () => item.mime);
      this.showRenderError(item, element, errorMessage);
    }
    async _doRender(item, element, renderer, signal) {
      try {
        await renderer.renderOutputItem(item, element, signal);
        return { continue: false };
      } catch (e) {
        if (signal.aborted) {
          return { continue: false };
        }
        if (e instanceof Error && e.name === renderFallbackErrorName) {
          return { continue: true };
        } else {
          throw e;
        }
      }
    }
    findRenderer(preferredRendererId, info) {
      let renderer;
      if (typeof preferredRendererId === "string") {
        renderer = Array.from(this._renderers.values()).find((renderer2) => renderer2.data.id === preferredRendererId);
      } else {
        const renderers2 = Array.from(this._renderers.values()).filter((renderer2) => renderer2.data.mimeTypes.includes(info.mime) && !renderer2.data.entrypoint.extends);
        if (renderers2.length) {
          renderers2.sort((a, b) => +a.data.isBuiltin - +b.data.isBuiltin);
          renderer = renderers2[0];
        }
      }
      return renderer;
    }
    showRenderError(info, element, errorMessage) {
      const errorContainer = document.createElement("div");
      const error = document.createElement("div");
      error.className = "no-renderer-error";
      error.innerText = errorMessage;
      const cellText = document.createElement("div");
      cellText.innerText = info.text();
      errorContainer.appendChild(error);
      errorContainer.appendChild(cellText);
      element.innerText = "";
      element.appendChild(errorContainer);
    }
  }();
  const viewModel = new class ViewModel {
    constructor() {
      this._markupCells = /* @__PURE__ */ new Map();
      this._outputCells = /* @__PURE__ */ new Map();
    }
    clearAll() {
      for (const cell of this._markupCells.values()) {
        cell.dispose();
      }
      this._markupCells.clear();
      for (const output of this._outputCells.values()) {
        output.dispose();
      }
      this._outputCells.clear();
    }
    async createMarkupCell(init, top, visible) {
      const existing = this._markupCells.get(init.cellId);
      if (existing) {
        console.error(`Trying to create markup that already exists: ${init.cellId}`);
        return existing;
      }
      const cell = new MarkupCell(init.cellId, init.mime, init.content, top, init.metadata);
      cell.element.style.visibility = visible ? "" : "hidden";
      this._markupCells.set(init.cellId, cell);
      await cell.ready;
      return cell;
    }
    async ensureMarkupCell(info) {
      let cell = this._markupCells.get(info.cellId);
      if (cell) {
        cell.element.style.visibility = info.visible ? "" : "hidden";
        await cell.updateContentAndRender(info.content, info.metadata);
      } else {
        cell = await this.createMarkupCell(info, info.offset, info.visible);
      }
    }
    deleteMarkupCell(id) {
      const cell = this.getExpectedMarkupCell(id);
      if (cell) {
        cell.remove();
        cell.dispose();
        this._markupCells.delete(id);
      }
    }
    async updateMarkupContent(id, newContent, metadata) {
      const cell = this.getExpectedMarkupCell(id);
      await cell?.updateContentAndRender(newContent, metadata);
    }
    showMarkupCell(id, top, newContent, metadata) {
      const cell = this.getExpectedMarkupCell(id);
      cell?.show(top, newContent, metadata);
    }
    hideMarkupCell(id) {
      const cell = this.getExpectedMarkupCell(id);
      cell?.hide();
    }
    unhideMarkupCell(id) {
      const cell = this.getExpectedMarkupCell(id);
      cell?.unhide();
    }
    getExpectedMarkupCell(id) {
      const cell = this._markupCells.get(id);
      if (!cell) {
        console.log(`Could not find markup cell '${id}'`);
        return void 0;
      }
      return cell;
    }
    updateSelectedCells(selectedCellIds) {
      const selectedCellSet = new Set(selectedCellIds);
      for (const cell of this._markupCells.values()) {
        cell.setSelected(selectedCellSet.has(cell.id));
      }
    }
    toggleDragDropEnabled(dragAndDropEnabled) {
      for (const cell of this._markupCells.values()) {
        cell.toggleDragDropEnabled(dragAndDropEnabled);
      }
    }
    updateMarkupScrolls(markupCells) {
      for (const { id, top } of markupCells) {
        const cell = this._markupCells.get(id);
        if (cell) {
          cell.element.style.top = `${top}px`;
        }
      }
    }
    async renderOutputCell(data, signal) {
      const preloadErrors = await Promise.all(
        data.requiredPreloads.map((p) => kernelPreloads.waitFor(p.uri).then(() => void 0, (err) => err))
      );
      if (signal.aborted) {
        return;
      }
      const cellOutput = this.ensureOutputCell(data.cellId, data.cellTop, false);
      return cellOutput.renderOutputElement(data, preloadErrors, signal);
    }
    ensureOutputCell(cellId, cellTop, skipCellTopUpdateIfExist) {
      let cell = this._outputCells.get(cellId);
      const existed = !!cell;
      if (!cell) {
        cell = new OutputCell(cellId);
        this._outputCells.set(cellId, cell);
      }
      if (existed && skipCellTopUpdateIfExist) {
        return cell;
      }
      cell.element.style.top = cellTop + "px";
      return cell;
    }
    clearOutput(cellId, outputId, rendererId) {
      const cell = this._outputCells.get(cellId);
      cell?.clearOutput(outputId, rendererId);
    }
    showOutput(cellId, outputId, top) {
      const cell = this._outputCells.get(cellId);
      cell?.show(outputId, top);
    }
    updateAndRerender(cellId, outputId, content) {
      const cell = this._outputCells.get(cellId);
      cell?.updateContentAndRerender(outputId, content);
    }
    hideOutput(cellId) {
      const cell = this._outputCells.get(cellId);
      cell?.hide();
    }
    updateOutputHeight(cellId, outputId, height) {
      const cell = this._outputCells.get(cellId);
      cell?.updateOutputHeight(outputId, height);
    }
    updateOutputsScroll(updates) {
      for (const request of updates) {
        const cell = this._outputCells.get(request.cellId);
        cell?.updateScroll(request);
      }
    }
  }();
  const _MarkdownCodeBlock = class _MarkdownCodeBlock {
    static highlightCodeBlock(id, html) {
      const el = _MarkdownCodeBlock.pendingCodeBlocksToHighlight.get(id);
      if (!el) {
        return;
      }
      const trustedHtml = ttPolicy?.createHTML(html) ?? html;
      el.innerHTML = trustedHtml;
      const root = el.getRootNode();
      if (root instanceof ShadowRoot) {
        if (!root.adoptedStyleSheets.includes(tokenizationStyle)) {
          root.adoptedStyleSheets.push(tokenizationStyle);
        }
      }
    }
    static requestHighlightCodeBlock(root) {
      const codeBlocks = [];
      let i = 0;
      for (const el of root.querySelectorAll(".vscode-code-block")) {
        const lang = el.getAttribute("data-vscode-code-block-lang");
        if (el.textContent && lang) {
          const id = `${Date.now()}-${i++}`;
          codeBlocks.push({ value: el.textContent, lang, id });
          _MarkdownCodeBlock.pendingCodeBlocksToHighlight.set(id, el);
        }
      }
      return codeBlocks;
    }
  };
  _MarkdownCodeBlock.pendingCodeBlocksToHighlight = /* @__PURE__ */ new Map();
  let MarkdownCodeBlock = _MarkdownCodeBlock;
  class MarkupCell {
    constructor(id, mime, content, top, metadata) {
      this._isDisposed = false;
      const self = this;
      this.id = id;
      this._content = { value: content, version: 0, metadata };
      const { promise, resolve, reject } = promiseWithResolvers();
      this.ready = promise;
      let cachedData;
      this.outputItem = Object.freeze({
        id,
        mime,
        get metadata() {
          return self._content.metadata;
        },
        text: () => {
          return this._content.value;
        },
        json: () => {
          return void 0;
        },
        data: () => {
          if (cachedData?.version === this._content.version) {
            return cachedData.value;
          }
          const data = textEncoder.encode(this._content.value);
          cachedData = { version: this._content.version, value: data };
          return data;
        },
        blob() {
          return new Blob([this.data()], { type: this.mime });
        },
        _allOutputItems: [{
          mime,
          getItem: async () => this.outputItem
        }]
      });
      const root = window.document.getElementById("container");
      const markupCell = document.createElement("div");
      markupCell.className = "markup";
      markupCell.style.position = "absolute";
      markupCell.style.width = "100%";
      this.element = document.createElement("div");
      this.element.id = this.id;
      this.element.classList.add("preview");
      this.element.style.position = "absolute";
      this.element.style.top = top + "px";
      this.toggleDragDropEnabled(currentOptions.dragAndDropEnabled);
      markupCell.appendChild(this.element);
      root.appendChild(markupCell);
      this.addEventListeners();
      this.updateContentAndRender(this._content.value, this._content.metadata).then(() => {
        if (!this._isDisposed) {
          resizeObserver.observe(this.element, this.id, false, this.id);
        }
        resolve();
      }, () => reject());
    }
    dispose() {
      this._isDisposed = true;
      this.renderTaskAbort?.abort();
      this.renderTaskAbort = void 0;
    }
    addEventListeners() {
      this.element.addEventListener("dblclick", () => {
        postNotebookMessage("toggleMarkupPreview", { cellId: this.id });
      });
      this.element.addEventListener("click", (e) => {
        postNotebookMessage("clickMarkupCell", {
          cellId: this.id,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey
        });
      });
      this.element.addEventListener("contextmenu", (e) => {
        postNotebookMessage("contextMenuMarkupCell", {
          cellId: this.id,
          clientX: e.clientX,
          clientY: e.clientY
        });
      });
      this.element.addEventListener("mouseenter", () => {
        postNotebookMessage("mouseEnterMarkupCell", { cellId: this.id });
      });
      this.element.addEventListener("mouseleave", () => {
        postNotebookMessage("mouseLeaveMarkupCell", { cellId: this.id });
      });
      this.element.addEventListener("dragstart", (e) => {
        markupCellDragManager.startDrag(e, this.id);
      });
      this.element.addEventListener("drag", (e) => {
        markupCellDragManager.updateDrag(e, this.id);
      });
      this.element.addEventListener("dragend", (e) => {
        markupCellDragManager.endDrag(e, this.id);
      });
    }
    async updateContentAndRender(newContent, metadata) {
      this._content = { value: newContent, version: this._content.version + 1, metadata };
      this.renderTaskAbort?.abort();
      const controller = new AbortController();
      this.renderTaskAbort = controller;
      try {
        await renderers.render(this.outputItem, void 0, this.element, this.renderTaskAbort.signal);
      } finally {
        if (this.renderTaskAbort === controller) {
          this.renderTaskAbort = void 0;
        }
      }
      const root = this.element.shadowRoot ?? this.element;
      const html = [];
      for (const child of root.children) {
        switch (child.tagName) {
          case "LINK":
          case "SCRIPT":
          case "STYLE":
            break;
          default:
            html.push(child.outerHTML);
            break;
        }
      }
      const codeBlocks = MarkdownCodeBlock.requestHighlightCodeBlock(root);
      postNotebookMessage("renderedMarkup", {
        cellId: this.id,
        html: html.join(""),
        codeBlocks
      });
      dimensionUpdater.updateHeight(this.id, this.element.offsetHeight, {
        isOutput: false
      });
    }
    show(top, newContent, metadata) {
      this.element.style.visibility = "";
      this.element.style.top = `${top}px`;
      if (typeof newContent === "string" || metadata) {
        this.updateContentAndRender(newContent ?? this._content.value, metadata ?? this._content.metadata);
      } else {
        this.updateMarkupDimensions();
      }
    }
    hide() {
      this.element.style.visibility = "hidden";
    }
    unhide() {
      this.element.style.visibility = "";
      this.updateMarkupDimensions();
    }
    remove() {
      this.element.remove();
    }
    async updateMarkupDimensions() {
      dimensionUpdater.updateHeight(this.id, this.element.offsetHeight, {
        isOutput: false
      });
    }
    setSelected(selected) {
      this.element.classList.toggle("selected", selected);
    }
    toggleDragDropEnabled(enabled) {
      if (enabled) {
        this.element.classList.add("draggable");
        this.element.setAttribute("draggable", "true");
      } else {
        this.element.classList.remove("draggable");
        this.element.removeAttribute("draggable");
      }
    }
  }
  class OutputCell {
    constructor(cellId) {
      this.outputElements = /* @__PURE__ */ new Map();
      const container = window.document.getElementById("container");
      const upperWrapperElement = createFocusSink(cellId);
      container.appendChild(upperWrapperElement);
      this.element = document.createElement("div");
      this.element.style.position = "absolute";
      this.element.style.outline = "0";
      this.element.id = cellId;
      this.element.classList.add("cell_container");
      container.appendChild(this.element);
      this.element = this.element;
      const lowerWrapperElement = createFocusSink(cellId, true);
      container.appendChild(lowerWrapperElement);
    }
    dispose() {
      for (const output of this.outputElements.values()) {
        output.dispose();
      }
      this.outputElements.clear();
    }
    createOutputElement(data) {
      let outputContainer = this.outputElements.get(data.outputId);
      if (!outputContainer) {
        outputContainer = new OutputContainer(data.outputId);
        this.element.appendChild(outputContainer.element);
        this.outputElements.set(data.outputId, outputContainer);
      }
      return outputContainer.createOutputElement(data.outputId, data.outputOffset, data.left, data.cellId);
    }
    async renderOutputElement(data, preloadErrors, signal) {
      const startTime = Date.now();
      const outputElement = this.createOutputElement(data);
      await outputElement.render(data.content, data.rendererId, preloadErrors, signal);
      outputElement.element.style.visibility = data.initiallyHidden ? "hidden" : "";
      if (!!data.executionId && !!data.rendererId) {
        let outputSize = void 0;
        if (data.content.type === 1) {
          outputSize = data.content.output.valueBytes.length;
        }
        if (outputSize !== void 0 && outputSize > 0 && outputSize < 100 * 1024) {
          postNotebookMessage("notebookPerformanceMessage", {
            cellId: data.cellId,
            executionId: data.executionId,
            duration: Date.now() - startTime,
            rendererId: data.rendererId,
            outputSize
          });
        }
      }
    }
    clearOutput(outputId, rendererId) {
      const output = this.outputElements.get(outputId);
      output?.clear(rendererId);
      output?.dispose();
      this.outputElements.delete(outputId);
    }
    show(outputId, top) {
      const outputContainer = this.outputElements.get(outputId);
      if (!outputContainer) {
        return;
      }
      this.element.style.visibility = "";
      this.element.style.top = `${top}px`;
    }
    hide() {
      this.element.style.visibility = "hidden";
    }
    updateContentAndRerender(outputId, content) {
      this.outputElements.get(outputId)?.updateContentAndRender(content);
    }
    updateOutputHeight(outputId, height) {
      this.outputElements.get(outputId)?.updateHeight(height);
    }
    updateScroll(request) {
      this.element.style.top = `${request.cellTop}px`;
      const outputElement = this.outputElements.get(request.outputId);
      if (outputElement) {
        outputElement.updateScroll(request.outputOffset);
        if (request.forceDisplay && outputElement.outputNode) {
          outputElement.outputNode.element.style.visibility = "";
        }
      }
      if (request.forceDisplay) {
        this.element.style.visibility = "";
      }
    }
  }
  class OutputContainer {
    constructor(outputId) {
      this.outputId = outputId;
      this.element = document.createElement("div");
      this.element.classList.add("output_container");
      this.element.setAttribute("data-vscode-context", JSON.stringify({ "preventDefaultContextMenuItems": true }));
      this.element.style.position = "absolute";
      this.element.style.overflow = "hidden";
    }
    get outputNode() {
      return this._outputNode;
    }
    dispose() {
      this._outputNode?.dispose();
    }
    clear(rendererId) {
      if (rendererId) {
        renderers.clearOutput(rendererId, this.outputId);
      }
      this.element.remove();
    }
    updateHeight(height) {
      this.element.style.maxHeight = `${height}px`;
      this.element.style.height = `${height}px`;
    }
    updateScroll(outputOffset) {
      this.element.style.top = `${outputOffset}px`;
    }
    createOutputElement(outputId, outputOffset, left, cellId) {
      this.element.innerText = "";
      this.element.style.maxHeight = "0px";
      this.element.style.top = `${outputOffset}px`;
      this._outputNode?.dispose();
      this._outputNode = new OutputElement(outputId, left, cellId);
      this.element.appendChild(this._outputNode.element);
      return this._outputNode;
    }
    updateContentAndRender(content) {
      this._outputNode?.updateAndRerender(content);
    }
  }
  vscode.postMessage({
    __vscode_notebook_message: true,
    type: "initialized"
  });
  for (const preload of ctx.staticPreloadsData) {
    kernelPreloads.load(preload.entrypoint);
  }
  function postNotebookMessage(type, properties) {
    vscode.postMessage({
      __vscode_notebook_message: true,
      type,
      ...properties
    });
  }
  class OutputElement {
    constructor(outputId, left, cellId) {
      this.outputId = outputId;
      this.cellId = cellId;
      this.hasResizeObserver = false;
      this.element = document.createElement("div");
      this.element.id = outputId;
      this.element.classList.add("output");
      this.element.style.position = "absolute";
      this.element.style.top = `0px`;
      this.element.style.left = left + "px";
      this.element.style.padding = `${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodeLeftPadding}`;
      this.element.addEventListener("mouseenter", () => {
        postNotebookMessage("mouseenter", { id: outputId });
      });
      this.element.addEventListener("mouseleave", () => {
        postNotebookMessage("mouseleave", { id: outputId });
      });
    }
    dispose() {
      this.renderTaskAbort?.abort();
      this.renderTaskAbort = void 0;
    }
    async render(content, preferredRendererId, preloadErrors, signal) {
      this.renderTaskAbort?.abort();
      this.renderTaskAbort = void 0;
      this._content = { preferredRendererId, preloadErrors };
      if (content.type === 0) {
        const trustedHtml = ttPolicy?.createHTML(content.htmlContent) ?? content.htmlContent;
        this.element.innerHTML = trustedHtml;
      } else if (preloadErrors.some((e) => e instanceof Error)) {
        const errors = preloadErrors.filter((e) => e instanceof Error);
        showRenderError(`Error loading preloads`, this.element, errors);
      } else {
        const item = createOutputItem(this.outputId, content.output.mime, content.metadata, content.output.valueBytes, content.allOutputs, content.output.appended);
        const controller = new AbortController();
        this.renderTaskAbort = controller;
        signal?.addEventListener("abort", () => controller.abort());
        try {
          await renderers.render(item, preferredRendererId, this.element, controller.signal);
        } finally {
          if (this.renderTaskAbort === controller) {
            this.renderTaskAbort = void 0;
          }
        }
      }
      if (!this.hasResizeObserver) {
        this.hasResizeObserver = true;
        resizeObserver.observe(this.element, this.outputId, true, this.cellId);
      }
      const offsetHeight = this.element.offsetHeight;
      const cps = document.defaultView.getComputedStyle(this.element);
      const verticalPadding = parseFloat(cps.paddingTop) + parseFloat(cps.paddingBottom);
      const contentHeight = offsetHeight - verticalPadding;
      if (elementHasContent(contentHeight) && cps.padding === "0px") {
        dimensionUpdater.updateHeight(this.outputId, offsetHeight + ctx.style.outputNodePadding * 2, {
          isOutput: true,
          init: true
        });
        this.element.style.padding = `${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodePadding}px ${ctx.style.outputNodeLeftPadding}`;
      } else if (elementHasContent(contentHeight)) {
        dimensionUpdater.updateHeight(this.outputId, this.element.offsetHeight, {
          isOutput: true,
          init: true
        });
        this.element.style.padding = `0 ${ctx.style.outputNodePadding}px 0 ${ctx.style.outputNodeLeftPadding}`;
      } else {
        dimensionUpdater.updateHeight(this.outputId, 0, {
          isOutput: true,
          init: true
        });
      }
      const root = this.element.shadowRoot ?? this.element;
      const codeBlocks = MarkdownCodeBlock.requestHighlightCodeBlock(root);
      if (codeBlocks.length > 0) {
        postNotebookMessage("renderedCellOutput", {
          codeBlocks
        });
      }
    }
    updateAndRerender(content) {
      if (this._content) {
        this.render(content, this._content.preferredRendererId, this._content.preloadErrors);
      }
    }
  }
  const markupCellDragManager = new class MarkupCellDragManager {
    constructor() {
      window.document.addEventListener("dragover", (e) => {
        e.preventDefault();
      });
      window.document.addEventListener("drop", (e) => {
        e.preventDefault();
        const drag = this.currentDrag;
        if (!drag) {
          return;
        }
        this.currentDrag = void 0;
        postNotebookMessage("cell-drop", {
          cellId: drag.cellId,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          dragOffsetY: e.clientY
        });
      });
    }
    startDrag(e, cellId) {
      if (!e.dataTransfer) {
        return;
      }
      if (!currentOptions.dragAndDropEnabled) {
        return;
      }
      this.currentDrag = { cellId, clientY: e.clientY };
      const overlayZIndex = 9999;
      if (!this.dragOverlay) {
        this.dragOverlay = document.createElement("div");
        this.dragOverlay.style.position = "absolute";
        this.dragOverlay.style.top = "0";
        this.dragOverlay.style.left = "0";
        this.dragOverlay.style.zIndex = `${overlayZIndex}`;
        this.dragOverlay.style.width = "100%";
        this.dragOverlay.style.height = "100%";
        this.dragOverlay.style.background = "transparent";
        window.document.body.appendChild(this.dragOverlay);
      }
      e.target.style.zIndex = `${overlayZIndex + 1}`;
      e.target.classList.add("dragging");
      postNotebookMessage("cell-drag-start", {
        cellId,
        dragOffsetY: e.clientY
      });
      const trySendDragUpdate = () => {
        if (this.currentDrag?.cellId !== cellId) {
          return;
        }
        postNotebookMessage("cell-drag", {
          cellId,
          dragOffsetY: this.currentDrag.clientY
        });
        window.requestAnimationFrame(trySendDragUpdate);
      };
      window.requestAnimationFrame(trySendDragUpdate);
    }
    updateDrag(e, cellId) {
      if (cellId !== this.currentDrag?.cellId) {
        this.currentDrag = void 0;
      } else {
        this.currentDrag = { cellId, clientY: e.clientY };
      }
    }
    endDrag(e, cellId) {
      this.currentDrag = void 0;
      e.target.classList.remove("dragging");
      postNotebookMessage("cell-drag-end", {
        cellId
      });
      if (this.dragOverlay) {
        this.dragOverlay.remove();
        this.dragOverlay = void 0;
      }
      e.target.style.zIndex = "";
    }
  }();
}
function preloadsScriptStr(styleValues, options, renderOptions, renderers, preloads, isWorkspaceTrusted, nonce) {
  const ctx = {
    style: styleValues,
    options,
    renderOptions,
    rendererData: renderers,
    staticPreloadsData: preloads,
    isWorkspaceTrusted,
    nonce
  };
  return `
		const __import = (x) => import(x);
		(${webviewPreloads})(
			JSON.parse(decodeURIComponent("${encodeURIComponent(JSON.stringify(ctx))}"))
		)
//# sourceURL=notebookWebviewPreloads.js
`;
}
export {
  preloadsScriptStr
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvcmVuZGVyZXJzL3dlYnZpZXdQcmVsb2Fkcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgdHlwZSB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB0eXBlICogYXMgd2Vidmlld01lc3NhZ2VzIGZyb20gJy4vd2Vidmlld01lc3NhZ2VzLmpzJztcbmltcG9ydCB0eXBlIHsgTm90ZWJvb2tDZWxsTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHR5cGUgKiBhcyByZW5kZXJlckFwaSBmcm9tICd2c2NvZGUtbm90ZWJvb2stcmVuZGVyZXInO1xuXG4vLyAhISBJTVBPUlRBTlQgISEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gaW1wb3J0IHsgUmVuZGVyT3V0cHV0VHlwZSB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tCcm93c2VyJztcbi8vIFdlIGNhbiBPTkxZIElNUE9SVCBhcyB0eXBlIGluIHRoaXMgbW9kdWxlLiBUaGlzIGFsc28gYXBwbGllcyB0byBjb25zdCBlbnVtcyB0aGF0IHdvdWxkIGV2YXBvcmF0ZVxuLy8gaW4gbm9ybWFsIGNvbXBpbGVzIGJ1dCByZW1haW4gYSBkZXBlbmRlbmN5IGluIHRyYW5zcGlsZS1vbmx5IGNvbXBpbGVzXG4vLyAhISBJTVBPUlRBTlQgISEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyAhISBJTVBPUlRBTlQgISEgZXZlcnl0aGluZyBtdXN0IGJlIGluLWxpbmUgd2l0aGluIHRoZSB3ZWJ2aWV3UHJlbG9hZHNcbi8vIGZ1bmN0aW9uLiBJbXBvcnRzIGFyZSBub3QgYWxsb3dlZC4gVGhpcyBpcyBzdHJpbmdpZmllZCBhbmQgaW5qZWN0ZWQgaW50b1xuLy8gdGhlIHdlYnZpZXcuXG5cbmRlY2xhcmUgbW9kdWxlIGdsb2JhbFRoaXMge1xuXHRjb25zdCBhY3F1aXJlVnNDb2RlQXBpOiAoKSA9PiAoe1xuXHRcdGdldFN0YXRlKCk6IHsgW2tleTogc3RyaW5nXTogdW5rbm93biB9O1xuXHRcdHNldFN0YXRlKGRhdGE6IHsgW2tleTogc3RyaW5nXTogdW5rbm93biB9KTogdm9pZDtcblx0XHRwb3N0TWVzc2FnZTogKG1zZzogdW5rbm93bikgPT4gdm9pZDtcblx0fSk7XG59XG5cbmRlY2xhcmUgY2xhc3MgUmVzaXplT2JzZXJ2ZXIge1xuXHRjb25zdHJ1Y3RvcihvbkNoYW5nZTogKGVudHJpZXM6IHsgdGFyZ2V0OiBIVE1MRWxlbWVudDsgY29udGVudFJlY3Q/OiBDbGllbnRSZWN0IH1bXSkgPT4gdm9pZCk7XG5cdG9ic2VydmUoZWxlbWVudDogRWxlbWVudCk6IHZvaWQ7XG5cdGRpc2Nvbm5lY3QoKTogdm9pZDtcbn1cblxuZGVjbGFyZSBjbGFzcyBIaWdobGlnaHQge1xuXHRjb25zdHJ1Y3RvcigpO1xuXHRhZGQocmFuZ2U6IEFic3RyYWN0UmFuZ2UpOiB2b2lkO1xuXHRjbGVhcigpOiB2b2lkO1xuXHRwcmlvcml0eTogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQ1NTSGlnaGxpZ2h0cyB7XG5cdHNldChydWxlOiBzdHJpbmcsIGhpZ2hsaWdodDogSGlnaGxpZ2h0KTogdm9pZDtcbn1cbmRlY2xhcmUgbmFtZXNwYWNlIENTUyB7XG5cdGxldCBoaWdobGlnaHRzOiBDU1NIaWdobGlnaHRzIHwgdW5kZWZpbmVkO1xufVxuXG5cbnR5cGUgTGlzdGVuZXI8VD4gPSB7IGZuOiAoZXZ0OiBUKSA9PiB2b2lkOyB0aGlzQXJnOiB1bmtub3duIH07XG5cbmludGVyZmFjZSBFbWl0dGVyTGlrZTxUPiB7XG5cdGZpcmUoZGF0YTogVCk6IHZvaWQ7XG5cdGV2ZW50OiBFdmVudDxUPjtcbn1cblxuaW50ZXJmYWNlIFByZWxvYWRTdHlsZXMge1xuXHRyZWFkb25seSBvdXRwdXROb2RlUGFkZGluZzogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXROb2RlTGVmdFBhZGRpbmc6IG51bWJlcjtcblx0cmVhZG9ubHkgdG9rZW5pemF0aW9uQ3NzOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJlbG9hZE9wdGlvbnMge1xuXHRkcmFnQW5kRHJvcEVuYWJsZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGxpbmVMaW1pdDogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXRTY3JvbGxpbmc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG91dHB1dFdvcmRXcmFwOiBib29sZWFuO1xuXHRyZWFkb25seSBsaW5raWZ5RmlsZVBhdGhzOiBib29sZWFuO1xuXHRyZWFkb25seSBtaW5pbWFsRXJyb3I6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBQcmVsb2FkQ29udGV4dCB7XG5cdHJlYWRvbmx5IG5vbmNlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHN0eWxlOiBQcmVsb2FkU3R5bGVzO1xuXHRyZWFkb25seSBvcHRpb25zOiBQcmVsb2FkT3B0aW9ucztcblx0cmVhZG9ubHkgcmVuZGVyT3B0aW9uczogUmVuZGVyT3B0aW9ucztcblx0cmVhZG9ubHkgcmVuZGVyZXJEYXRhOiByZWFkb25seSB3ZWJ2aWV3TWVzc2FnZXMuUmVuZGVyZXJNZXRhZGF0YVtdO1xuXHRyZWFkb25seSBzdGF0aWNQcmVsb2Fkc0RhdGE6IHJlYWRvbmx5IHdlYnZpZXdNZXNzYWdlcy5TdGF0aWNQcmVsb2FkTWV0YWRhdGFbXTtcblx0cmVhZG9ubHkgaXNXb3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuO1xufVxuXG5kZWNsYXJlIGZ1bmN0aW9uIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2s6IChhcmdzOiBJZGxlRGVhZGxpbmUpID0+IHZvaWQsIG9wdGlvbnM/OiB7IHRpbWVvdXQ6IG51bWJlciB9KTogbnVtYmVyO1xuZGVjbGFyZSBmdW5jdGlvbiBjYW5jZWxJZGxlQ2FsbGJhY2soaGFuZGxlOiBudW1iZXIpOiB2b2lkO1xuXG5kZWNsYXJlIGZ1bmN0aW9uIF9faW1wb3J0KHBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PjtcblxuYXN5bmMgZnVuY3Rpb24gd2Vidmlld1ByZWxvYWRzKGN0eDogUHJlbG9hZENvbnRleHQpIHtcblxuXHQvKiBlc2xpbnQtZGlzYWJsZSBuby1yZXN0cmljdGVkLWdsb2JhbHMsIG5vLXJlc3RyaWN0ZWQtc3ludGF4ICovXG5cblx0Ly8gVGhlIHVzZSBvZiBnbG9iYWwgYHdpbmRvd2Agc2hvdWxkIGJlIGZpbmUgaW4gdGhpcyBjb250ZXh0LCBldmVuXG5cdC8vIHdpdGggYXV4IHdpbmRvd3MuIFRoaXMgY29kZSBpcyBydW5uaW5nIGZyb20gd2l0aGluIGFuIGBpZnJhbWVgXG5cdC8vIHdoZXJlIHRoZXJlIGlzIG9ubHkgb25lIGB3aW5kb3dgIG9iamVjdCBhbnl3YXkuXG5cblx0Y29uc3QgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudDtcblx0Y29uc3QgaXNDaHJvbWUgPSAodXNlckFnZW50LmluZGV4T2YoJ0Nocm9tZScpID49IDApO1xuXHRjb25zdCB0ZXh0RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXHRjb25zdCB0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXG5cdGZ1bmN0aW9uIHByb21pc2VXaXRoUmVzb2x2ZXJzPFQ+KCk6IHsgcHJvbWlzZTogUHJvbWlzZTxUPjsgcmVzb2x2ZTogKHZhbHVlOiBUIHwgUHJvbWlzZUxpa2U8VD4pID0+IHZvaWQ7IHJlamVjdDogKGVycj86IGFueSkgPT4gdm9pZCB9IHtcblx0XHRsZXQgcmVzb2x2ZTogKHZhbHVlOiBUIHwgUHJvbWlzZUxpa2U8VD4pID0+IHZvaWQ7XG5cdFx0bGV0IHJlamVjdDogKHJlYXNvbj86IGFueSkgPT4gdm9pZDtcblx0XHRjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8VD4oKHJlcywgcmVqKSA9PiB7XG5cdFx0XHRyZXNvbHZlID0gcmVzO1xuXHRcdFx0cmVqZWN0ID0gcmVqO1xuXHRcdH0pO1xuXHRcdHJldHVybiB7IHByb21pc2UsIHJlc29sdmU6IHJlc29sdmUhLCByZWplY3Q6IHJlamVjdCEgfTtcblx0fVxuXG5cdGxldCBjdXJyZW50T3B0aW9ucyA9IGN0eC5vcHRpb25zO1xuXHRjb25zdCBpc1dvcmtzcGFjZVRydXN0ZWQgPSBjdHguaXNXb3Jrc3BhY2VUcnVzdGVkO1xuXHRsZXQgY3VycmVudFJlbmRlck9wdGlvbnMgPSBjdHgucmVuZGVyT3B0aW9ucztcblx0Y29uc3Qgc2V0dGluZ0NoYW5nZTogRW1pdHRlckxpa2U8UmVuZGVyT3B0aW9ucz4gPSBjcmVhdGVFbWl0dGVyPFJlbmRlck9wdGlvbnM+KCk7XG5cblx0Y29uc3QgYWNxdWlyZVZzQ29kZUFwaSA9IGdsb2JhbFRoaXMuYWNxdWlyZVZzQ29kZUFwaTtcblx0Y29uc3QgdnNjb2RlID0gYWNxdWlyZVZzQ29kZUFwaSgpO1xuXHRkZWxldGUgKGdsb2JhbFRoaXMgYXMgYW55KS5hY3F1aXJlVnNDb2RlQXBpO1xuXG5cdGNvbnN0IHRva2VuaXphdGlvblN0eWxlID0gbmV3IENTU1N0eWxlU2hlZXQoKTtcblx0dG9rZW5pemF0aW9uU3R5bGUucmVwbGFjZVN5bmMoY3R4LnN0eWxlLnRva2VuaXphdGlvbkNzcyk7XG5cblx0Y29uc3QgcnVuV2hlbklkbGU6IChjYWxsYmFjazogKGlkbGU6IElkbGVEZWFkbGluZSkgPT4gdm9pZCwgdGltZW91dD86IG51bWJlcikgPT4gSURpc3Bvc2FibGUgPSAodHlwZW9mIHJlcXVlc3RJZGxlQ2FsbGJhY2sgIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIGNhbmNlbElkbGVDYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJylcblx0XHQ/IChydW5uZXIpID0+IHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAoZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZW5kID0gRGF0ZS5ub3coKSArIDE1OyAvLyBvbmUgZnJhbWUgYXQgNjRmcHNcblx0XHRcdFx0cnVubmVyKE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRcdGRpZFRpbWVvdXQ6IHRydWUsXG5cdFx0XHRcdFx0dGltZVJlbWFpbmluZygpIHtcblx0XHRcdFx0XHRcdHJldHVybiBNYXRoLm1heCgwLCBlbmQgLSBEYXRlLm5vdygpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0pO1xuXHRcdFx0bGV0IGRpc3Bvc2VkID0gZmFsc2U7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRcdGlmIChkaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkaXNwb3NlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdDogKHJ1bm5lciwgdGltZW91dD8pID0+IHtcblx0XHRcdGNvbnN0IGhhbmRsZTogbnVtYmVyID0gcmVxdWVzdElkbGVDYWxsYmFjayhydW5uZXIsIHR5cGVvZiB0aW1lb3V0ID09PSAnbnVtYmVyJyA/IHsgdGltZW91dCB9IDogdW5kZWZpbmVkKTtcblx0XHRcdGxldCBkaXNwb3NlZCA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0XHRpZiAoZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGlzcG9zZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGNhbmNlbElkbGVDYWxsYmFjayhoYW5kbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cdGZ1bmN0aW9uIGdldE91dHB1dENvbnRhaW5lcihldmVudDogRm9jdXNFdmVudCB8IE1vdXNlRXZlbnQpIHtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgZXZlbnQuY29tcG9zZWRQYXRoKCkpIHtcblx0XHRcdGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgbm9kZS5jbGFzc0xpc3QuY29udGFpbnMoJ291dHB1dCcpKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6IG5vZGUuaWRcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGxldCBsYXN0Rm9jdXNlZE91dHB1dDogeyBpZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGNvbnN0IGhhbmRsZU91dHB1dEZvY3VzT3V0ID0gKGV2ZW50OiBGb2N1c0V2ZW50KSA9PiB7XG5cdFx0Y29uc3Qgb3V0cHV0Rm9jdXMgPSBldmVudCAmJiBnZXRPdXRwdXRDb250YWluZXIoZXZlbnQpO1xuXHRcdGlmICghb3V0cHV0Rm9jdXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gUG9zc2libGUgd2UncmUgdGFiYmluZyB0aHJvdWdoIHRoZSBlbGVtZW50cyBvZiB0aGUgc2FtZSBvdXRwdXQuXG5cdFx0Ly8gTGV0cyBzZWUgaWYgZm9jdXMgaXMgc2V0IGJhY2sgdG8gdGhlIHNhbWUgb3V0cHV0LlxuXHRcdGxhc3RGb2N1c2VkT3V0cHV0ID0gdW5kZWZpbmVkO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKGxhc3RGb2N1c2VkT3V0cHV0Py5pZCA9PT0gb3V0cHV0Rm9jdXMuaWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dEJsdXJNZXNzYWdlPignb3V0cHV0Qmx1cicsIG91dHB1dEZvY3VzKTtcblx0XHR9LCAwKTtcblx0fTtcblxuXHRjb25zdCBpc0VkaXRhYmxlRWxlbWVudCA9IChlbGVtZW50OiBFbGVtZW50KSA9PiB7XG5cdFx0cmV0dXJuIGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnaW5wdXQnIHx8IGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAndGV4dGFyZWEnXG5cdFx0XHR8fCAoJ2VkaXRDb250ZXh0JyBpbiBlbGVtZW50ICYmICEhZWxlbWVudC5lZGl0Q29udGV4dCk7XG5cdH07XG5cblx0Ly8gY2hlY2sgaWYgYW4gaW5wdXQgZWxlbWVudCBpcyBmb2N1c2VkIHdpdGhpbiB0aGUgb3V0cHV0IGVsZW1lbnRcblx0Y29uc3QgY2hlY2tPdXRwdXRJbnB1dEZvY3VzID0gKGU6IEZvY3VzRXZlbnQpID0+IHtcblx0XHRsYXN0Rm9jdXNlZE91dHB1dCA9IGdldE91dHB1dENvbnRhaW5lcihlKTtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gd2luZG93LmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0aWYgKCFhY3RpdmVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWQgPSBsYXN0Rm9jdXNlZE91dHB1dD8uaWQ7XG5cdFx0aWYgKGlkICYmIChpc0VkaXRhYmxlRWxlbWVudChhY3RpdmVFbGVtZW50KSB8fCBhY3RpdmVFbGVtZW50LnRhZ05hbWUgPT09ICdTRUxFQ1QnKSkge1xuXHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dElucHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0SW5wdXRGb2N1cycsIHsgaW5wdXRGb2N1c2VkOiB0cnVlLCBpZCB9KTtcblxuXHRcdFx0YWN0aXZlRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgKCkgPT4ge1xuXHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JT3V0cHV0SW5wdXRGb2N1c01lc3NhZ2U+KCdvdXRwdXRJbnB1dEZvY3VzJywgeyBpbnB1dEZvY3VzZWQ6IGZhbHNlLCBpZCB9KTtcblx0XHRcdH0sIHsgb25jZTogdHJ1ZSB9KTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgaGFuZGxlSW5uZXJDbGljayA9IChldmVudDogTW91c2VFdmVudCkgPT4ge1xuXHRcdGlmICghZXZlbnQgfHwgIWV2ZW50LnZpZXcgfHwgIWV2ZW50LnZpZXcuZG9jdW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvdXRwdXRGb2N1cyA9IGxhc3RGb2N1c2VkT3V0cHV0ID0gZ2V0T3V0cHV0Q29udGFpbmVyKGV2ZW50KTtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgZXZlbnQuY29tcG9zZWRQYXRoKCkpIHtcblx0XHRcdGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEFuY2hvckVsZW1lbnQgJiYgbm9kZS5ocmVmKSB7XG5cdFx0XHRcdGlmIChub2RlLmhyZWYuc3RhcnRzV2l0aCgnYmxvYjonKSkge1xuXHRcdFx0XHRcdGlmIChvdXRwdXRGb2N1cykge1xuXHRcdFx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dEZvY3VzTWVzc2FnZT4oJ291dHB1dEZvY3VzJywgb3V0cHV0Rm9jdXMpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGhhbmRsZUJsb2JVcmxDbGljayhub2RlLmhyZWYsIG5vZGUuZG93bmxvYWQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5vZGUuaHJlZi5zdGFydHNXaXRoKCdkYXRhOicpKSB7XG5cdFx0XHRcdFx0aWYgKG91dHB1dEZvY3VzKSB7XG5cdFx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JT3V0cHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0Rm9jdXMnLCBvdXRwdXRGb2N1cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGhhbmRsZURhdGFVcmwobm9kZS5ocmVmLCBub2RlLmRvd25sb2FkKTtcblx0XHRcdFx0fSBlbHNlIGlmIChub2RlLmdldEF0dHJpYnV0ZSgnaHJlZicpPy50cmltKCkuc3RhcnRzV2l0aCgnIycpKSB7XG5cdFx0XHRcdFx0Ly8gU2Nyb2xsaW5nIHRvIGxvY2F0aW9uIHdpdGhpbiBjdXJyZW50IGRvY1xuXG5cdFx0XHRcdFx0aWYgKCFub2RlLmhhc2gpIHtcblx0XHRcdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklTY3JvbGxUb1JldmVhbE1lc3NhZ2U+KCdzY3JvbGwtdG8tcmV2ZWFsJywgeyBzY3JvbGxUb3A6IDAgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgdGFyZ2V0SWQgPSBub2RlLmhhc2guc3Vic3RyaW5nKDEpO1xuXG5cdFx0XHRcdFx0Ly8gQ2hlY2sgb3V0ZXIgZG9jdW1lbnQgZmlyc3Rcblx0XHRcdFx0XHRsZXQgc2Nyb2xsVGFyZ2V0OiBFbGVtZW50IHwgbnVsbCB8IHVuZGVmaW5lZCA9IGV2ZW50LnZpZXcuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGFyZ2V0SWQpO1xuXG5cdFx0XHRcdFx0aWYgKCFzY3JvbGxUYXJnZXQpIHtcblx0XHRcdFx0XHRcdC8vIEZhbGxiYWNrIHRvIGNoZWNraW5nIHByZXZpZXcgc2hhZG93IGRvbXNcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgcHJldmlldyBvZiBldmVudC52aWV3LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5wcmV2aWV3JykpIHtcblx0XHRcdFx0XHRcdFx0c2Nyb2xsVGFyZ2V0ID0gcHJldmlldy5zaGFkb3dSb290Py5nZXRFbGVtZW50QnlJZCh0YXJnZXRJZCk7XG5cdFx0XHRcdFx0XHRcdGlmIChzY3JvbGxUYXJnZXQpIHtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChzY3JvbGxUYXJnZXQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHNjcm9sbFRvcCA9IHNjcm9sbFRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3AgKyBldmVudC52aWV3LnNjcm9sbFk7XG5cdFx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JU2Nyb2xsVG9SZXZlYWxNZXNzYWdlPignc2Nyb2xsLXRvLXJldmVhbCcsIHsgc2Nyb2xsVG9wIH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBocmVmID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcblx0XHRcdFx0XHRpZiAoaHJlZikge1xuXHRcdFx0XHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgnY29tbWFuZDonKSAmJiBvdXRwdXRGb2N1cykge1xuXHRcdFx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JT3V0cHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0Rm9jdXMnLCBvdXRwdXRGb2N1cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JQ2xpY2tlZExpbmtNZXNzYWdlPignY2xpY2tlZC1saW5rJywgeyBocmVmIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG91dHB1dEZvY3VzKSB7XG5cdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JT3V0cHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0Rm9jdXMnLCBvdXRwdXRGb2N1cyk7XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IGJsdXJPdXRwdXQgPSAoKSA9PiB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcblx0fTtcblxuXHRjb25zdCBzZWxlY3RPdXRwdXRDb250ZW50cyA9IChjZWxsT3JPdXRwdXRJZDogc3RyaW5nKSA9PiB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNlbGxPdXRwdXRDb250YWluZXIgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY2VsbE9yT3V0cHV0SWQpO1xuXHRcdGlmICghY2VsbE91dHB1dENvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG5cdFx0Y29uc3QgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuXHRcdHJhbmdlLnNlbGVjdE5vZGUoY2VsbE91dHB1dENvbnRhaW5lcik7XG5cdFx0c2VsZWN0aW9uLmFkZFJhbmdlKHJhbmdlKTtcblxuXHR9O1xuXG5cdGNvbnN0IHNlbGVjdElucHV0Q29udGVudHMgPSAoY2VsbE9yT3V0cHV0SWQ6IHN0cmluZykgPT4ge1xuXHRcdGNvbnN0IGNlbGxPdXRwdXRDb250YWluZXIgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY2VsbE9yT3V0cHV0SWQpO1xuXHRcdGlmICghY2VsbE91dHB1dENvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gd2luZG93LmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0aWYgKGFjdGl2ZUVsZW1lbnQgJiYgaXNFZGl0YWJsZUVsZW1lbnQoYWN0aXZlRWxlbWVudCkpIHtcblx0XHRcdChhY3RpdmVFbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnNlbGVjdCgpO1xuXHRcdH1cblx0fTtcblxuXHRjb25zdCBvblBhZ2VVcERvd25TZWxlY3Rpb25IYW5kbGVyID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRpZiAoIWxhc3RGb2N1c2VkT3V0cHV0Py5pZCB8fCAhZS5zaGlmdEtleSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlJ3JlIHByZXNzaW5nIGBTaGlmdCtVcC9Eb3duYCB0aGVuIHdlIHdhbnQgdG8gc2VsZWN0IGEgbGluZSBhdCBhIHRpbWUuXG5cdFx0aWYgKGUuc2hpZnRLZXkgJiYgKGUuY29kZSA9PT0gJ0Fycm93VXAnIHx8IGUuY29kZSA9PT0gJ0Fycm93RG93bicpKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpOyAvLyBXZSBkb24ndCB3YW50IHRoZSBub3RlYm9vayB0byBoYW5kbGUgdGhpcywgZGVmYXVsdCBiZWhhdmlvciBpcyB3aGF0IHdlIG5lZWQuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gV2Ugd2FudCB0byBoYW5kbGUganVzdCBgU2hpZnQgKyBQYWdlVXAvUGFnZURvd25gICYgYFNoaWZ0ICsgQ21kICsgQXJyb3dVcC9BcnJvd0Rvd25gIChmb3IgbWFjKVxuXHRcdGlmICghKGUuY29kZSA9PT0gJ1BhZ2VVcCcgfHwgZS5jb2RlID09PSAnUGFnZURvd24nKSAmJiAhKGUubWV0YUtleSAmJiAoZS5jb2RlID09PSAnQXJyb3dEb3duJyB8fCBlLmNvZGUgPT09ICdBcnJvd1VwJykpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG91dHB1dENvbnRhaW5lciA9IHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChsYXN0Rm9jdXNlZE91dHB1dC5pZCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghb3V0cHV0Q29udGFpbmVyIHx8ICFzZWxlY3Rpb24/LmFuY2hvck5vZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgYWN0aXZlRWxlbWVudCA9IHdpbmRvdy5kb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdGlmIChhY3RpdmVFbGVtZW50ICYmIGlzRWRpdGFibGVFbGVtZW50KGFjdGl2ZUVsZW1lbnQpKSB7XG5cdFx0XHQvLyBMZWF2ZSBmb3IgZGVmYXVsdCBiZWhhdmlvci5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBUaGVzZSBzaG91bGQgY2hhbmdlIHRoZSBzY3JvbGwgcG9zaXRpb24sIG5vdCBhZGp1c3QgdGhlIHNlbGVjdGVkIGNlbGwgaW4gdGhlIG5vdGVib29rXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTsgLy8gV2UgZG9uJ3Qgd2FudCB0aGUgbm90ZWJvb2sgdG8gaGFuZGxlIHRoaXMuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBXZSB3aWxsIGhhbmRsZSBzZWxlY3Rpb24uXG5cblx0XHRjb25zdCB7IGFuY2hvck5vZGUsIGFuY2hvck9mZnNldCB9ID0gc2VsZWN0aW9uO1xuXHRcdGNvbnN0IHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcblx0XHRpZiAoZS5jb2RlID09PSAnUGFnZURvd24nIHx8IGUuY29kZSA9PT0gJ0Fycm93RG93bicpIHtcblx0XHRcdHJhbmdlLnNldFN0YXJ0KGFuY2hvck5vZGUsIGFuY2hvck9mZnNldCk7XG5cdFx0XHRyYW5nZS5zZXRFbmQob3V0cHV0Q29udGFpbmVyLCAxKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRyYW5nZS5zZXRTdGFydChvdXRwdXRDb250YWluZXIsIDApO1xuXHRcdFx0cmFuZ2Uuc2V0RW5kKGFuY2hvck5vZGUsIGFuY2hvck9mZnNldCk7XG5cdFx0fVxuXHRcdHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcblx0XHRzZWxlY3Rpb24uYWRkUmFuZ2UocmFuZ2UpO1xuXHR9O1xuXG5cdGNvbnN0IGRpc2FibGVOYXRpdmVTZWxlY3RBbGwgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdGlmICghbGFzdEZvY3VzZWRPdXRwdXQ/LmlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRpZiAoYWN0aXZlRWxlbWVudCAmJiBpc0VkaXRhYmxlRWxlbWVudChhY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0Ly8gVGhlIGlucHV0IGVsZW1lbnQgd2lsbCBoYW5kbGUgdGhpcy5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoKGUua2V5ID09PSAnYScgJiYgZS5jdHJsS2V5KSB8fCAoZS5tZXRhS2V5ICYmIGUua2V5ID09PSAnYScpKSB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IC8vIFdlIHdpbGwgaGFuZGxlIHNlbGVjdGlvbiBpbiBlZGl0b3IgY29kZS5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgaGFuZGxlRGF0YVVybCA9IGFzeW5jIChkYXRhOiBzdHJpbmcgfCBBcnJheUJ1ZmZlciB8IG51bGwsIGRvd25sb2FkTmFtZTogc3RyaW5nKSA9PiB7XG5cdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSUNsaWNrZWREYXRhVXJsTWVzc2FnZT4oJ2NsaWNrZWQtZGF0YS11cmwnLCB7XG5cdFx0XHRkYXRhLFxuXHRcdFx0ZG93bmxvYWROYW1lXG5cdFx0fSk7XG5cdH07XG5cblx0Y29uc3QgaGFuZGxlQmxvYlVybENsaWNrID0gYXN5bmMgKHVybDogc3RyaW5nLCBkb3dubG9hZE5hbWU6IHN0cmluZykgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCk7XG5cdFx0XHRjb25zdCBibG9iID0gYXdhaXQgcmVzcG9uc2UuYmxvYigpO1xuXHRcdFx0Y29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0XHRcdHJlYWRlci5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuXHRcdFx0XHRoYW5kbGVEYXRhVXJsKHJlYWRlci5yZXN1bHQsIGRvd25sb2FkTmFtZSk7XG5cdFx0XHR9KTtcblx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZS5tZXNzYWdlKTtcblx0XHR9XG5cdH07XG5cblx0d2luZG93LmRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVJbm5lckNsaWNrKTtcblx0d2luZG93LmRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNpbicsIGNoZWNrT3V0cHV0SW5wdXRGb2N1cyk7XG5cdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3Vzb3V0JywgaGFuZGxlT3V0cHV0Rm9jdXNPdXQpO1xuXHR3aW5kb3cuZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25QYWdlVXBEb3duU2VsZWN0aW9uSGFuZGxlcik7XG5cdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBkaXNhYmxlTmF0aXZlU2VsZWN0QWxsKTtcblxuXHRpbnRlcmZhY2UgUmVuZGVyZXJDb250ZXh0IGV4dGVuZHMgcmVuZGVyZXJBcGkuUmVuZGVyZXJDb250ZXh0PHVua25vd24+IHtcblx0XHRyZWFkb25seSBvbkRpZENoYW5nZVNldHRpbmdzOiBFdmVudDxSZW5kZXJPcHRpb25zPjtcblx0XHRyZWFkb25seSBzZXR0aW5nczogUmVuZGVyT3B0aW9ucztcblx0fVxuXG5cdGludGVyZmFjZSBSZW5kZXJlck1vZHVsZSB7XG5cdFx0cmVhZG9ubHkgYWN0aXZhdGU6IHJlbmRlcmVyQXBpLkFjdGl2YXRpb25GdW5jdGlvbjtcblx0fVxuXG5cdGludGVyZmFjZSBLZXJuZWxQcmVsb2FkQ29udGV4dCB7XG5cdFx0cmVhZG9ubHkgb25EaWRSZWNlaXZlS2VybmVsTWVzc2FnZTogRXZlbnQ8dW5rbm93bj47XG5cdFx0cG9zdEtlcm5lbE1lc3NhZ2UoZGF0YTogdW5rbm93bik6IHZvaWQ7XG5cdH1cblxuXHRpbnRlcmZhY2UgS2VybmVsUHJlbG9hZE1vZHVsZSB7XG5cdFx0YWN0aXZhdGUoY3R4OiBLZXJuZWxQcmVsb2FkQ29udGV4dCk6IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuXHR9XG5cblx0aW50ZXJmYWNlIElPYnNlcnZlZEVsZW1lbnQge1xuXHRcdGlkOiBzdHJpbmc7XG5cdFx0b3V0cHV0OiBib29sZWFuO1xuXHRcdGxhc3RLbm93blBhZGRpbmc6IG51bWJlcjtcblx0XHRsYXN0S25vd25IZWlnaHQ6IG51bWJlcjtcblx0XHRjZWxsSWQ6IHN0cmluZztcblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZUtlcm5lbENvbnRleHQoKTogS2VybmVsUHJlbG9hZENvbnRleHQge1xuXHRcdHJldHVybiBPYmplY3QuZnJlZXplKHtcblx0XHRcdG9uRGlkUmVjZWl2ZUtlcm5lbE1lc3NhZ2U6IG9uRGlkUmVjZWl2ZUtlcm5lbE1lc3NhZ2UuZXZlbnQsXG5cdFx0XHRwb3N0S2VybmVsTWVzc2FnZTogKGRhdGE6IHVua25vd24pID0+IHBvc3ROb3RlYm9va01lc3NhZ2UoJ2N1c3RvbUtlcm5lbE1lc3NhZ2UnLCB7IG1lc3NhZ2U6IGRhdGEgfSksXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBydW5LZXJuZWxQcmVsb2FkKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBhY3RpdmF0ZU1vZHVsZUtlcm5lbFByZWxvYWQodXJsKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhY3RpdmF0ZU1vZHVsZUtlcm5lbFByZWxvYWQodXJsOiBzdHJpbmcpIHtcblx0XHRjb25zdCBtb2R1bGU6IEtlcm5lbFByZWxvYWRNb2R1bGUgPSBhd2FpdCBfX2ltcG9ydCh1cmwpO1xuXHRcdGlmICghbW9kdWxlLmFjdGl2YXRlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGBOb3RlYm9vayBwcmVsb2FkICcke3VybH0nIHdhcyBleHBlY3RlZCB0byBiZSBhIG1vZHVsZSBidXQgaXQgZG9lcyBub3QgZXhwb3J0IGFuICdhY3RpdmF0ZScgZnVuY3Rpb25gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIG1vZHVsZS5hY3RpdmF0ZShjcmVhdGVLZXJuZWxDb250ZXh0KCkpO1xuXHR9XG5cblx0Y29uc3QgZGltZW5zaW9uVXBkYXRlciA9IG5ldyBjbGFzcyB7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBwZW5kaW5nID0gbmV3IE1hcDxzdHJpbmcsIHdlYnZpZXdNZXNzYWdlcy5EaW1lbnNpb25VcGRhdGU+KCk7XG5cblx0XHR1cGRhdGVIZWlnaHQoaWQ6IHN0cmluZywgaGVpZ2h0OiBudW1iZXIsIG9wdGlvbnM6IHsgaW5pdD86IGJvb2xlYW47IGlzT3V0cHV0PzogYm9vbGVhbiB9KSB7XG5cdFx0XHRpZiAoIXRoaXMucGVuZGluZy5zaXplKSB7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlSW1tZWRpYXRlbHkoKTtcblx0XHRcdFx0fSwgMCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB1cGRhdGUgPSB0aGlzLnBlbmRpbmcuZ2V0KGlkKTtcblx0XHRcdGlmICh1cGRhdGUgJiYgdXBkYXRlLmlzT3V0cHV0KSB7XG5cdFx0XHRcdHRoaXMucGVuZGluZy5zZXQoaWQsIHtcblx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRoZWlnaHQsXG5cdFx0XHRcdFx0aW5pdDogdXBkYXRlLmluaXQsXG5cdFx0XHRcdFx0aXNPdXRwdXQ6IHVwZGF0ZS5pc091dHB1dFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucGVuZGluZy5zZXQoaWQsIHtcblx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRoZWlnaHQsXG5cdFx0XHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dXBkYXRlSW1tZWRpYXRlbHkoKSB7XG5cdFx0XHRpZiAoIXRoaXMucGVuZGluZy5zaXplKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSURpbWVuc2lvbk1lc3NhZ2U+KCdkaW1lbnNpb24nLCB7XG5cdFx0XHRcdHVwZGF0ZXM6IEFycmF5LmZyb20odGhpcy5wZW5kaW5nLnZhbHVlcygpKVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnBlbmRpbmcuY2xlYXIoKTtcblx0XHR9XG5cdH07XG5cblx0ZnVuY3Rpb24gZWxlbWVudEhhc0NvbnRlbnQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHQvLyB3ZSBuZWVkIHRvIGFjY291bnQgZm9yIGEgcG90ZW50aWFsIDFweCB0b3AgYW5kIGJvdHRvbSBib3JkZXIgb24gYSBjaGlsZCB3aXRoaW4gdGhlIG91dHB1dCBjb250YWluZXJcblx0XHRyZXR1cm4gaGVpZ2h0ID4gMi4xO1xuXHR9XG5cblx0Y29uc3QgcmVzaXplT2JzZXJ2ZXIgPSBuZXcgY2xhc3Mge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyO1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb2JzZXJ2ZWRFbGVtZW50cyA9IG5ldyBXZWFrTWFwPEVsZW1lbnQsIElPYnNlcnZlZEVsZW1lbnQ+KCk7XG5cdFx0cHJpdmF0ZSBfb3V0cHV0UmVzaXplVGltZXI6IGFueTtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoZW50cmllcyA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuXHRcdFx0XHRcdGlmICghd2luZG93LmRvY3VtZW50LmJvZHkuY29udGFpbnMoZW50cnkudGFyZ2V0KSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3Qgb2JzZXJ2ZWRFbGVtZW50SW5mbyA9IHRoaXMuX29ic2VydmVkRWxlbWVudHMuZ2V0KGVudHJ5LnRhcmdldCk7XG5cdFx0XHRcdFx0aWYgKCFvYnNlcnZlZEVsZW1lbnRJbmZvKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLnBvc3RSZXNpemVNZXNzYWdlKG9ic2VydmVkRWxlbWVudEluZm8uY2VsbElkKTtcblxuXHRcdFx0XHRcdGlmIChlbnRyeS50YXJnZXQuaWQgIT09IG9ic2VydmVkRWxlbWVudEluZm8uaWQpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghZW50cnkuY29udGVudFJlY3QpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghb2JzZXJ2ZWRFbGVtZW50SW5mby5vdXRwdXQpIHtcblx0XHRcdFx0XHRcdC8vIG1hcmt1cCwgdXBkYXRlIGRpcmVjdGx5XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUhlaWdodChvYnNlcnZlZEVsZW1lbnRJbmZvLCBlbnRyeS50YXJnZXQub2Zmc2V0SGVpZ2h0KTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGhhc0NvbnRlbnQgPSBlbGVtZW50SGFzQ29udGVudChlbnRyeS5jb250ZW50UmVjdC5oZWlnaHQpO1xuXHRcdFx0XHRcdGNvbnN0IHNob3VsZFVwZGF0ZVBhZGRpbmcgPVxuXHRcdFx0XHRcdFx0KGhhc0NvbnRlbnQgJiYgb2JzZXJ2ZWRFbGVtZW50SW5mby5sYXN0S25vd25QYWRkaW5nID09PSAwKSB8fFxuXHRcdFx0XHRcdFx0KCFoYXNDb250ZW50ICYmIG9ic2VydmVkRWxlbWVudEluZm8ubGFzdEtub3duUGFkZGluZyAhPT0gMCk7XG5cblx0XHRcdFx0XHRpZiAoc2hvdWxkVXBkYXRlUGFkZGluZykge1xuXHRcdFx0XHRcdFx0Ly8gRG8gbm90IHVwZGF0ZSBkaW1lbnNpb24gaW4gcmVzaXplIG9ic2VydmVyXG5cdFx0XHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKGhhc0NvbnRlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRlbnRyeS50YXJnZXQuc3R5bGUucGFkZGluZyA9IGAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlTGVmdFBhZGRpbmd9cHhgO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGVudHJ5LnRhcmdldC5zdHlsZS5wYWRkaW5nID0gYDBweGA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVIZWlnaHQob2JzZXJ2ZWRFbGVtZW50SW5mbywgaGFzQ29udGVudCA/IGVudHJ5LnRhcmdldC5vZmZzZXRIZWlnaHQgOiAwKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUhlaWdodChvYnNlcnZlZEVsZW1lbnRJbmZvLCBoYXNDb250ZW50ID8gZW50cnkudGFyZ2V0Lm9mZnNldEhlaWdodCA6IDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSB1cGRhdGVIZWlnaHQob2JzZXJ2ZWRFbGVtZW50SW5mbzogSU9ic2VydmVkRWxlbWVudCwgb2Zmc2V0SGVpZ2h0OiBudW1iZXIpIHtcblx0XHRcdGlmIChvYnNlcnZlZEVsZW1lbnRJbmZvLmxhc3RLbm93bkhlaWdodCAhPT0gb2Zmc2V0SGVpZ2h0KSB7XG5cdFx0XHRcdG9ic2VydmVkRWxlbWVudEluZm8ubGFzdEtub3duSGVpZ2h0ID0gb2Zmc2V0SGVpZ2h0O1xuXHRcdFx0XHRkaW1lbnNpb25VcGRhdGVyLnVwZGF0ZUhlaWdodChvYnNlcnZlZEVsZW1lbnRJbmZvLmlkLCBvZmZzZXRIZWlnaHQsIHtcblx0XHRcdFx0XHRpc091dHB1dDogb2JzZXJ2ZWRFbGVtZW50SW5mby5vdXRwdXRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHVibGljIG9ic2VydmUoY29udGFpbmVyOiBFbGVtZW50LCBpZDogc3RyaW5nLCBvdXRwdXQ6IGJvb2xlYW4sIGNlbGxJZDogc3RyaW5nKSB7XG5cdFx0XHRpZiAodGhpcy5fb2JzZXJ2ZWRFbGVtZW50cy5oYXMoY29udGFpbmVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29ic2VydmVkRWxlbWVudHMuc2V0KGNvbnRhaW5lciwgeyBpZCwgb3V0cHV0LCBsYXN0S25vd25QYWRkaW5nOiBjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmcsIGxhc3RLbm93bkhlaWdodDogLTEsIGNlbGxJZCB9KTtcblx0XHRcdHRoaXMuX29ic2VydmVyLm9ic2VydmUoY29udGFpbmVyKTtcblx0XHR9XG5cblx0XHRwcml2YXRlIHBvc3RSZXNpemVNZXNzYWdlKGNlbGxJZDogc3RyaW5nKSB7XG5cdFx0XHQvLyBEZWJvdW5jZSB0aGlzIGNhbGxiYWNrIHRvIG9ubHkgaGFwcGVuIGFmdGVyXG5cdFx0XHQvLyAyNTAgbXMuIERvbid0IG5lZWQgcmVzaXplIGV2ZW50cyB0aGF0IG9mdGVuLlxuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX291dHB1dFJlc2l6ZVRpbWVyKTtcblx0XHRcdHRoaXMuX291dHB1dFJlc2l6ZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2UoJ291dHB1dFJlc2l6ZWQnLCB7XG5cdFx0XHRcdFx0Y2VsbElkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSwgMjUwKTtcblxuXHRcdH1cblx0fTtcblxuXHRsZXQgcHJldmlvdXNEZWx0YTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRsZXQgc2Nyb2xsVGltZW91dDogYW55IC8qIE5vZGVKUy5UaW1lb3V0ICovIHwgdW5kZWZpbmVkO1xuXHRsZXQgc2Nyb2xsZWRFbGVtZW50OiBFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRsZXQgbGFzdFRpbWVTY3JvbGxlZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRmdW5jdGlvbiBmbGFnUmVjZW50bHlTY3JvbGxlZChub2RlOiBFbGVtZW50LCBkZWx0YVk/OiBudW1iZXIpIHtcblx0XHRzY3JvbGxlZEVsZW1lbnQgPSBub2RlO1xuXHRcdGlmIChkZWx0YVkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bGFzdFRpbWVTY3JvbGxlZCA9IERhdGUubm93KCk7XG5cdFx0XHRwcmV2aW91c0RlbHRhID0gdW5kZWZpbmVkO1xuXHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGUoJ3JlY2VudGx5U2Nyb2xsZWQnLCAndHJ1ZScpO1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHNjcm9sbFRpbWVvdXQpO1xuXHRcdFx0c2Nyb2xsVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4geyBzY3JvbGxlZEVsZW1lbnQ/LnJlbW92ZUF0dHJpYnV0ZSgncmVjZW50bHlTY3JvbGxlZCcpOyB9LCAzMDApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUuaGFzQXR0cmlidXRlKCdyZWNlbnRseVNjcm9sbGVkJykpIHtcblx0XHRcdGlmIChsYXN0VGltZVNjcm9sbGVkICYmIERhdGUubm93KCkgLSBsYXN0VGltZVNjcm9sbGVkID4gNDAwKSB7XG5cdFx0XHRcdC8vIGl0IGhhcyBiZWVuIGEgd2hpbGUgc2luY2Ugd2UgYWN0dWFsbHkgc2Nyb2xsZWRcblx0XHRcdFx0Ly8gaWYgc2Nyb2xsIHZlbG9jaXR5IGluY3JlYXNlcyBzaWduaWZpY2FudGx5LCBpdCdzIGxpa2VseSBhIG5ldyBzY3JvbGwgZXZlbnRcblx0XHRcdFx0aWYgKCEhcHJldmlvdXNEZWx0YSAmJiBkZWx0YVkgPCAwICYmIGRlbHRhWSA8IHByZXZpb3VzRGVsdGEgLSA4KSB7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHNjcm9sbFRpbWVvdXQpO1xuXHRcdFx0XHRcdHNjcm9sbGVkRWxlbWVudD8ucmVtb3ZlQXR0cmlidXRlKCdyZWNlbnRseVNjcm9sbGVkJyk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCEhcHJldmlvdXNEZWx0YSAmJiBkZWx0YVkgPiAwICYmIGRlbHRhWSA+IHByZXZpb3VzRGVsdGEgKyA4KSB7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHNjcm9sbFRpbWVvdXQpO1xuXHRcdFx0XHRcdHNjcm9sbGVkRWxlbWVudD8ucmVtb3ZlQXR0cmlidXRlKCdyZWNlbnRseVNjcm9sbGVkJyk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gdGhlIHRhaWwgZW5kIG9mIGEgc21vb3RoIHNjcm9sbGluZyBldmVudCAoZnJvbSBhIHRyYWNrcGFkKSBjYW4gZ28gb24gZm9yIGEgd2hpbGVcblx0XHRcdFx0Ly8gc28ga2VlcCBzd2FsbG93aW5nIGl0LCBidXQgd2UgY2FuIHNob3J0ZW4gdGhlIHRpbWVvdXQgc2luY2UgdGhlIGV2ZW50cyBvY2N1ciByYXBpZGx5XG5cdFx0XHRcdGNsZWFyVGltZW91dChzY3JvbGxUaW1lb3V0KTtcblx0XHRcdFx0c2Nyb2xsVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4geyBzY3JvbGxlZEVsZW1lbnQ/LnJlbW92ZUF0dHJpYnV0ZSgncmVjZW50bHlTY3JvbGxlZCcpOyB9LCA1MCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoc2Nyb2xsVGltZW91dCk7XG5cdFx0XHRcdHNjcm9sbFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHsgc2Nyb2xsZWRFbGVtZW50Py5yZW1vdmVBdHRyaWJ1dGUoJ3JlY2VudGx5U2Nyb2xsZWQnKTsgfSwgMzAwKTtcblx0XHRcdH1cblxuXHRcdFx0cHJldmlvdXNEZWx0YSA9IGRlbHRhWTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZ1bmN0aW9uIGV2ZW50VGFyZ2V0U2hvdWxkSGFuZGxlU2Nyb2xsKGV2ZW50OiBXaGVlbEV2ZW50KSB7XG5cdFx0Zm9yIChsZXQgbm9kZSA9IGV2ZW50LnRhcmdldCBhcyBOb2RlIHwgbnVsbDsgbm9kZTsgbm9kZSA9IG5vZGUucGFyZW50Tm9kZSkge1xuXHRcdFx0aWYgKCEobm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHx8IG5vZGUuaWQgPT09ICdjb250YWluZXInIHx8IG5vZGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjZWxsX2NvbnRhaW5lcicpIHx8IG5vZGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdtYXJrdXAnKSB8fCBub2RlLmNsYXNzTGlzdC5jb250YWlucygnb3V0cHV0X2NvbnRhaW5lcicpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gc2Nyb2xsIHVwXG5cdFx0XHRpZiAoZXZlbnQuZGVsdGFZIDwgMCAmJiBub2RlLnNjcm9sbFRvcCA+IDApIHtcblx0XHRcdFx0Ly8gdGhlcmUgaXMgc3RpbGwgc29tZSBjb250ZW50IHRvIHNjcm9sbFxuXHRcdFx0XHRmbGFnUmVjZW50bHlTY3JvbGxlZChub2RlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHNjcm9sbCBkb3duXG5cdFx0XHRpZiAoZXZlbnQuZGVsdGFZID4gMCAmJiBub2RlLnNjcm9sbFRvcCArIG5vZGUuY2xpZW50SGVpZ2h0IDwgbm9kZS5zY3JvbGxIZWlnaHQpIHtcblx0XHRcdFx0Ly8gcGVyIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FbGVtZW50L3Njcm9sbEhlaWdodFxuXHRcdFx0XHQvLyBzY3JvbGxUb3AgaXMgbm90IHJvdW5kZWQgYnV0IHNjcm9sbEhlaWdodCBhbmQgY2xpZW50SGVpZ2h0IGFyZVxuXHRcdFx0XHQvLyBzbyB3ZSBuZWVkIHRvIGNoZWNrIGlmIHRoZSBkaWZmZXJlbmNlIGlzIGxlc3MgdGhhbiBzb21lIHRocmVzaG9sZFxuXHRcdFx0XHRpZiAobm9kZS5zY3JvbGxIZWlnaHQgLSBub2RlLnNjcm9sbFRvcCAtIG5vZGUuY2xpZW50SGVpZ2h0IDwgMikge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gaWYgdGhlIG5vZGUgaXMgbm90IHNjcm9sbGFibGUsIHdlIGNhbiBjb250aW51ZS4gV2UgZG9uJ3QgY2hlY2sgdGhlIGNvbXB1dGVkIHN0eWxlIGFsd2F5cyBhcyBpdCdzIGV4cGVuc2l2ZVxuXHRcdFx0XHRpZiAod2luZG93LmdldENvbXB1dGVkU3R5bGUobm9kZSkub3ZlcmZsb3dZID09PSAnaGlkZGVuJyB8fCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShub2RlKS5vdmVyZmxvd1kgPT09ICd2aXNpYmxlJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZmxhZ1JlY2VudGx5U2Nyb2xsZWQobm9kZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZmxhZ1JlY2VudGx5U2Nyb2xsZWQobm9kZSwgZXZlbnQuZGVsdGFZKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCBoYW5kbGVXaGVlbCA9IChldmVudDogV2hlZWxFdmVudCAmIHsgd2hlZWxEZWx0YVg/OiBudW1iZXI7IHdoZWVsRGVsdGFZPzogbnVtYmVyOyB3aGVlbERlbHRhPzogbnVtYmVyIH0pID0+IHtcblx0XHRpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCB8fCBldmVudFRhcmdldFNob3VsZEhhbmRsZVNjcm9sbChldmVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSVdoZWVsTWVzc2FnZT4oJ2RpZC1zY3JvbGwtd2hlZWwnLCB7XG5cdFx0XHRwYXlsb2FkOiB7XG5cdFx0XHRcdGRlbHRhTW9kZTogZXZlbnQuZGVsdGFNb2RlLFxuXHRcdFx0XHRkZWx0YVg6IGV2ZW50LmRlbHRhWCxcblx0XHRcdFx0ZGVsdGFZOiBldmVudC5kZWx0YVksXG5cdFx0XHRcdGRlbHRhWjogZXZlbnQuZGVsdGFaLFxuXHRcdFx0XHQvLyBSZWZzIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDY0MDMjaXNzdWVjb21tZW50LTE4NTQ1Mzg5Mjhcblx0XHRcdFx0d2hlZWxEZWx0YTogZXZlbnQud2hlZWxEZWx0YSAmJiBpc0Nocm9tZSA/IChldmVudC53aGVlbERlbHRhIC8gd2luZG93LmRldmljZVBpeGVsUmF0aW8pIDogZXZlbnQud2hlZWxEZWx0YSxcblx0XHRcdFx0d2hlZWxEZWx0YVg6IGV2ZW50LndoZWVsRGVsdGFYICYmIGlzQ2hyb21lID8gKGV2ZW50LndoZWVsRGVsdGFYIC8gd2luZG93LmRldmljZVBpeGVsUmF0aW8pIDogZXZlbnQud2hlZWxEZWx0YVgsXG5cdFx0XHRcdHdoZWVsRGVsdGFZOiBldmVudC53aGVlbERlbHRhWSAmJiBpc0Nocm9tZSA/IChldmVudC53aGVlbERlbHRhWSAvIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSA6IGV2ZW50LndoZWVsRGVsdGFZLFxuXHRcdFx0XHRkZXRhaWw6IGV2ZW50LmRldGFpbCxcblx0XHRcdFx0c2hpZnRLZXk6IGV2ZW50LnNoaWZ0S2V5LFxuXHRcdFx0XHR0eXBlOiBldmVudC50eXBlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH07XG5cblx0ZnVuY3Rpb24gZm9jdXNGaXJzdEZvY3VzYWJsZU9yQ29udGFpbmVySW5PdXRwdXQoY2VsbE9yT3V0cHV0SWQ6IHN0cmluZywgYWx0ZXJuYXRlSWQ/OiBzdHJpbmcpIHtcblx0XHRjb25zdCBjZWxsT3V0cHV0Q29udGFpbmVyID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNlbGxPck91dHB1dElkKSA/P1xuXHRcdFx0KGFsdGVybmF0ZUlkID8gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGFsdGVybmF0ZUlkKSA6IHVuZGVmaW5lZCk7XG5cdFx0aWYgKGNlbGxPdXRwdXRDb250YWluZXIpIHtcblx0XHRcdGlmIChjZWxsT3V0cHV0Q29udGFpbmVyLmNvbnRhaW5zKHdpbmRvdy5kb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpZCA9IGNlbGxPdXRwdXRDb250YWluZXIuaWQ7XG5cdFx0XHRsZXQgZm9jdXNhYmxlRWxlbWVudCA9IGNlbGxPdXRwdXRDb250YWluZXIucXVlcnlTZWxlY3RvcignW3RhYmluZGV4PVwiMFwiXSwgW2hyZWZdLCBidXR0b24sIGlucHV0LCBvcHRpb24sIHNlbGVjdCwgdGV4dGFyZWEnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0XHRpZiAoIWZvY3VzYWJsZUVsZW1lbnQpIHtcblx0XHRcdFx0Zm9jdXNhYmxlRWxlbWVudCA9IGNlbGxPdXRwdXRDb250YWluZXI7XG5cdFx0XHRcdGZvY3VzYWJsZUVsZW1lbnQudGFiSW5kZXggPSAtMTtcblx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dElucHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0SW5wdXRGb2N1cycsIHsgaW5wdXRGb2N1c2VkOiBmYWxzZSwgaWQgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBpbnB1dEZvY3VzZWQgPSBpc0VkaXRhYmxlRWxlbWVudChmb2N1c2FibGVFbGVtZW50KTtcblx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dElucHV0Rm9jdXNNZXNzYWdlPignb3V0cHV0SW5wdXRGb2N1cycsIHsgaW5wdXRGb2N1c2VkLCBpZCB9KTtcblx0XHRcdH1cblxuXHRcdFx0bGFzdEZvY3VzZWRPdXRwdXQgPSBjZWxsT3V0cHV0Q29udGFpbmVyO1xuXHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU91dHB1dEZvY3VzTWVzc2FnZT4oJ291dHB1dEZvY3VzJywgeyBpZDogY2VsbE91dHB1dENvbnRhaW5lci5pZCB9KTtcblx0XHRcdGZvY3VzYWJsZUVsZW1lbnQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVGb2N1c1NpbmsoY2VsbElkOiBzdHJpbmcsIGZvY3VzTmV4dD86IGJvb2xlYW4pIHtcblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZWxlbWVudC5pZCA9IGBmb2N1cy1zaW5rLSR7Y2VsbElkfWA7XG5cdFx0ZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsICgpID0+IHtcblx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklGb2N1c0VkaXRvck1lc3NhZ2U+KCdmb2N1cy1lZGl0b3InLCB7XG5cdFx0XHRcdGNlbGxJZDogY2VsbElkLFxuXHRcdFx0XHRmb2N1c05leHRcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdH1cblxuXHRmdW5jdGlvbiBfaW50ZXJuYWxIaWdobGlnaHRSYW5nZShyYW5nZTogUmFuZ2UsIHRhZ05hbWUgPSAnbWFyaycsIGF0dHJpYnV0ZXMgPSB7fSkge1xuXHRcdC8vIGRlcml2ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vVHJlb3JhL2RvbS1oaWdobGlnaHQtcmFuZ2UvYmxvYi9tYXN0ZXIvaGlnaGxpZ2h0LXJhbmdlLmpzXG5cblx0XHQvLyBSZXR1cm4gYW4gYXJyYXkgb2YgdGhlIHRleHQgbm9kZXMgaW4gdGhlIHJhbmdlLiBTcGxpdCB0aGUgc3RhcnQgYW5kIGVuZCBub2RlcyBpZiByZXF1aXJlZC5cblx0XHRmdW5jdGlvbiBfdGV4dE5vZGVzSW5SYW5nZShyYW5nZTogUmFuZ2UpOiBUZXh0W10ge1xuXHRcdFx0aWYgKCFyYW5nZS5zdGFydENvbnRhaW5lci5vd25lckRvY3VtZW50KSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlIHN0YXJ0IG9yIGVuZCBub2RlIGlzIGEgdGV4dCBub2RlIGFuZCBvbmx5IHBhcnRseSBpbiB0aGUgcmFuZ2UsIHNwbGl0IGl0LlxuXHRcdFx0aWYgKHJhbmdlLnN0YXJ0Q29udGFpbmVyLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSAmJiByYW5nZS5zdGFydE9mZnNldCA+IDApIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnRDb250YWluZXIgPSByYW5nZS5zdGFydENvbnRhaW5lciBhcyBUZXh0O1xuXHRcdFx0XHRjb25zdCBlbmRPZmZzZXQgPSByYW5nZS5lbmRPZmZzZXQ7IC8vICh0aGlzIG1heSBnZXQgbG9zdCB3aGVuIHRoZSBzcGxpdHRpbmcgdGhlIG5vZGUpXG5cdFx0XHRcdGNvbnN0IGNyZWF0ZWROb2RlID0gc3RhcnRDb250YWluZXIuc3BsaXRUZXh0KHJhbmdlLnN0YXJ0T2Zmc2V0KTtcblx0XHRcdFx0aWYgKHJhbmdlLmVuZENvbnRhaW5lciA9PT0gc3RhcnRDb250YWluZXIpIHtcblx0XHRcdFx0XHQvLyBJZiB0aGUgZW5kIHdhcyBpbiB0aGUgc2FtZSBjb250YWluZXIsIGl0IHdpbGwgbm93IGJlIGluIHRoZSBuZXdseSBjcmVhdGVkIG5vZGUuXG5cdFx0XHRcdFx0cmFuZ2Uuc2V0RW5kKGNyZWF0ZWROb2RlLCBlbmRPZmZzZXQgLSByYW5nZS5zdGFydE9mZnNldCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyYW5nZS5zZXRTdGFydChjcmVhdGVkTm9kZSwgMCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0cmFuZ2UuZW5kQ29udGFpbmVyLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERVxuXHRcdFx0XHQmJiByYW5nZS5lbmRPZmZzZXQgPCAocmFuZ2UuZW5kQ29udGFpbmVyIGFzIFRleHQpLmxlbmd0aFxuXHRcdFx0KSB7XG5cdFx0XHRcdChyYW5nZS5lbmRDb250YWluZXIgYXMgVGV4dCkuc3BsaXRUZXh0KHJhbmdlLmVuZE9mZnNldCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbGxlY3QgdGhlIHRleHQgbm9kZXMuXG5cdFx0XHRjb25zdCB3YWxrZXIgPSByYW5nZS5zdGFydENvbnRhaW5lci5vd25lckRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoXG5cdFx0XHRcdHJhbmdlLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyLFxuXHRcdFx0XHROb2RlRmlsdGVyLlNIT1dfVEVYVCxcblx0XHRcdFx0bm9kZSA9PiByYW5nZS5pbnRlcnNlY3RzTm9kZShub2RlKSA/IE5vZGVGaWx0ZXIuRklMVEVSX0FDQ0VQVCA6IE5vZGVGaWx0ZXIuRklMVEVSX1JFSkVDVCxcblx0XHRcdCk7XG5cblx0XHRcdHdhbGtlci5jdXJyZW50Tm9kZSA9IHJhbmdlLnN0YXJ0Q29udGFpbmVyO1xuXG5cdFx0XHQvLyAvLyBPcHRpbWlzZSBieSBza2lwcGluZyBub2RlcyB0aGF0IGFyZSBleHBsaWNpdGx5IG91dHNpZGUgdGhlIHJhbmdlLlxuXHRcdFx0Ly8gY29uc3QgTm9kZVR5cGVzV2l0aENoYXJhY3Rlck9mZnNldCA9IFtcblx0XHRcdC8vICBOb2RlLlRFWFRfTk9ERSxcblx0XHRcdC8vICBOb2RlLlBST0NFU1NJTkdfSU5TVFJVQ1RJT05fTk9ERSxcblx0XHRcdC8vICBOb2RlLkNPTU1FTlRfTk9ERSxcblx0XHRcdC8vIF07XG5cdFx0XHQvLyBpZiAoIU5vZGVUeXBlc1dpdGhDaGFyYWN0ZXJPZmZzZXQuaW5jbHVkZXMocmFuZ2Uuc3RhcnRDb250YWluZXIubm9kZVR5cGUpKSB7XG5cdFx0XHQvLyAgIGlmIChyYW5nZS5zdGFydE9mZnNldCA8IHJhbmdlLnN0YXJ0Q29udGFpbmVyLmNoaWxkTm9kZXMubGVuZ3RoKSB7XG5cdFx0XHQvLyAgICAgd2Fsa2VyLmN1cnJlbnROb2RlID0gcmFuZ2Uuc3RhcnRDb250YWluZXIuY2hpbGROb2Rlc1tyYW5nZS5zdGFydE9mZnNldF07XG5cdFx0XHQvLyAgIH0gZWxzZSB7XG5cdFx0XHQvLyAgICAgd2Fsa2VyLm5leHRTaWJsaW5nKCk7IC8vIFRPRE8gdmVyaWZ5IHRoaXMgaXMgY29ycmVjdC5cblx0XHRcdC8vICAgfVxuXHRcdFx0Ly8gfVxuXG5cdFx0XHRjb25zdCBub2RlczogVGV4dFtdID0gW107XG5cdFx0XHRpZiAod2Fsa2VyLmN1cnJlbnROb2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuXHRcdFx0XHRub2Rlcy5wdXNoKHdhbGtlci5jdXJyZW50Tm9kZSBhcyBUZXh0KTtcblx0XHRcdH1cblxuXHRcdFx0d2hpbGUgKHdhbGtlci5uZXh0Tm9kZSgpICYmIHJhbmdlLmNvbXBhcmVQb2ludCh3YWxrZXIuY3VycmVudE5vZGUsIDApICE9PSAxKSB7XG5cdFx0XHRcdGlmICh3YWxrZXIuY3VycmVudE5vZGUubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFKSB7XG5cdFx0XHRcdFx0bm9kZXMucHVzaCh3YWxrZXIuY3VycmVudE5vZGUgYXMgVGV4dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5vZGVzO1xuXHRcdH1cblxuXHRcdC8vIFJlcGxhY2UgW25vZGVdIHdpdGggPHRhZ05hbWUgLi4uYXR0cmlidXRlcz5bbm9kZV08L3RhZ05hbWU+XG5cdFx0ZnVuY3Rpb24gd3JhcE5vZGVJbkhpZ2hsaWdodChub2RlOiBUZXh0LCB0YWdOYW1lOiBzdHJpbmcsIGF0dHJpYnV0ZXM6IGFueSkge1xuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0RWxlbWVudCA9IG5vZGUub3duZXJEb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuXHRcdFx0T2JqZWN0LmtleXMoYXR0cmlidXRlcykuZm9yRWFjaChrZXkgPT4ge1xuXHRcdFx0XHRoaWdobGlnaHRFbGVtZW50LnNldEF0dHJpYnV0ZShrZXksIGF0dHJpYnV0ZXNba2V5XSk7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHRlbXBSYW5nZSA9IG5vZGUub3duZXJEb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuXHRcdFx0dGVtcFJhbmdlLnNlbGVjdE5vZGUobm9kZSk7XG5cdFx0XHR0ZW1wUmFuZ2Uuc3Vycm91bmRDb250ZW50cyhoaWdobGlnaHRFbGVtZW50KTtcblx0XHRcdHJldHVybiBoaWdobGlnaHRFbGVtZW50O1xuXHRcdH1cblxuXHRcdGlmIChyYW5nZS5jb2xsYXBzZWQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlbW92ZTogKCkgPT4geyB9LFxuXHRcdFx0XHR1cGRhdGU6ICgpID0+IHsgfVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBGaXJzdCBwdXQgYWxsIG5vZGVzIGluIGFuIGFycmF5IChzcGxpdHMgc3RhcnQgYW5kIGVuZCBub2RlcyBpZiBuZWVkZWQpXG5cdFx0Y29uc3Qgbm9kZXMgPSBfdGV4dE5vZGVzSW5SYW5nZShyYW5nZSk7XG5cblx0XHQvLyBIaWdobGlnaHQgZWFjaCBub2RlXG5cdFx0Y29uc3QgaGlnaGxpZ2h0RWxlbWVudHM6IEVsZW1lbnRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgbm9kZUlkeCBpbiBub2Rlcykge1xuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0RWxlbWVudCA9IHdyYXBOb2RlSW5IaWdobGlnaHQobm9kZXNbbm9kZUlkeF0sIHRhZ05hbWUsIGF0dHJpYnV0ZXMpO1xuXHRcdFx0aGlnaGxpZ2h0RWxlbWVudHMucHVzaChoaWdobGlnaHRFbGVtZW50KTtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgYSBoaWdobGlnaHQgZWxlbWVudCBjcmVhdGVkIHdpdGggd3JhcE5vZGVJbkhpZ2hsaWdodC5cblx0XHRmdW5jdGlvbiBfcmVtb3ZlSGlnaGxpZ2h0KGhpZ2hsaWdodEVsZW1lbnQ6IEVsZW1lbnQpIHtcblx0XHRcdGlmIChoaWdobGlnaHRFbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdGhpZ2hsaWdodEVsZW1lbnQucGFyZW50Tm9kZT8ucmVwbGFjZUNoaWxkKGhpZ2hsaWdodEVsZW1lbnQuZmlyc3RDaGlsZCEsIGhpZ2hsaWdodEVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gSWYgdGhlIGhpZ2hsaWdodCBzb21laG93IGNvbnRhaW5zIG11bHRpcGxlIG5vZGVzIG5vdywgbW92ZSB0aGVtIGFsbC5cblx0XHRcdFx0d2hpbGUgKGhpZ2hsaWdodEVsZW1lbnQuZmlyc3RDaGlsZCkge1xuXHRcdFx0XHRcdGhpZ2hsaWdodEVsZW1lbnQucGFyZW50Tm9kZT8uaW5zZXJ0QmVmb3JlKGhpZ2hsaWdodEVsZW1lbnQuZmlyc3RDaGlsZCwgaGlnaGxpZ2h0RWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aGlnaGxpZ2h0RWxlbWVudC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZXR1cm4gYSBmdW5jdGlvbiB0aGF0IGNsZWFucyB1cCB0aGUgaGlnaGxpZ2h0RWxlbWVudHMuXG5cdFx0ZnVuY3Rpb24gX3JlbW92ZUhpZ2hsaWdodHMoKSB7XG5cdFx0XHQvLyBSZW1vdmUgZWFjaCBvZiB0aGUgY3JlYXRlZCBoaWdobGlnaHRFbGVtZW50cy5cblx0XHRcdGZvciAoY29uc3QgaGlnaGxpZ2h0SWR4IGluIGhpZ2hsaWdodEVsZW1lbnRzKSB7XG5cdFx0XHRcdF9yZW1vdmVIaWdobGlnaHQoaGlnaGxpZ2h0RWxlbWVudHNbaGlnaGxpZ2h0SWR4XSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gX3VwZGF0ZUhpZ2hsaWdodChoaWdobGlnaHRFbGVtZW50OiBFbGVtZW50LCBhdHRyaWJ1dGVzOiBhbnkgPSB7fSkge1xuXHRcdFx0T2JqZWN0LmtleXMoYXR0cmlidXRlcykuZm9yRWFjaChrZXkgPT4ge1xuXHRcdFx0XHRoaWdobGlnaHRFbGVtZW50LnNldEF0dHJpYnV0ZShrZXksIGF0dHJpYnV0ZXNba2V5XSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVIaWdobGlnaHRzKGF0dHJpYnV0ZXM6IGFueSkge1xuXHRcdFx0Zm9yIChjb25zdCBoaWdobGlnaHRJZHggaW4gaGlnaGxpZ2h0RWxlbWVudHMpIHtcblx0XHRcdFx0X3VwZGF0ZUhpZ2hsaWdodChoaWdobGlnaHRFbGVtZW50c1toaWdobGlnaHRJZHhdLCBhdHRyaWJ1dGVzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVtb3ZlOiBfcmVtb3ZlSGlnaGxpZ2h0cyxcblx0XHRcdHVwZGF0ZTogdXBkYXRlSGlnaGxpZ2h0c1xuXHRcdH07XG5cdH1cblxuXHRpbnRlcmZhY2UgSUNvbW1vblJhbmdlIHtcblx0XHRjb2xsYXBzZWQ6IGJvb2xlYW47XG5cdFx0Y29tbW9uQW5jZXN0b3JDb250YWluZXI6IE5vZGU7XG5cdFx0ZW5kQ29udGFpbmVyOiBOb2RlO1xuXHRcdGVuZE9mZnNldDogbnVtYmVyO1xuXHRcdHN0YXJ0Q29udGFpbmVyOiBOb2RlO1xuXHRcdHN0YXJ0T2Zmc2V0OiBudW1iZXI7XG5cblx0fVxuXG5cdGludGVyZmFjZSBJSGlnaGxpZ2h0UmVzdWx0IHtcblx0XHRyYW5nZTogSUNvbW1vblJhbmdlO1xuXHRcdGRpc3Bvc2U6ICgpID0+IHZvaWQ7XG5cdFx0dXBkYXRlOiAoY29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgY2xhc3NOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHZvaWQ7XG5cdH1cblxuXHRmdW5jdGlvbiBzZWxlY3RSYW5nZShfcmFuZ2U6IElDb21tb25SYW5nZSkge1xuXHRcdGNvbnN0IHNlbCA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoc2VsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG5cdFx0XHRcdGNvbnN0IHIgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuXHRcdFx0XHRyLnNldFN0YXJ0KF9yYW5nZS5zdGFydENvbnRhaW5lciwgX3JhbmdlLnN0YXJ0T2Zmc2V0KTtcblx0XHRcdFx0ci5zZXRFbmQoX3JhbmdlLmVuZENvbnRhaW5lciwgX3JhbmdlLmVuZE9mZnNldCk7XG5cdFx0XHRcdHNlbC5hZGRSYW5nZShyKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gaGlnaGxpZ2h0UmFuZ2UocmFuZ2U6IFJhbmdlLCB1c2VDdXN0b206IGJvb2xlYW4sIHRhZ05hbWUgPSAnbWFyaycsIGF0dHJpYnV0ZXMgPSB7fSk6IElIaWdobGlnaHRSZXN1bHQge1xuXHRcdGlmICh1c2VDdXN0b20pIHtcblx0XHRcdGNvbnN0IHJldCA9IF9pbnRlcm5hbEhpZ2hsaWdodFJhbmdlKHJhbmdlLCB0YWdOYW1lLCBhdHRyaWJ1dGVzKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiByYW5nZSxcblx0XHRcdFx0ZGlzcG9zZTogcmV0LnJlbW92ZSxcblx0XHRcdFx0dXBkYXRlOiAoY29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgY2xhc3NOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0XHRpZiAoY2xhc3NOYW1lID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJldC51cGRhdGUoe1xuXHRcdFx0XHRcdFx0XHQnc3R5bGUnOiBgYmFja2dyb3VuZC1jb2xvcjogJHtjb2xvcn1gXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0LnVwZGF0ZSh7XG5cdFx0XHRcdFx0XHRcdCdjbGFzcyc6IGNsYXNzTmFtZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3aW5kb3cuZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2hpbGl0ZUNvbG9yJywgZmFsc2UsIG1hdGNoQ29sb3IpO1xuXHRcdFx0Y29uc3QgY2xvbmVSYW5nZSA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKSEuZ2V0UmFuZ2VBdCgwKS5jbG9uZVJhbmdlKCk7XG5cdFx0XHRjb25zdCBfcmFuZ2UgPSB7XG5cdFx0XHRcdGNvbGxhcHNlZDogY2xvbmVSYW5nZS5jb2xsYXBzZWQsXG5cdFx0XHRcdGNvbW1vbkFuY2VzdG9yQ29udGFpbmVyOiBjbG9uZVJhbmdlLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyLFxuXHRcdFx0XHRlbmRDb250YWluZXI6IGNsb25lUmFuZ2UuZW5kQ29udGFpbmVyLFxuXHRcdFx0XHRlbmRPZmZzZXQ6IGNsb25lUmFuZ2UuZW5kT2Zmc2V0LFxuXHRcdFx0XHRzdGFydENvbnRhaW5lcjogY2xvbmVSYW5nZS5zdGFydENvbnRhaW5lcixcblx0XHRcdFx0c3RhcnRPZmZzZXQ6IGNsb25lUmFuZ2Uuc3RhcnRPZmZzZXRcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyYW5nZTogX3JhbmdlLFxuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdFx0c2VsZWN0UmFuZ2UoX3JhbmdlKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZG9jdW1lbnQuZGVzaWduTW9kZSA9ICdPbic7XG5cdFx0XHRcdFx0XHR3aW5kb3cuZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ3JlbW92ZUZvcm1hdCcsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0ZG9jdW1lbnQuZGVzaWduTW9kZSA9ICdPZmYnO1xuXHRcdFx0XHRcdFx0d2luZG93LmdldFNlbGVjdGlvbigpPy5yZW1vdmVBbGxSYW5nZXMoKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVwZGF0ZTogKGNvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNsYXNzTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRcdFx0c2VsZWN0UmFuZ2UoX3JhbmdlKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZG9jdW1lbnQuZGVzaWduTW9kZSA9ICdPbic7XG5cdFx0XHRcdFx0XHR3aW5kb3cuZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ3JlbW92ZUZvcm1hdCcsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0d2luZG93LmRvY3VtZW50LmV4ZWNDb21tYW5kKCdoaWxpdGVDb2xvcicsIGZhbHNlLCBjb2xvcik7XG5cdFx0XHRcdFx0XHRkb2N1bWVudC5kZXNpZ25Nb2RlID0gJ09mZic7XG5cdFx0XHRcdFx0XHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCk/LnJlbW92ZUFsbFJhbmdlcygpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVFbWl0dGVyPFQ+KGxpc3RlbmVyQ2hhbmdlOiAobGlzdGVuZXJzOiBTZXQ8TGlzdGVuZXI8VD4+KSA9PiB2b2lkID0gKCkgPT4gdW5kZWZpbmVkKTogRW1pdHRlckxpa2U8VD4ge1xuXHRcdGNvbnN0IGxpc3RlbmVycyA9IG5ldyBTZXQ8TGlzdGVuZXI8VD4+KCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZpcmUoZGF0YSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIFsuLi5saXN0ZW5lcnNdKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXIuZm4uY2FsbChsaXN0ZW5lci50aGlzQXJnLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGV2ZW50KGZuLCB0aGlzQXJnLCBkaXNwb3NhYmxlcykge1xuXHRcdFx0XHRjb25zdCBsaXN0ZW5lck9iaiA9IHsgZm4sIHRoaXNBcmcgfTtcblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgPSB7XG5cdFx0XHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRcdFx0bGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lck9iaik7XG5cdFx0XHRcdFx0XHRsaXN0ZW5lckNoYW5nZShsaXN0ZW5lcnMpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0bGlzdGVuZXJzLmFkZChsaXN0ZW5lck9iaik7XG5cdFx0XHRcdGxpc3RlbmVyQ2hhbmdlKGxpc3RlbmVycyk7XG5cblx0XHRcdFx0aWYgKGRpc3Bvc2FibGVzIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5wdXNoKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGRpc3Bvc2FibGU7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93UmVuZGVyRXJyb3IoZXJyb3JUZXh0OiBzdHJpbmcsIG91dHB1dE5vZGU6IEhUTUxFbGVtZW50LCBlcnJvcnM6IHJlYWRvbmx5IEVycm9yW10pIHtcblx0XHRvdXRwdXROb2RlLmlubmVyVGV4dCA9IGVycm9yVGV4dDtcblx0XHRjb25zdCBlcnJMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiBlcnJvcnMpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IocmVzdWx0KTtcblx0XHRcdGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuXHRcdFx0aXRlbS5pbm5lclRleHQgPSByZXN1bHQubWVzc2FnZTtcblx0XHRcdGVyckxpc3QuYXBwZW5kQ2hpbGQoaXRlbSk7XG5cdFx0fVxuXHRcdG91dHB1dE5vZGUuYXBwZW5kQ2hpbGQoZXJyTGlzdCk7XG5cdH1cblxuXHRjb25zdCBvdXRwdXRJdGVtUmVxdWVzdHMgPSBuZXcgY2xhc3Mge1xuXHRcdHByaXZhdGUgX3JlcXVlc3RQb29sID0gMDtcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0cyA9IG5ldyBNYXA8LypyZXF1ZXN0SWQqL251bWJlciwgeyByZXNvbHZlOiAoeDogd2Vidmlld01lc3NhZ2VzLk91dHB1dEl0ZW1FbnRyeSB8IHVuZGVmaW5lZCkgPT4gdm9pZCB9PigpO1xuXG5cdFx0Z2V0T3V0cHV0SXRlbShvdXRwdXRJZDogc3RyaW5nLCBtaW1lOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IHJlcXVlc3RJZCA9IHRoaXMuX3JlcXVlc3RQb29sKys7XG5cblx0XHRcdGNvbnN0IHsgcHJvbWlzZSwgcmVzb2x2ZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8d2Vidmlld01lc3NhZ2VzLk91dHB1dEl0ZW1FbnRyeSB8IHVuZGVmaW5lZD4oKTtcblx0XHRcdHRoaXMuX3JlcXVlc3RzLnNldChyZXF1ZXN0SWQsIHsgcmVzb2x2ZSB9KTtcblxuXHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSUdldE91dHB1dEl0ZW1NZXNzYWdlPignZ2V0T3V0cHV0SXRlbScsIHsgcmVxdWVzdElkLCBvdXRwdXRJZCwgbWltZSB9KTtcblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH1cblxuXHRcdHJlc29sdmVPdXRwdXRJdGVtKHJlcXVlc3RJZDogbnVtYmVyLCBvdXRwdXQ6IHdlYnZpZXdNZXNzYWdlcy5PdXRwdXRJdGVtRW50cnkgfCB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHJlcXVlc3QgPSB0aGlzLl9yZXF1ZXN0cy5nZXQocmVxdWVzdElkKTtcblx0XHRcdGlmICghcmVxdWVzdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlcXVlc3RzLmRlbGV0ZShyZXF1ZXN0SWQpO1xuXHRcdFx0cmVxdWVzdC5yZXNvbHZlKG91dHB1dCk7XG5cdFx0fVxuXHR9O1xuXG5cdGludGVyZmFjZSBBZGRpdGlvbmFsT3V0cHV0SXRlbUluZm8ge1xuXHRcdHJlYWRvbmx5IG1pbWU6IHN0cmluZztcblx0XHRnZXRJdGVtKCk6IFByb21pc2U8cmVuZGVyZXJBcGkuT3V0cHV0SXRlbSB8IHVuZGVmaW5lZD47XG5cdH1cblxuXHRpbnRlcmZhY2UgRXh0ZW5kZWRPdXRwdXRJdGVtIGV4dGVuZHMgcmVuZGVyZXJBcGkuT3V0cHV0SXRlbSB7XG5cdFx0cmVhZG9ubHkgX2FsbE91dHB1dEl0ZW1zOiBSZWFkb25seUFycmF5PEFkZGl0aW9uYWxPdXRwdXRJdGVtSW5mbz47XG5cdFx0YXBwZW5kZWRUZXh0PygpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdH1cblxuXHRsZXQgaGFzV2FybmVkQWJvdXRBbGxPdXRwdXRJdGVtc1Byb3Bvc2FsID0gZmFsc2U7XG5cblx0ZnVuY3Rpb24gY3JlYXRlT3V0cHV0SXRlbShcblx0XHRpZDogc3RyaW5nLFxuXHRcdG1pbWU6IHN0cmluZyxcblx0XHRtZXRhZGF0YTogdW5rbm93bixcblx0XHR2YWx1ZUJ5dGVzOiBVaW50OEFycmF5LFxuXHRcdGFsbE91dHB1dEl0ZW1EYXRhOiBSZWFkb25seUFycmF5PHsgcmVhZG9ubHkgbWltZTogc3RyaW5nIH0+LFxuXHRcdGFwcGVuZGVkPzogeyB2YWx1ZUJ5dGVzOiBVaW50OEFycmF5OyBwcmV2aW91c1ZlcnNpb246IG51bWJlciB9XG5cdCk6IEV4dGVuZGVkT3V0cHV0SXRlbSB7XG5cblx0XHRmdW5jdGlvbiBjcmVhdGUoXG5cdFx0XHRpZDogc3RyaW5nLFxuXHRcdFx0bWltZTogc3RyaW5nLFxuXHRcdFx0bWV0YWRhdGE6IHVua25vd24sXG5cdFx0XHR2YWx1ZUJ5dGVzOiBVaW50OEFycmF5LFxuXHRcdFx0YXBwZW5kZWQ/OiB7IHZhbHVlQnl0ZXM6IFVpbnQ4QXJyYXk7IHByZXZpb3VzVmVyc2lvbjogbnVtYmVyIH1cblx0XHQpOiBFeHRlbmRlZE91dHB1dEl0ZW0ge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemU8RXh0ZW5kZWRPdXRwdXRJdGVtPih7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRtaW1lLFxuXHRcdFx0XHRtZXRhZGF0YSxcblxuXHRcdFx0XHRhcHBlbmRlZFRleHQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0XHRpZiAoYXBwZW5kZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0ZXh0RGVjb2Rlci5kZWNvZGUoYXBwZW5kZWQudmFsdWVCeXRlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0sXG5cblx0XHRcdFx0ZGF0YSgpOiBVaW50OEFycmF5IHtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWVCeXRlcztcblx0XHRcdFx0fSxcblxuXHRcdFx0XHR0ZXh0KCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0cmV0dXJuIHRleHREZWNvZGVyLmRlY29kZSh2YWx1ZUJ5dGVzKTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRqc29uKCkge1xuXHRcdFx0XHRcdHJldHVybiBKU09OLnBhcnNlKHRoaXMudGV4dCgpKTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRibG9iKCk6IEJsb2Ige1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQmxvYihbdmFsdWVCeXRlc10sIHsgdHlwZTogdGhpcy5taW1lIH0pO1xuXHRcdFx0XHR9LFxuXG5cdFx0XHRcdGdldCBfYWxsT3V0cHV0SXRlbXMoKSB7XG5cdFx0XHRcdFx0aWYgKCFoYXNXYXJuZWRBYm91dEFsbE91dHB1dEl0ZW1zUHJvcG9zYWwpIHtcblx0XHRcdFx0XHRcdGhhc1dhcm5lZEFib3V0QWxsT3V0cHV0SXRlbXNQcm9wb3NhbCA9IHRydWU7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYCdfYWxsT3V0cHV0SXRlbXMnIGlzIHByb3Bvc2VkIEFQSS4gRE8gTk9UIHNoaXAgYW4gZXh0ZW5zaW9uIHRoYXQgZGVwZW5kcyBvbiBpdCFgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGFsbE91dHB1dEl0ZW1MaXN0O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsT3V0cHV0SXRlbUNhY2hlID0gbmV3IE1hcDwvKm1pbWUqL3N0cmluZywgUHJvbWlzZTwocmVuZGVyZXJBcGkuT3V0cHV0SXRlbSAmIEV4dGVuZGVkT3V0cHV0SXRlbSkgfCB1bmRlZmluZWQ+PigpO1xuXHRcdGNvbnN0IGFsbE91dHB1dEl0ZW1MaXN0ID0gT2JqZWN0LmZyZWV6ZShhbGxPdXRwdXRJdGVtRGF0YS5tYXAob3V0cHV0SXRlbSA9PiB7XG5cdFx0XHRjb25zdCBtaW1lID0gb3V0cHV0SXRlbS5taW1lO1xuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRtaW1lLFxuXHRcdFx0XHRnZXRJdGVtKCkge1xuXHRcdFx0XHRcdGNvbnN0IGV4aXN0aW5nVGFzayA9IGFsbE91dHB1dEl0ZW1DYWNoZS5nZXQobWltZSk7XG5cdFx0XHRcdFx0aWYgKGV4aXN0aW5nVGFzaykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGV4aXN0aW5nVGFzaztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB0YXNrID0gb3V0cHV0SXRlbVJlcXVlc3RzLmdldE91dHB1dEl0ZW0oaWQsIG1pbWUpLnRoZW4oaXRlbSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXRlbSA/IGNyZWF0ZShpZCwgaXRlbS5taW1lLCBtZXRhZGF0YSwgaXRlbS52YWx1ZUJ5dGVzKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhbGxPdXRwdXRJdGVtQ2FjaGUuc2V0KG1pbWUsIHRhc2spO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRhc2s7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGl0ZW0gPSBjcmVhdGUoaWQsIG1pbWUsIG1ldGFkYXRhLCB2YWx1ZUJ5dGVzLCBhcHBlbmRlZCk7XG5cdFx0YWxsT3V0cHV0SXRlbUNhY2hlLnNldChtaW1lLCBQcm9taXNlLnJlc29sdmUoaXRlbSkpO1xuXHRcdHJldHVybiBpdGVtO1xuXHR9XG5cblx0Y29uc3Qgb25EaWRSZWNlaXZlS2VybmVsTWVzc2FnZSA9IGNyZWF0ZUVtaXR0ZXI8dW5rbm93bj4oKTtcblxuXHRjb25zdCB0dFBvbGljeSA9IHdpbmRvdy50cnVzdGVkVHlwZXM/LmNyZWF0ZVBvbGljeSgnbm90ZWJvb2tSZW5kZXJlcicsIHtcblx0XHRjcmVhdGVIVE1MOiB2YWx1ZSA9PiB2YWx1ZSwgLy8gQ29kZVFMIFtTTTAzNzEyXSBUaGUgcmVuZGVyZWQgY29udGVudCBpcyBwcm92aWRlZCBieSByZW5kZXJlciBleHRlbnNpb25zLCB3aGljaCBhcmUgcmVzcG9uc2libGUgZm9yIHNhbml0aXppbmcgdGhlaXIgY29udGVudCB0aGVtc2VsdmVzLiBUaGUgbm90ZWJvb2sgd2VidmlldyBpcyBhbHNvIHNhbmRib3hlZC5cblx0XHRjcmVhdGVTY3JpcHQ6IHZhbHVlID0+IHZhbHVlLCAvLyBDb2RlUUwgW1NNMDM3MTJdIFRoZSByZW5kZXJlZCBjb250ZW50IGlzIHByb3ZpZGVkIGJ5IHJlbmRlcmVyIGV4dGVuc2lvbnMsIHdoaWNoIGFyZSByZXNwb25zaWJsZSBmb3Igc2FuaXRpemluZyB0aGVpciBjb250ZW50IHRoZW1zZWx2ZXMuIFRoZSBub3RlYm9vayB3ZWJ2aWV3IGlzIGFsc28gc2FuZGJveGVkLlxuXHR9KTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCBoYW5kbGVXaGVlbCk7XG5cblx0aW50ZXJmYWNlIElGaW5kTWF0Y2gge1xuXHRcdHR5cGU6ICdwcmV2aWV3JyB8ICdvdXRwdXQnO1xuXHRcdGlkOiBzdHJpbmc7XG5cdFx0Y2VsbElkOiBzdHJpbmc7XG5cdFx0Y29udGFpbmVyOiBOb2RlO1xuXHRcdG9yaWdpbmFsUmFuZ2U6IFJhbmdlO1xuXHRcdGlzU2hhZG93OiBib29sZWFuO1xuXHRcdHNlYXJjaFByZXZpZXdJbmZvPzogSVNlYXJjaFByZXZpZXdJbmZvO1xuXHRcdGhpZ2hsaWdodFJlc3VsdD86IElIaWdobGlnaHRSZXN1bHQ7XG5cdH1cblxuXHRpbnRlcmZhY2UgSVNlYXJjaFByZXZpZXdJbmZvIHtcblx0XHRsaW5lOiBzdHJpbmc7XG5cdFx0cmFuZ2U6IHtcblx0XHRcdHN0YXJ0OiBudW1iZXI7XG5cdFx0XHRlbmQ6IG51bWJlcjtcblx0XHR9O1xuXHR9XG5cblx0aW50ZXJmYWNlIElIaWdobGlnaHRlciB7XG5cdFx0YWRkSGlnaGxpZ2h0cyhtYXRjaGVzOiBJRmluZE1hdGNoW10sIG93bmVySUQ6IHN0cmluZyk6IHZvaWQ7XG5cdFx0cmVtb3ZlSGlnaGxpZ2h0cyhvd25lcklEOiBzdHJpbmcpOiB2b2lkO1xuXHRcdGhpZ2hsaWdodEN1cnJlbnRNYXRjaChpbmRleDogbnVtYmVyLCBvd25lcklEOiBzdHJpbmcpOiB2b2lkO1xuXHRcdHVuSGlnaGxpZ2h0Q3VycmVudE1hdGNoKGluZGV4OiBudW1iZXIsIG93bmVySUQ6IHN0cmluZyk6IHZvaWQ7XG5cdFx0ZGlzcG9zZSgpOiB2b2lkO1xuXHR9XG5cblx0aW50ZXJmYWNlIElIaWdobGlnaHRJbmZvIHtcblx0XHRtYXRjaGVzOiBJRmluZE1hdGNoW107XG5cdFx0Y3VycmVudE1hdGNoSW5kZXg6IG51bWJlcjtcblx0fVxuXG5cdGNvbnN0IG1hdGNoQ29sb3IgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19kZWZhdWx0Q29sb3JQYWxhdHRlJykhKS5jb2xvcjtcblx0Y29uc3QgY3VycmVudE1hdGNoQ29sb3IgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19kZWZhdWx0Q29sb3JQYWxhdHRlJykhKS5iYWNrZ3JvdW5kQ29sb3I7XG5cblx0Y2xhc3MgSlNIaWdobGlnaHRlciBpbXBsZW1lbnRzIElIaWdobGlnaHRlciB7XG5cdFx0cHJpdmF0ZSBfYWN0aXZlSGlnaGxpZ2h0SW5mbzogTWFwPHN0cmluZywgSUhpZ2hsaWdodEluZm8+O1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVIaWdobGlnaHRJbmZvID0gbmV3IE1hcCgpO1xuXHRcdH1cblxuXHRcdGFkZEhpZ2hsaWdodHMobWF0Y2hlczogSUZpbmRNYXRjaFtdLCBvd25lcklEOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGZvciAobGV0IGkgPSBtYXRjaGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gbWF0Y2hlc1tpXTtcblx0XHRcdFx0Y29uc3QgcmV0ID0gaGlnaGxpZ2h0UmFuZ2UobWF0Y2gub3JpZ2luYWxSYW5nZSwgdHJ1ZSwgJ21hcmsnLCBtYXRjaC5pc1NoYWRvdyA/IHtcblx0XHRcdFx0XHQnc3R5bGUnOiAnYmFja2dyb3VuZC1jb2xvcjogJyArIG1hdGNoQ29sb3IgKyAnOycsXG5cdFx0XHRcdH0gOiB7XG5cdFx0XHRcdFx0J2NsYXNzJzogJ2ZpbmQtbWF0Y2gnXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRtYXRjaC5oaWdobGlnaHRSZXN1bHQgPSByZXQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhpZ2hsaWdodEluZm86IElIaWdobGlnaHRJbmZvID0ge1xuXHRcdFx0XHRtYXRjaGVzLFxuXHRcdFx0XHRjdXJyZW50TWF0Y2hJbmRleDogLTFcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9hY3RpdmVIaWdobGlnaHRJbmZvLnNldChvd25lcklELCBoaWdobGlnaHRJbmZvKTtcblx0XHR9XG5cblx0XHRyZW1vdmVIaWdobGlnaHRzKG93bmVySUQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0dGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mby5nZXQob3duZXJJRCk/Lm1hdGNoZXMuZm9yRWFjaChtYXRjaCA9PiB7XG5cdFx0XHRcdG1hdGNoLmhpZ2hsaWdodFJlc3VsdD8uZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9hY3RpdmVIaWdobGlnaHRJbmZvLmRlbGV0ZShvd25lcklEKTtcblx0XHR9XG5cblx0XHRoaWdobGlnaHRDdXJyZW50TWF0Y2goaW5kZXg6IG51bWJlciwgb3duZXJJRDogc3RyaW5nKSB7XG5cdFx0XHRjb25zdCBoaWdobGlnaHRJbmZvID0gdGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mby5nZXQob3duZXJJRCk7XG5cdFx0XHRpZiAoIWhpZ2hsaWdodEluZm8pIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignTW9kaWZpZWQgY3VycmVudCBoaWdobGlnaHQgbWF0Y2ggYmVmb3JlIGFkZGluZyBoaWdobGlnaHQgbGlzdC4nKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgb2xkTWF0Y2ggPSBoaWdobGlnaHRJbmZvLm1hdGNoZXNbaGlnaGxpZ2h0SW5mby5jdXJyZW50TWF0Y2hJbmRleF07XG5cdFx0XHRvbGRNYXRjaD8uaGlnaGxpZ2h0UmVzdWx0Py51cGRhdGUobWF0Y2hDb2xvciwgb2xkTWF0Y2guaXNTaGFkb3cgPyB1bmRlZmluZWQgOiAnZmluZC1tYXRjaCcpO1xuXG5cdFx0XHRjb25zdCBtYXRjaCA9IGhpZ2hsaWdodEluZm8ubWF0Y2hlc1tpbmRleF07XG5cdFx0XHRoaWdobGlnaHRJbmZvLmN1cnJlbnRNYXRjaEluZGV4ID0gaW5kZXg7XG5cdFx0XHRjb25zdCBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoISFtYXRjaCAmJiAhIXNlbCAmJiBtYXRjaC5oaWdobGlnaHRSZXN1bHQpIHtcblx0XHRcdFx0bGV0IG9mZnNldCA9IDA7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0T2Zmc2V0ID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1hdGNoLmlkKSEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wO1xuXHRcdFx0XHRcdGNvbnN0IHRlbXBSYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XG5cdFx0XHRcdFx0dGVtcFJhbmdlLnNlbGVjdE5vZGUobWF0Y2guaGlnaGxpZ2h0UmVzdWx0LnJhbmdlLnN0YXJ0Q29udGFpbmVyKTtcblxuXHRcdFx0XHRcdG1hdGNoLmhpZ2hsaWdodFJlc3VsdC5yYW5nZS5zdGFydENvbnRhaW5lci5wYXJlbnRFbGVtZW50Py5zY3JvbGxJbnRvVmlldyh7IGJlaGF2aW9yOiAnYXV0bycsIGJsb2NrOiAnZW5kJywgaW5saW5lOiAnbmVhcmVzdCcgfSk7XG5cblx0XHRcdFx0XHRjb25zdCByYW5nZU9mZnNldCA9IHRlbXBSYW5nZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cdFx0XHRcdFx0dGVtcFJhbmdlLmRldGFjaCgpO1xuXG5cdFx0XHRcdFx0b2Zmc2V0ID0gcmFuZ2VPZmZzZXQgLSBvdXRwdXRPZmZzZXQ7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWF0Y2guaGlnaGxpZ2h0UmVzdWx0Py51cGRhdGUoY3VycmVudE1hdGNoQ29sb3IsIG1hdGNoLmlzU2hhZG93ID8gdW5kZWZpbmVkIDogJ2N1cnJlbnQtZmluZC1tYXRjaCcpO1xuXG5cdFx0XHRcdHdpbmRvdy5kb2N1bWVudC5nZXRTZWxlY3Rpb24oKT8ucmVtb3ZlQWxsUmFuZ2VzKCk7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2UoJ2RpZEZpbmRIaWdobGlnaHRDdXJyZW50Jywge1xuXHRcdFx0XHRcdG9mZnNldFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR1bkhpZ2hsaWdodEN1cnJlbnRNYXRjaChpbmRleDogbnVtYmVyLCBvd25lcklEOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGhpZ2hsaWdodEluZm8gPSB0aGlzLl9hY3RpdmVIaWdobGlnaHRJbmZvLmdldChvd25lcklEKTtcblx0XHRcdGlmICghaGlnaGxpZ2h0SW5mbykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBvbGRNYXRjaCA9IGhpZ2hsaWdodEluZm8ubWF0Y2hlc1tpbmRleF07XG5cdFx0XHRpZiAob2xkTWF0Y2ggJiYgb2xkTWF0Y2guaGlnaGxpZ2h0UmVzdWx0KSB7XG5cdFx0XHRcdG9sZE1hdGNoLmhpZ2hsaWdodFJlc3VsdC51cGRhdGUobWF0Y2hDb2xvciwgb2xkTWF0Y2guaXNTaGFkb3cgPyB1bmRlZmluZWQgOiAnZmluZC1tYXRjaCcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHR3aW5kb3cuZG9jdW1lbnQuZ2V0U2VsZWN0aW9uKCk/LnJlbW92ZUFsbFJhbmdlcygpO1xuXHRcdFx0dGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mby5mb3JFYWNoKGhpZ2hsaWdodEluZm8gPT4ge1xuXHRcdFx0XHRoaWdobGlnaHRJbmZvLm1hdGNoZXMuZm9yRWFjaChtYXRjaCA9PiB7XG5cdFx0XHRcdFx0bWF0Y2guaGlnaGxpZ2h0UmVzdWx0Py5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgQ1NTSGlnaGxpZ2h0ZXIgaW1wbGVtZW50cyBJSGlnaGxpZ2h0ZXIge1xuXHRcdHByaXZhdGUgX2FjdGl2ZUhpZ2hsaWdodEluZm86IE1hcDxzdHJpbmcsIElIaWdobGlnaHRJbmZvPjtcblx0XHRwcml2YXRlIF9tYXRjaGVzSGlnaGxpZ2h0OiBIaWdobGlnaHQ7XG5cdFx0cHJpdmF0ZSBfY3VycmVudE1hdGNoZXNIaWdobGlnaHQ6IEhpZ2hsaWdodDtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0dGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mbyA9IG5ldyBNYXAoKTtcblx0XHRcdHRoaXMuX21hdGNoZXNIaWdobGlnaHQgPSBuZXcgSGlnaGxpZ2h0KCk7XG5cdFx0XHR0aGlzLl9tYXRjaGVzSGlnaGxpZ2h0LnByaW9yaXR5ID0gMTtcblx0XHRcdHRoaXMuX2N1cnJlbnRNYXRjaGVzSGlnaGxpZ2h0ID0gbmV3IEhpZ2hsaWdodCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudE1hdGNoZXNIaWdobGlnaHQucHJpb3JpdHkgPSAyO1xuXHRcdFx0Q1NTLmhpZ2hsaWdodHM/LnNldChgZmluZC1oaWdobGlnaHRgLCB0aGlzLl9tYXRjaGVzSGlnaGxpZ2h0KTtcblx0XHRcdENTUy5oaWdobGlnaHRzPy5zZXQoYGN1cnJlbnQtZmluZC1oaWdobGlnaHRgLCB0aGlzLl9jdXJyZW50TWF0Y2hlc0hpZ2hsaWdodCk7XG5cdFx0fVxuXG5cdFx0X3JlZnJlc2hSZWdpc3RyeSh1cGRhdGVNYXRjaGVzSGlnaGxpZ2h0ID0gdHJ1ZSkge1xuXHRcdFx0Ly8gZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMsIG9ubHkgdXBkYXRlIHRoZSBmdWxsIGxpc3Qgb2YgaGlnaGxpZ2h0cyB3aGVuIHdlIG5lZWQgdG9cblx0XHRcdGlmICh1cGRhdGVNYXRjaGVzSGlnaGxpZ2h0KSB7XG5cdFx0XHRcdHRoaXMuX21hdGNoZXNIaWdobGlnaHQuY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY3VycmVudE1hdGNoZXNIaWdobGlnaHQuY2xlYXIoKTtcblxuXHRcdFx0dGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mby5mb3JFYWNoKChoaWdobGlnaHRJbmZvKSA9PiB7XG5cblx0XHRcdFx0aWYgKHVwZGF0ZU1hdGNoZXNIaWdobGlnaHQpIHtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGhpZ2hsaWdodEluZm8ubWF0Y2hlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0dGhpcy5fbWF0Y2hlc0hpZ2hsaWdodC5hZGQoaGlnaGxpZ2h0SW5mby5tYXRjaGVzW2ldLm9yaWdpbmFsUmFuZ2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGlnaGxpZ2h0SW5mby5jdXJyZW50TWF0Y2hJbmRleCA8IGhpZ2hsaWdodEluZm8ubWF0Y2hlcy5sZW5ndGggJiYgaGlnaGxpZ2h0SW5mby5jdXJyZW50TWF0Y2hJbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fY3VycmVudE1hdGNoZXNIaWdobGlnaHQuYWRkKGhpZ2hsaWdodEluZm8ubWF0Y2hlc1toaWdobGlnaHRJbmZvLmN1cnJlbnRNYXRjaEluZGV4XS5vcmlnaW5hbFJhbmdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YWRkSGlnaGxpZ2h0cyhcblx0XHRcdG1hdGNoZXM6IElGaW5kTWF0Y2hbXSxcblx0XHRcdG93bmVySUQ6IHN0cmluZ1xuXHRcdCkge1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1hdGNoZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dGhpcy5fbWF0Y2hlc0hpZ2hsaWdodC5hZGQobWF0Y2hlc1tpXS5vcmlnaW5hbFJhbmdlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV3RW50cnk6IElIaWdobGlnaHRJbmZvID0ge1xuXHRcdFx0XHRtYXRjaGVzLFxuXHRcdFx0XHRjdXJyZW50TWF0Y2hJbmRleDogLTEsXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLl9hY3RpdmVIaWdobGlnaHRJbmZvLnNldChvd25lcklELCBuZXdFbnRyeSk7XG5cdFx0fVxuXG5cdFx0aGlnaGxpZ2h0Q3VycmVudE1hdGNoKGluZGV4OiBudW1iZXIsIG93bmVySUQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0SW5mbyA9IHRoaXMuX2FjdGl2ZUhpZ2hsaWdodEluZm8uZ2V0KG93bmVySUQpO1xuXHRcdFx0aWYgKCFoaWdobGlnaHRJbmZvKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ01vZGlmaWVkIGN1cnJlbnQgaGlnaGxpZ2h0IG1hdGNoIGJlZm9yZSBhZGRpbmcgaGlnaGxpZ2h0IGxpc3QuJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aGlnaGxpZ2h0SW5mby5jdXJyZW50TWF0Y2hJbmRleCA9IGluZGV4O1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSBoaWdobGlnaHRJbmZvLm1hdGNoZXNbaW5kZXhdO1xuXG5cdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0bGV0IG9mZnNldCA9IDA7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0T2Zmc2V0ID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1hdGNoLmlkKSEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wO1xuXHRcdFx0XHRcdG1hdGNoLm9yaWdpbmFsUmFuZ2Uuc3RhcnRDb250YWluZXIucGFyZW50RWxlbWVudD8uc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogJ2F1dG8nLCBibG9jazogJ2VuZCcsIGlubGluZTogJ25lYXJlc3QnIH0pO1xuXHRcdFx0XHRcdGNvbnN0IHJhbmdlT2Zmc2V0ID0gbWF0Y2gub3JpZ2luYWxSYW5nZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cdFx0XHRcdFx0b2Zmc2V0ID0gcmFuZ2VPZmZzZXQgLSBvdXRwdXRPZmZzZXQ7XG5cdFx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZSgnZGlkRmluZEhpZ2hsaWdodEN1cnJlbnQnLCB7XG5cdFx0XHRcdFx0XHRvZmZzZXRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZnJlc2hSZWdpc3RyeShmYWxzZSk7XG5cdFx0fVxuXG5cdFx0dW5IaWdobGlnaHRDdXJyZW50TWF0Y2goaW5kZXg6IG51bWJlciwgb3duZXJJRDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRjb25zdCBoaWdobGlnaHRJbmZvID0gdGhpcy5fYWN0aXZlSGlnaGxpZ2h0SW5mby5nZXQob3duZXJJRCk7XG5cdFx0XHRpZiAoIWhpZ2hsaWdodEluZm8pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRoaWdobGlnaHRJbmZvLmN1cnJlbnRNYXRjaEluZGV4ID0gLTE7XG5cdFx0fVxuXG5cdFx0cmVtb3ZlSGlnaGxpZ2h0cyhvd25lcklEOiBzdHJpbmcpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUhpZ2hsaWdodEluZm8uZGVsZXRlKG93bmVySUQpO1xuXHRcdFx0dGhpcy5fcmVmcmVzaFJlZ2lzdHJ5KCk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRcdHdpbmRvdy5kb2N1bWVudC5nZXRTZWxlY3Rpb24oKT8ucmVtb3ZlQWxsUmFuZ2VzKCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50TWF0Y2hlc0hpZ2hsaWdodC5jbGVhcigpO1xuXHRcdFx0dGhpcy5fbWF0Y2hlc0hpZ2hsaWdodC5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IF9oaWdobGlnaHRlciA9IChDU1MuaGlnaGxpZ2h0cykgPyBuZXcgQ1NTSGlnaGxpZ2h0ZXIoKSA6IG5ldyBKU0hpZ2hsaWdodGVyKCk7XG5cblx0ZnVuY3Rpb24gZXh0cmFjdFNlbGVjdGlvbkxpbmUoc2VsZWN0aW9uOiBTZWxlY3Rpb24pOiBJU2VhcmNoUHJldmlld0luZm8ge1xuXHRcdGNvbnN0IHJhbmdlID0gc2VsZWN0aW9uLmdldFJhbmdlQXQoMCk7XG5cblx0XHQvLyB3ZSBuZWVkIHRvIGtlZXAgYSByZWZlcmVuY2UgdG8gdGhlIG9sZCBzZWxlY3Rpb24gcmFuZ2UgdG8gcmUtYXBwbHkgbGF0ZXJcblx0XHRjb25zdCBvbGRSYW5nZSA9IHJhbmdlLmNsb25lUmFuZ2UoKTtcblx0XHRjb25zdCBjYXB0dXJlTGVuZ3RoID0gc2VsZWN0aW9uLnRvU3RyaW5nKCkubGVuZ3RoO1xuXG5cdFx0Ly8gdXNlIHNlbGVjdGlvbiBBUEkgdG8gbW9kaWZ5IHNlbGVjdGlvbiB0byBnZXQgZW50aXJlIGxpbmUgKHRoZSBmaXJzdCBsaW5lIGlmIG11bHRpLXNlbGVjdClcblxuXHRcdC8vIGNvbGxhcHNlIHNlbGVjdGlvbiB0byBzdGFydCBzbyB0aGF0IHRoZSBjdXJzb3IgcG9zaXRpb24gaXMgYXQgYmVnaW5uaW5nIG9mIG1hdGNoXG5cdFx0c2VsZWN0aW9uLmNvbGxhcHNlVG9TdGFydCgpO1xuXG5cdFx0Ly8gZXh0ZW5kIHNlbGVjdGlvbiBpbiBib3RoIGRpcmVjdGlvbnMgdG8gc2VsZWN0IHRoZSBsaW5lXG5cdFx0c2VsZWN0aW9uLm1vZGlmeSgnbW92ZScsICdiYWNrd2FyZCcsICdsaW5lYm91bmRhcnknKTtcblx0XHRzZWxlY3Rpb24ubW9kaWZ5KCdleHRlbmQnLCAnZm9yd2FyZCcsICdsaW5lYm91bmRhcnknKTtcblxuXHRcdGNvbnN0IGxpbmUgPSBzZWxlY3Rpb24udG9TdHJpbmcoKTtcblxuXHRcdC8vIHVzaW5nIHRoZSBvcmlnaW5hbCByYW5nZSBhbmQgdGhlIG5ldyByYW5nZSwgd2UgY2FuIGZpbmQgdGhlIG9mZnNldCBvZiB0aGUgbWF0Y2ggZnJvbSB0aGUgbGluZSBzdGFydC5cblx0XHRjb25zdCByYW5nZVN0YXJ0ID0gZ2V0U3RhcnRPZmZzZXQoc2VsZWN0aW9uLmdldFJhbmdlQXQoMCksIG9sZFJhbmdlKTtcblxuXHRcdC8vIGxpbmUgcmFuZ2UgZm9yIG1hdGNoXG5cdFx0Y29uc3QgbGluZVJhbmdlID0ge1xuXHRcdFx0c3RhcnQ6IHJhbmdlU3RhcnQsXG5cdFx0XHRlbmQ6IHJhbmdlU3RhcnQgKyBjYXB0dXJlTGVuZ3RoLFxuXHRcdH07XG5cblx0XHQvLyByZS1hZGQgdGhlIG9sZCByYW5nZSBzbyB0aGF0IHRoZSBzZWxlY3Rpb24gaXMgcmVzdG9yZWRcblx0XHRzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG5cdFx0c2VsZWN0aW9uLmFkZFJhbmdlKG9sZFJhbmdlKTtcblxuXHRcdHJldHVybiB7IGxpbmUsIHJhbmdlOiBsaW5lUmFuZ2UgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFN0YXJ0T2Zmc2V0KGxpbmVSYW5nZTogUmFuZ2UsIG9yaWdpbmFsUmFuZ2U6IFJhbmdlKSB7XG5cdFx0Ly8gc29tZXRpbWVzLCB0aGUgb2xkIGFuZCBuZXcgcmFuZ2UgYXJlIGluIGRpZmZlcmVudCBET00gZWxlbWVudHMgKGllOiB3aGVuIHRoZSBtYXRjaCBpcyBpbnNpZGUgb2YgPGI+PC9iPilcblx0XHQvLyBzbyB3ZSBuZWVkIHRvIGZpbmQgdGhlIGZpcnN0IGNvbW1vbiBhbmNlc3RvciBET00gZWxlbWVudCBhbmQgZmluZCB0aGUgcG9zaXRpb25zIG9mIHRoZSBvbGQgYW5kIG5ldyByYW5nZSByZWxhdGl2ZSB0byB0aGF0LlxuXHRcdGNvbnN0IGZpcnN0Q29tbW9uQW5jZXN0b3IgPSBmaW5kRmlyc3RDb21tb25BbmNlc3RvcihsaW5lUmFuZ2Uuc3RhcnRDb250YWluZXIsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb250YWluZXIpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uT2Zmc2V0ID0gZ2V0U2VsZWN0aW9uT2Zmc2V0UmVsYXRpdmVUbyhmaXJzdENvbW1vbkFuY2VzdG9yLCBsaW5lUmFuZ2Uuc3RhcnRDb250YWluZXIpICsgbGluZVJhbmdlLnN0YXJ0T2Zmc2V0O1xuXHRcdGNvbnN0IHRleHRPZmZzZXQgPSBnZXRTZWxlY3Rpb25PZmZzZXRSZWxhdGl2ZVRvKGZpcnN0Q29tbW9uQW5jZXN0b3IsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb250YWluZXIpICsgb3JpZ2luYWxSYW5nZS5zdGFydE9mZnNldDtcblx0XHRyZXR1cm4gdGV4dE9mZnNldCAtIHNlbGVjdGlvbk9mZnNldDtcblx0fVxuXG5cdC8vIG1vZGlmaWVkIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzY4NTgzNDY2LzE2MjUzODIzXG5cdGZ1bmN0aW9uIGZpbmRGaXJzdENvbW1vbkFuY2VzdG9yKG5vZGVBOiBOb2RlLCBub2RlQjogTm9kZSkge1xuXHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKCk7XG5cdFx0cmFuZ2Uuc2V0U3RhcnQobm9kZUEsIDApO1xuXHRcdHJhbmdlLnNldEVuZChub2RlQiwgMCk7XG5cdFx0cmV0dXJuIHJhbmdlLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VGV4dENvbnRlbnRMZW5ndGgobm9kZTogTm9kZSk6IG51bWJlciB7XG5cdFx0bGV0IGxlbmd0aCA9IDA7XG5cblx0XHRpZiAobm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcblx0XHRcdGxlbmd0aCArPSBub2RlLnRleHRDb250ZW50Py5sZW5ndGggfHwgMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG5cdFx0XHRcdGxlbmd0aCArPSBnZXRUZXh0Q29udGVudExlbmd0aChjaGlsZE5vZGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBsZW5ndGg7XG5cdH1cblxuXHQvLyBtb2RpZmllZCBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS80ODgxMjUyOS8xNjI1MzgyM1xuXHRmdW5jdGlvbiBnZXRTZWxlY3Rpb25PZmZzZXRSZWxhdGl2ZVRvKHBhcmVudEVsZW1lbnQ6IE5vZGUsIGN1cnJlbnROb2RlOiBOb2RlIHwgbnVsbCk6IG51bWJlciB7XG5cdFx0aWYgKCFjdXJyZW50Tm9kZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGxldCBvZmZzZXQgPSAwO1xuXG5cdFx0aWYgKGN1cnJlbnROb2RlID09PSBwYXJlbnRFbGVtZW50IHx8ICFwYXJlbnRFbGVtZW50LmNvbnRhaW5zKGN1cnJlbnROb2RlKSkge1xuXHRcdFx0cmV0dXJuIG9mZnNldDtcblx0XHR9XG5cblxuXHRcdC8vIGNvdW50IHRoZSBudW1iZXIgb2YgY2hhcnMgYmVmb3JlIHRoZSBjdXJyZW50IGRvbSBlbGVtIGFuZCB0aGUgc3RhcnQgb2YgdGhlIGRvbVxuXHRcdGxldCBwcmV2U2libGluZyA9IGN1cnJlbnROb2RlLnByZXZpb3VzU2libGluZztcblx0XHR3aGlsZSAocHJldlNpYmxpbmcpIHtcblx0XHRcdG9mZnNldCArPSBnZXRUZXh0Q29udGVudExlbmd0aChwcmV2U2libGluZyk7XG5cdFx0XHRwcmV2U2libGluZyA9IHByZXZTaWJsaW5nLnByZXZpb3VzU2libGluZztcblx0XHR9XG5cblx0XHRyZXR1cm4gb2Zmc2V0ICsgZ2V0U2VsZWN0aW9uT2Zmc2V0UmVsYXRpdmVUbyhwYXJlbnRFbGVtZW50LCBjdXJyZW50Tm9kZS5wYXJlbnROb2RlKTtcblx0fVxuXG5cdGNvbnN0IGZpbmQgPSAocXVlcnk6IHN0cmluZywgb3B0aW9uczogeyB3aG9sZVdvcmQ/OiBib29sZWFuOyBjYXNlU2Vuc2l0aXZlPzogYm9vbGVhbjsgaW5jbHVkZU1hcmt1cDogYm9vbGVhbjsgaW5jbHVkZU91dHB1dDogYm9vbGVhbjsgc2hvdWxkR2V0U2VhcmNoUHJldmlld0luZm86IGJvb2xlYW47IG93bmVySUQ6IHN0cmluZzsgZmluZElkczogc3RyaW5nW10gfSkgPT4ge1xuXHRcdGxldCBmaW5kID0gdHJ1ZTtcblx0XHRsZXQgbWF0Y2hlczogSUZpbmRNYXRjaFtdID0gW107XG5cblx0XHRjb25zdCByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XG5cdFx0cmFuZ2Uuc2VsZWN0Tm9kZUNvbnRlbnRzKHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmluZFN0YXJ0JykhKTtcblx0XHRjb25zdCBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0c2VsPy5yZW1vdmVBbGxSYW5nZXMoKTtcblx0XHRzZWw/LmFkZFJhbmdlKHJhbmdlKTtcblxuXHRcdHZpZXdNb2RlbC50b2dnbGVEcmFnRHJvcEVuYWJsZWQoZmFsc2UpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGRvY3VtZW50LmRlc2lnbk1vZGUgPSAnT24nO1xuXG5cdFx0XHR3aGlsZSAoZmluZCAmJiBtYXRjaGVzLmxlbmd0aCA8IDUwMCkge1xuXHRcdFx0XHRmaW5kID0gKHdpbmRvdyBhcyBhbnkpLmZpbmQocXVlcnksIC8qIGNhc2VTZW5zaXRpdmUqLyAhIW9wdGlvbnMuY2FzZVNlbnNpdGl2ZSxcblx0XHRcdFx0LyogYmFja3dhcmRzKi8gZmFsc2UsXG5cdFx0XHRcdC8qIHdyYXBBcm91bmQqLyBmYWxzZSxcblx0XHRcdFx0Lyogd2hvbGVXb3JkICovICEhb3B0aW9ucy53aG9sZVdvcmQsXG5cdFx0XHRcdC8qIHNlYXJjaEluRnJhbWVzKi8gdHJ1ZSxcblx0XHRcdFx0XHRmYWxzZSk7XG5cblx0XHRcdFx0aWYgKGZpbmQpIHtcblx0XHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKCFzZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdubyBzZWxlY3Rpb24nKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE1hcmtkb3duIHByZXZpZXcgYXJlIHJlbmRlcmVkIGluIGEgc2hhZG93IERPTS5cblx0XHRcdFx0XHRpZiAob3B0aW9ucy5pbmNsdWRlTWFya3VwICYmIHNlbGVjdGlvbi5yYW5nZUNvdW50ID4gMCAmJiBzZWxlY3Rpb24uZ2V0UmFuZ2VBdCgwKS5zdGFydENvbnRhaW5lci5ub2RlVHlwZSA9PT0gMVxuXHRcdFx0XHRcdFx0JiYgKHNlbGVjdGlvbi5nZXRSYW5nZUF0KDApLnN0YXJ0Q29udGFpbmVyIGFzIEVsZW1lbnQpLmNsYXNzTGlzdC5jb250YWlucygnbWFya3VwJykpIHtcblx0XHRcdFx0XHRcdC8vIG1hcmtkb3duIHByZXZpZXcgY29udGFpbmVyXG5cdFx0XHRcdFx0XHRjb25zdCBwcmV2aWV3ID0gKHNlbGVjdGlvbi5hbmNob3JOb2RlPy5maXJzdENoaWxkIGFzIEVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgcm9vdCA9IHByZXZpZXcuc2hhZG93Um9vdCBhcyBTaGFkb3dSb290ICYgeyBnZXRTZWxlY3Rpb246ICgpID0+IFNlbGVjdGlvbiB9O1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2hhZG93U2VsZWN0aW9uID0gcm9vdD8uZ2V0U2VsZWN0aW9uID8gcm9vdD8uZ2V0U2VsZWN0aW9uKCkgOiBudWxsO1xuXHRcdFx0XHRcdFx0Ly8gZmluZCB0aGUgbWF0Y2ggaW4gdGhlIHNoYWRvdyBkb20gYnkgY2hlY2tpbmcgdGhlIHNlbGVjdGlvbiBpbnNpZGUgdGhlIHNoYWRvdyBkb21cblx0XHRcdFx0XHRcdGlmIChzaGFkb3dTZWxlY3Rpb24gJiYgc2hhZG93U2VsZWN0aW9uLmFuY2hvck5vZGUpIHtcblx0XHRcdFx0XHRcdFx0bWF0Y2hlcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAncHJldmlldycsXG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHByZXZpZXcuaWQsXG5cdFx0XHRcdFx0XHRcdFx0Y2VsbElkOiBwcmV2aWV3LmlkLFxuXHRcdFx0XHRcdFx0XHRcdGNvbnRhaW5lcjogcHJldmlldyxcblx0XHRcdFx0XHRcdFx0XHRpc1NoYWRvdzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRvcmlnaW5hbFJhbmdlOiBzaGFkb3dTZWxlY3Rpb24uZ2V0UmFuZ2VBdCgwKSxcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQcmV2aWV3SW5mbzogb3B0aW9ucy5zaG91bGRHZXRTZWFyY2hQcmV2aWV3SW5mbyA/IGV4dHJhY3RTZWxlY3Rpb25MaW5lKHNoYWRvd1NlbGVjdGlvbikgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE91dHB1dHMgbWlnaHQgYmUgcmVuZGVyZWQgaW5zaWRlIGEgc2hhZG93IERPTS5cblx0XHRcdFx0XHRpZiAob3B0aW9ucy5pbmNsdWRlT3V0cHV0ICYmIHNlbGVjdGlvbi5yYW5nZUNvdW50ID4gMCAmJiBzZWxlY3Rpb24uZ2V0UmFuZ2VBdCgwKS5zdGFydENvbnRhaW5lci5ub2RlVHlwZSA9PT0gMVxuXHRcdFx0XHRcdFx0JiYgKHNlbGVjdGlvbi5nZXRSYW5nZUF0KDApLnN0YXJ0Q29udGFpbmVyIGFzIEVsZW1lbnQpLmNsYXNzTGlzdC5jb250YWlucygnb3V0cHV0X2NvbnRhaW5lcicpKSB7XG5cdFx0XHRcdFx0XHQvLyBvdXRwdXQgY29udGFpbmVyXG5cdFx0XHRcdFx0XHRjb25zdCBjZWxsSWQgPSBzZWxlY3Rpb24uZ2V0UmFuZ2VBdCgwKS5zdGFydENvbnRhaW5lci5wYXJlbnRFbGVtZW50IS5pZDtcblx0XHRcdFx0XHRcdGNvbnN0IG91dHB1dE5vZGUgPSAoc2VsZWN0aW9uLmFuY2hvck5vZGU/LmZpcnN0Q2hpbGQgYXMgRWxlbWVudCk7XG5cdFx0XHRcdFx0XHRjb25zdCByb290ID0gb3V0cHV0Tm9kZS5zaGFkb3dSb290IGFzIFNoYWRvd1Jvb3QgJiB7IGdldFNlbGVjdGlvbjogKCkgPT4gU2VsZWN0aW9uIH07XG5cdFx0XHRcdFx0XHRjb25zdCBzaGFkb3dTZWxlY3Rpb24gPSByb290Py5nZXRTZWxlY3Rpb24gPyByb290Py5nZXRTZWxlY3Rpb24oKSA6IG51bGw7XG5cdFx0XHRcdFx0XHRpZiAoc2hhZG93U2VsZWN0aW9uICYmIHNoYWRvd1NlbGVjdGlvbi5hbmNob3JOb2RlKSB7XG5cdFx0XHRcdFx0XHRcdG1hdGNoZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ291dHB1dCcsXG5cdFx0XHRcdFx0XHRcdFx0aWQ6IG91dHB1dE5vZGUuaWQsXG5cdFx0XHRcdFx0XHRcdFx0Y2VsbElkOiBjZWxsSWQsXG5cdFx0XHRcdFx0XHRcdFx0Y29udGFpbmVyOiBvdXRwdXROb2RlLFxuXHRcdFx0XHRcdFx0XHRcdGlzU2hhZG93OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdG9yaWdpbmFsUmFuZ2U6IHNoYWRvd1NlbGVjdGlvbi5nZXRSYW5nZUF0KDApLFxuXHRcdFx0XHRcdFx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiBvcHRpb25zLnNob3VsZEdldFNlYXJjaFByZXZpZXdJbmZvID8gZXh0cmFjdFNlbGVjdGlvbkxpbmUoc2hhZG93U2VsZWN0aW9uKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgYW5jaG9yTm9kZSA9IHNlbGVjdGlvbi5hbmNob3JOb2RlPy5wYXJlbnRFbGVtZW50O1xuXG5cdFx0XHRcdFx0aWYgKGFuY2hvck5vZGUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhc3RFbDogYW55ID0gbWF0Y2hlcy5sZW5ndGggPyBtYXRjaGVzW21hdGNoZXMubGVuZ3RoIC0gMV0gOiBudWxsO1xuXG5cdFx0XHRcdFx0XHQvLyBPcHRpbWl6YXRpb246IGF2b2lkIHNlYXJjaGluZyBmb3IgdGhlIG91dHB1dCBjb250YWluZXJcblx0XHRcdFx0XHRcdGlmIChsYXN0RWwgJiYgbGFzdEVsLmNvbnRhaW5lci5jb250YWlucyhhbmNob3JOb2RlKSAmJiBvcHRpb25zLmluY2x1ZGVPdXRwdXQpIHtcblx0XHRcdFx0XHRcdFx0bWF0Y2hlcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiBsYXN0RWwudHlwZSxcblx0XHRcdFx0XHRcdFx0XHRpZDogbGFzdEVsLmlkLFxuXHRcdFx0XHRcdFx0XHRcdGNlbGxJZDogbGFzdEVsLmNlbGxJZCxcblx0XHRcdFx0XHRcdFx0XHRjb250YWluZXI6IGxhc3RFbC5jb250YWluZXIsXG5cdFx0XHRcdFx0XHRcdFx0aXNTaGFkb3c6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdG9yaWdpbmFsUmFuZ2U6IHNlbGVjdGlvbi5nZXRSYW5nZUF0KDApLFxuXHRcdFx0XHRcdFx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiBvcHRpb25zLnNob3VsZEdldFNlYXJjaFByZXZpZXdJbmZvID8gZXh0cmFjdFNlbGVjdGlvbkxpbmUoc2VsZWN0aW9uKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIFRyYXZlcnNlIHVwIHRoZSBET00gdG8gZmluZCB0aGUgY29udGFpbmVyXG5cdFx0XHRcdFx0XHRcdGZvciAobGV0IG5vZGUgPSBhbmNob3JOb2RlIGFzIEVsZW1lbnQgfCBudWxsOyBub2RlOyBub2RlID0gbm9kZS5wYXJlbnRFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCEobm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAobm9kZS5jbGFzc0xpc3QuY29udGFpbnMoJ291dHB1dCcpICYmIG9wdGlvbnMuaW5jbHVkZU91dHB1dCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaW5zaWRlIG91dHB1dFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgY2VsbElkID0gbm9kZS5wYXJlbnRFbGVtZW50Py5wYXJlbnRFbGVtZW50Py5pZDtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChjZWxsSWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bWF0Y2hlcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnb3V0cHV0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpZDogbm9kZS5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjZWxsSWQ6IGNlbGxJZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250YWluZXI6IG5vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aXNTaGFkb3c6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG9yaWdpbmFsUmFuZ2U6IHNlbGVjdGlvbi5nZXRSYW5nZUF0KDApLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiBvcHRpb25zLnNob3VsZEdldFNlYXJjaFByZXZpZXdJbmZvID8gZXh0cmFjdFNlbGVjdGlvbkxpbmUoc2VsZWN0aW9uKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAobm9kZS5pZCA9PT0gJ2NvbnRhaW5lcicgfHwgbm9kZSA9PT0gd2luZG93LmRvY3VtZW50LmJvZHkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKGUpO1xuXHRcdH1cblxuXG5cdFx0bWF0Y2hlcyA9IG1hdGNoZXMuZmlsdGVyKG1hdGNoID0+IG9wdGlvbnMuZmluZElkcy5sZW5ndGggPyBvcHRpb25zLmZpbmRJZHMuaW5jbHVkZXMobWF0Y2guY2VsbElkKSA6IHRydWUpO1xuXHRcdF9oaWdobGlnaHRlci5hZGRIaWdobGlnaHRzKG1hdGNoZXMsIG9wdGlvbnMub3duZXJJRCk7XG5cdFx0d2luZG93LmRvY3VtZW50LmdldFNlbGVjdGlvbigpPy5yZW1vdmVBbGxSYW5nZXMoKTtcblxuXHRcdHZpZXdNb2RlbC50b2dnbGVEcmFnRHJvcEVuYWJsZWQoY3VycmVudE9wdGlvbnMuZHJhZ0FuZERyb3BFbmFibGVkKTtcblxuXHRcdGRvY3VtZW50LmRlc2lnbk1vZGUgPSAnT2ZmJztcblxuXHRcdHBvc3ROb3RlYm9va01lc3NhZ2UoJ2RpZEZpbmQnLCB7XG5cdFx0XHRtYXRjaGVzOiBtYXRjaGVzLm1hcCgobWF0Y2gsIGluZGV4KSA9PiAoe1xuXHRcdFx0XHR0eXBlOiBtYXRjaC50eXBlLFxuXHRcdFx0XHRpZDogbWF0Y2guaWQsXG5cdFx0XHRcdGNlbGxJZDogbWF0Y2guY2VsbElkLFxuXHRcdFx0XHRpbmRleCxcblx0XHRcdFx0c2VhcmNoUHJldmlld0luZm86IG1hdGNoLnNlYXJjaFByZXZpZXdJbmZvLFxuXHRcdFx0fSkpXG5cdFx0fSk7XG5cdH07XG5cblx0Y29uc3QgY29weU91dHB1dEltYWdlID0gYXN5bmMgKG91dHB1dElkOiBzdHJpbmcsIGFsdE91dHB1dElkOiBzdHJpbmcsIHJldHJpZXMgPSA1KSA9PiB7XG5cdFx0aWYgKCF3aW5kb3cuZG9jdW1lbnQuaGFzRm9jdXMoKSAmJiByZXRyaWVzID4gMCkge1xuXHRcdFx0Ly8gY29weUltYWdlIGNhbiBiZSBjYWxsZWQgZnJvbSBvdXRzaWRlIG9mIHRoZSB3ZWJ2aWV3LCB3aGljaCBtZWFucyB0aGlzIGZ1bmN0aW9uIG1heSBiZSBydW5uaW5nIHdoaWxzdCB0aGUgd2VidmlldyBpcyBnYWluaW5nIGZvY3VzLlxuXHRcdFx0Ly8gU2luY2UgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZSByZXF1aXJlcyB0aGUgZG9jdW1lbnQgdG8gYmUgZm9jdXNlZCwgd2UgbmVlZCB0byB3YWl0IGZvciBmb2N1cy5cblx0XHRcdC8vIFdlIGNhbm5vdCB1c2UgYSBsaXN0ZW5lciwgYXMgdGhlcmUgaXMgYSBoaWdoIGNoYW5jZSB0aGUgZm9jdXMgaXMgZ2FpbmVkIGR1cmluZyB0aGUgc2V0dXAgb2YgdGhlIGxpc3RlbmVyIHJlc3VsdGluZyBpbiB1cyBtaXNzaW5nIGl0LlxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7IGNvcHlPdXRwdXRJbWFnZShvdXRwdXRJZCwgYWx0T3V0cHV0SWQsIHJldHJpZXMgLSAxKTsgfSwgNTApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBvdXRwdXRFbGVtZW50ID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG91dHB1dElkKVxuXHRcdFx0XHQ/PyB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYWx0T3V0cHV0SWQpO1xuXG5cdFx0XHRsZXQgaW1hZ2UgPSBvdXRwdXRFbGVtZW50Py5xdWVyeVNlbGVjdG9yKCdpbWcnKTtcblxuXHRcdFx0aWYgKCFpbWFnZSkge1xuXHRcdFx0XHRjb25zdCBzdmdJbWFnZSA9IG91dHB1dEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3IoJ3N2Zy5vdXRwdXQtaW1hZ2UnKSA/P1xuXHRcdFx0XHRcdG91dHB1dEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3IoJ2Rpdi5zdmdDb250YWluZXJTdHlsZSA+IHN2ZycpO1xuXG5cdFx0XHRcdGlmIChzdmdJbWFnZSkge1xuXHRcdFx0XHRcdGltYWdlID0gbmV3IEltYWdlKCk7XG5cdFx0XHRcdFx0aW1hZ2Uuc3JjID0gJ2RhdGE6aW1hZ2Uvc3ZnK3htbCwnICsgZW5jb2RlVVJJQ29tcG9uZW50KHN2Z0ltYWdlLm91dGVySFRNTCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGltYWdlKSB7XG5cdFx0XHRcdGNvbnN0IGltYWdlVG9Db3B5ID0gaW1hZ2U7XG5cdFx0XHRcdGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGUoW25ldyBDbGlwYm9hcmRJdGVtKHtcblx0XHRcdFx0XHQnaW1hZ2UvcG5nJzogbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdFx0XHRcdFx0Y2FudmFzLndpZHRoID0gaW1hZ2VUb0NvcHkubmF0dXJhbFdpZHRoO1xuXHRcdFx0XHRcdFx0Y2FudmFzLmhlaWdodCA9IGltYWdlVG9Db3B5Lm5hdHVyYWxIZWlnaHQ7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cdFx0XHRcdFx0XHRjb250ZXh0IS5kcmF3SW1hZ2UoaW1hZ2VUb0NvcHksIDAsIDApO1xuXG5cdFx0XHRcdFx0XHRjYW52YXMudG9CbG9iKChibG9iKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChibG9iKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZShibG9iKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdObyBibG9iIGRhdGEgdG8gd3JpdGUgdG8gY2xpcGJvYXJkJyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y2FudmFzLnJlbW92ZSgpO1xuXHRcdFx0XHRcdFx0fSwgJ2ltYWdlL3BuZycpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH0pXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgZmluZCBpbWFnZSBlbGVtZW50IHRvIGNvcHkgZm9yIG91dHB1dCB3aXRoIGlkJywgb3V0cHV0SWQpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBjb3B5IGltYWdlOicsIGUpO1xuXHRcdH1cblx0fTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGFzeW5jIHJhd0V2ZW50ID0+IHtcblx0XHRjb25zdCBldmVudCA9IHJhd0V2ZW50IGFzICh7IGRhdGE6IHdlYnZpZXdNZXNzYWdlcy5Ub1dlYnZpZXdNZXNzYWdlIH0pO1xuXG5cdFx0c3dpdGNoIChldmVudC5kYXRhLnR5cGUpIHtcblx0XHRcdGNhc2UgJ2luaXRpYWxpemVNYXJrdXAnOiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoZXZlbnQuZGF0YS5jZWxscy5tYXAoaW5mbyA9PiB2aWV3TW9kZWwuZW5zdXJlTWFya3VwQ2VsbChpbmZvKSkpO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdGRpbWVuc2lvblVwZGF0ZXIudXBkYXRlSW1tZWRpYXRlbHkoKTtcblx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlKCdpbml0aWFsaXplZE1hcmt1cCcsIHsgcmVxdWVzdElkOiBldmVudC5kYXRhLnJlcXVlc3RJZCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2NyZWF0ZU1hcmt1cENlbGwnOlxuXHRcdFx0XHR2aWV3TW9kZWwuZW5zdXJlTWFya3VwQ2VsbChldmVudC5kYXRhLmNlbGwpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAnc2hvd01hcmt1cENlbGwnOlxuXHRcdFx0XHR2aWV3TW9kZWwuc2hvd01hcmt1cENlbGwoZXZlbnQuZGF0YS5pZCwgZXZlbnQuZGF0YS50b3AsIGV2ZW50LmRhdGEuY29udGVudCwgZXZlbnQuZGF0YS5tZXRhZGF0YSk7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdoaWRlTWFya3VwQ2VsbHMnOlxuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGV2ZW50LmRhdGEuaWRzKSB7XG5cdFx0XHRcdFx0dmlld01vZGVsLmhpZGVNYXJrdXBDZWxsKGlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAndW5oaWRlTWFya3VwQ2VsbHMnOlxuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGV2ZW50LmRhdGEuaWRzKSB7XG5cdFx0XHRcdFx0dmlld01vZGVsLnVuaGlkZU1hcmt1cENlbGwoaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdkZWxldGVNYXJrdXBDZWxsJzpcblx0XHRcdFx0Zm9yIChjb25zdCBpZCBvZiBldmVudC5kYXRhLmlkcykge1xuXHRcdFx0XHRcdHZpZXdNb2RlbC5kZWxldGVNYXJrdXBDZWxsKGlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAndXBkYXRlU2VsZWN0ZWRNYXJrdXBDZWxscyc6XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3RlZENlbGxzKGV2ZW50LmRhdGEuc2VsZWN0ZWRDZWxsSWRzKTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2h0bWwnOiB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBldmVudC5kYXRhO1xuXHRcdFx0XHRpZiAoZGF0YS5jcmVhdGVPbklkbGUpIHtcblx0XHRcdFx0XHRvdXRwdXRSdW5uZXIuZW5xdWV1ZUlkbGUoZGF0YS5vdXRwdXRJZCwgc2lnbmFsID0+IHtcblx0XHRcdFx0XHRcdC8vIGNhbmNlbCB0aGUgaWRsZSBjYWxsYmFjayBpZiBpdCBleGlzdHNcblx0XHRcdFx0XHRcdHJldHVybiB2aWV3TW9kZWwucmVuZGVyT3V0cHV0Q2VsbChkYXRhLCBzaWduYWwpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG91dHB1dFJ1bm5lci5lbnF1ZXVlKGRhdGEub3V0cHV0SWQsIHNpZ25hbCA9PiB7XG5cdFx0XHRcdFx0XHQvLyBjYW5jZWwgdGhlIGlkbGUgY2FsbGJhY2sgaWYgaXQgZXhpc3RzXG5cdFx0XHRcdFx0XHRyZXR1cm4gdmlld01vZGVsLnJlbmRlck91dHB1dENlbGwoZGF0YSwgc2lnbmFsKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3ZpZXctc2Nyb2xsJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdC8vIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCctLS0tLSB3aWxsIHNjcm9sbCAtLS0tICAnLCBkYXRlLmdldE1pbnV0ZXMoKSArICc6JyArIGRhdGUuZ2V0U2Vjb25kcygpICsgJzonICsgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG5cblx0XHRcdFx0XHRldmVudC5kYXRhLndpZGdldHMuZm9yRWFjaCh3aWRnZXQgPT4ge1xuXHRcdFx0XHRcdFx0b3V0cHV0UnVubmVyLmVucXVldWUod2lkZ2V0Lm91dHB1dElkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVPdXRwdXRzU2Nyb2xsKFt3aWRnZXRdKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVNYXJrdXBTY3JvbGxzKGV2ZW50LmRhdGEubWFya3VwQ2VsbHMpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRjYXNlICdjbGVhcic6XG5cdFx0XHRcdHJlbmRlcmVycy5jbGVhckFsbCgpO1xuXHRcdFx0XHR2aWV3TW9kZWwuY2xlYXJBbGwoKTtcblx0XHRcdFx0d2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250YWluZXInKSEuaW5uZXJUZXh0ID0gJyc7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdjbGVhck91dHB1dCc6IHtcblx0XHRcdFx0Y29uc3QgeyBjZWxsSWQsIHJlbmRlcmVySWQsIG91dHB1dElkIH0gPSBldmVudC5kYXRhO1xuXHRcdFx0XHRvdXRwdXRSdW5uZXIuY2FuY2VsT3V0cHV0KG91dHB1dElkKTtcblx0XHRcdFx0dmlld01vZGVsLmNsZWFyT3V0cHV0KGNlbGxJZCwgb3V0cHV0SWQsIHJlbmRlcmVySWQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2hpZGVPdXRwdXQnOiB7XG5cdFx0XHRcdGNvbnN0IHsgY2VsbElkLCBvdXRwdXRJZCB9ID0gZXZlbnQuZGF0YTtcblx0XHRcdFx0b3V0cHV0UnVubmVyLmVucXVldWUob3V0cHV0SWQsICgpID0+IHtcblx0XHRcdFx0XHR2aWV3TW9kZWwuaGlkZU91dHB1dChjZWxsSWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdzaG93T3V0cHV0Jzoge1xuXHRcdFx0XHRjb25zdCB7IG91dHB1dElkLCBjZWxsVG9wLCBjZWxsSWQsIGNvbnRlbnQgfSA9IGV2ZW50LmRhdGE7XG5cdFx0XHRcdG91dHB1dFJ1bm5lci5lbnF1ZXVlKG91dHB1dElkLCAoKSA9PiB7XG5cdFx0XHRcdFx0dmlld01vZGVsLnNob3dPdXRwdXQoY2VsbElkLCBvdXRwdXRJZCwgY2VsbFRvcCk7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVBbmRSZXJlbmRlcihjZWxsSWQsIG91dHB1dElkLCBjb250ZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2NvcHlJbWFnZSc6IHtcblx0XHRcdFx0YXdhaXQgY29weU91dHB1dEltYWdlKGV2ZW50LmRhdGEub3V0cHV0SWQsIGV2ZW50LmRhdGEuYWx0T3V0cHV0SWQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2Fjay1kaW1lbnNpb24nOiB7XG5cdFx0XHRcdGZvciAoY29uc3QgeyBjZWxsSWQsIG91dHB1dElkLCBoZWlnaHQgfSBvZiBldmVudC5kYXRhLnVwZGF0ZXMpIHtcblx0XHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlT3V0cHV0SGVpZ2h0KGNlbGxJZCwgb3V0cHV0SWQsIGhlaWdodCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdwcmVsb2FkJzoge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZXMgPSBldmVudC5kYXRhLnJlc291cmNlcztcblx0XHRcdFx0Zm9yIChjb25zdCB7IHVyaSB9IG9mIHJlc291cmNlcykge1xuXHRcdFx0XHRcdGtlcm5lbFByZWxvYWRzLmxvYWQodXJpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3VwZGF0ZVJlbmRlcmVycyc6IHtcblx0XHRcdFx0Y29uc3QgeyByZW5kZXJlckRhdGEgfSA9IGV2ZW50LmRhdGE7XG5cdFx0XHRcdHJlbmRlcmVycy51cGRhdGVSZW5kZXJlckRhdGEocmVuZGVyZXJEYXRhKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdmb2N1cy1vdXRwdXQnOlxuXHRcdFx0XHRmb2N1c0ZpcnN0Rm9jdXNhYmxlT3JDb250YWluZXJJbk91dHB1dChldmVudC5kYXRhLmNlbGxPck91dHB1dElkLCBldmVudC5kYXRhLmFsdGVybmF0ZUlkKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdibHVyLW91dHB1dCc6XG5cdFx0XHRcdGJsdXJPdXRwdXQoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdzZWxlY3Qtb3V0cHV0LWNvbnRlbnRzJzpcblx0XHRcdFx0c2VsZWN0T3V0cHV0Q29udGVudHMoZXZlbnQuZGF0YS5jZWxsT3JPdXRwdXRJZCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2VsZWN0LWlucHV0LWNvbnRlbnRzJzpcblx0XHRcdFx0c2VsZWN0SW5wdXRDb250ZW50cyhldmVudC5kYXRhLmNlbGxPck91dHB1dElkKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkZWNvcmF0aW9ucyc6IHtcblx0XHRcdFx0bGV0IG91dHB1dENvbnRhaW5lciA9IHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChldmVudC5kYXRhLmNlbGxJZCk7XG5cdFx0XHRcdGlmICghb3V0cHV0Q29udGFpbmVyKSB7XG5cdFx0XHRcdFx0dmlld01vZGVsLmVuc3VyZU91dHB1dENlbGwoZXZlbnQuZGF0YS5jZWxsSWQsIC0xMDAwMDAsIHRydWUpO1xuXHRcdFx0XHRcdG91dHB1dENvbnRhaW5lciA9IHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChldmVudC5kYXRhLmNlbGxJZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3V0cHV0Q29udGFpbmVyPy5jbGFzc0xpc3QuYWRkKC4uLmV2ZW50LmRhdGEuYWRkZWRDbGFzc05hbWVzKTtcblx0XHRcdFx0b3V0cHV0Q29udGFpbmVyPy5jbGFzc0xpc3QucmVtb3ZlKC4uLmV2ZW50LmRhdGEucmVtb3ZlZENsYXNzTmFtZXMpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ21hcmt1cERlY29yYXRpb25zJzoge1xuXHRcdFx0XHRjb25zdCBtYXJrdXBDZWxsID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGV2ZW50LmRhdGEuY2VsbElkKTtcblx0XHRcdFx0Ly8gVGhlIGNlbGwgbWF5IG5vdCBoYXZlIGJlZW4gYWRkZWQgeWV0IGlmIGl0IGlzIG91dCBvZiB2aWV3LlxuXHRcdFx0XHQvLyBEZWNvcmF0aW9ucyB3aWxsIGJlIGFkZGVkIHdoZW4gdGhlIGNlbGwgaXMgc2hvd24uXG5cdFx0XHRcdGlmIChtYXJrdXBDZWxsKSB7XG5cdFx0XHRcdFx0bWFya3VwQ2VsbD8uY2xhc3NMaXN0LmFkZCguLi5ldmVudC5kYXRhLmFkZGVkQ2xhc3NOYW1lcyk7XG5cdFx0XHRcdFx0bWFya3VwQ2VsbD8uY2xhc3NMaXN0LnJlbW92ZSguLi5ldmVudC5kYXRhLnJlbW92ZWRDbGFzc05hbWVzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2N1c3RvbUtlcm5lbE1lc3NhZ2UnOlxuXHRcdFx0XHRvbkRpZFJlY2VpdmVLZXJuZWxNZXNzYWdlLmZpcmUoZXZlbnQuZGF0YS5tZXNzYWdlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdjdXN0b21SZW5kZXJlck1lc3NhZ2UnOlxuXHRcdFx0XHRyZW5kZXJlcnMuZ2V0UmVuZGVyZXIoZXZlbnQuZGF0YS5yZW5kZXJlcklkKT8ucmVjZWl2ZU1lc3NhZ2UoZXZlbnQuZGF0YS5tZXNzYWdlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdub3RlYm9va1N0eWxlcyc6IHtcblx0XHRcdFx0Y29uc3QgZG9jdW1lbnRTdHlsZSA9IHdpbmRvdy5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGU7XG5cblx0XHRcdFx0Zm9yIChsZXQgaSA9IGRvY3VtZW50U3R5bGUubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRjb25zdCBwcm9wZXJ0eSA9IGRvY3VtZW50U3R5bGVbaV07XG5cblx0XHRcdFx0XHQvLyBEb24ndCByZW1vdmUgcHJvcGVydGllcyB0aGF0IHRoZSB3ZWJ2aWV3IG1pZ2h0IGhhdmUgYWRkZWQgc2VwYXJhdGVseVxuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eSAmJiBwcm9wZXJ0eS5zdGFydHNXaXRoKCctLW5vdGVib29rLScpKSB7XG5cdFx0XHRcdFx0XHRkb2N1bWVudFN0eWxlLnJlbW92ZVByb3BlcnR5KHByb3BlcnR5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZS1hZGQgbmV3IHByb3BlcnRpZXNcblx0XHRcdFx0Zm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGV2ZW50LmRhdGEuc3R5bGVzKSkge1xuXHRcdFx0XHRcdGRvY3VtZW50U3R5bGUuc2V0UHJvcGVydHkoYC0tJHtuYW1lfWAsIHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ25vdGVib29rT3B0aW9ucyc6XG5cdFx0XHRcdGN1cnJlbnRPcHRpb25zID0gZXZlbnQuZGF0YS5vcHRpb25zO1xuXHRcdFx0XHR2aWV3TW9kZWwudG9nZ2xlRHJhZ0Ryb3BFbmFibGVkKGN1cnJlbnRPcHRpb25zLmRyYWdBbmREcm9wRW5hYmxlZCk7XG5cdFx0XHRcdGN1cnJlbnRSZW5kZXJPcHRpb25zID0gZXZlbnQuZGF0YS5yZW5kZXJPcHRpb25zO1xuXHRcdFx0XHRzZXR0aW5nQ2hhbmdlLmZpcmUoY3VycmVudFJlbmRlck9wdGlvbnMpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3Rva2VuaXplZENvZGVCbG9jayc6IHtcblx0XHRcdFx0Y29uc3QgeyBjb2RlQmxvY2tJZCwgaHRtbCB9ID0gZXZlbnQuZGF0YTtcblx0XHRcdFx0TWFya2Rvd25Db2RlQmxvY2suaGlnaGxpZ2h0Q29kZUJsb2NrKGNvZGVCbG9ja0lkLCBodG1sKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICd0b2tlbml6ZWRTdHlsZXNDaGFuZ2VkJzoge1xuXHRcdFx0XHR0b2tlbml6YXRpb25TdHlsZS5yZXBsYWNlU3luYyhldmVudC5kYXRhLmNzcyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZmluZCc6IHtcblx0XHRcdFx0X2hpZ2hsaWdodGVyLnJlbW92ZUhpZ2hsaWdodHMoZXZlbnQuZGF0YS5vcHRpb25zLm93bmVySUQpO1xuXHRcdFx0XHRmaW5kKGV2ZW50LmRhdGEucXVlcnksIGV2ZW50LmRhdGEub3B0aW9ucyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZmluZEhpZ2hsaWdodEN1cnJlbnQnOiB7XG5cdFx0XHRcdF9oaWdobGlnaHRlcj8uaGlnaGxpZ2h0Q3VycmVudE1hdGNoKGV2ZW50LmRhdGEuaW5kZXgsIGV2ZW50LmRhdGEub3duZXJJRCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZmluZFVuSGlnaGxpZ2h0Q3VycmVudCc6IHtcblx0XHRcdFx0X2hpZ2hsaWdodGVyPy51bkhpZ2hsaWdodEN1cnJlbnRNYXRjaChldmVudC5kYXRhLmluZGV4LCBldmVudC5kYXRhLm93bmVySUQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2ZpbmRTdG9wJzoge1xuXHRcdFx0XHRfaGlnaGxpZ2h0ZXIucmVtb3ZlSGlnaGxpZ2h0cyhldmVudC5kYXRhLm93bmVySUQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3JldHVybk91dHB1dEl0ZW0nOiB7XG5cdFx0XHRcdG91dHB1dEl0ZW1SZXF1ZXN0cy5yZXNvbHZlT3V0cHV0SXRlbShldmVudC5kYXRhLnJlcXVlc3RJZCwgZXZlbnQuZGF0YS5vdXRwdXQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Y29uc3QgcmVuZGVyRmFsbGJhY2tFcnJvck5hbWUgPSAndnNjb2RlLmZhbGxiYWNrVG9OZXh0UmVuZGVyZXInO1xuXG5cdGNsYXNzIFJlbmRlcmVyIHtcblxuXHRcdHByaXZhdGUgX29uTWVzc2FnZUV2ZW50ID0gY3JlYXRlRW1pdHRlcigpO1xuXHRcdHByaXZhdGUgX2xvYWRQcm9taXNlPzogUHJvbWlzZTxyZW5kZXJlckFwaS5SZW5kZXJlckFwaSB8IHVuZGVmaW5lZD47XG5cdFx0cHJpdmF0ZSBfYXBpOiByZW5kZXJlckFwaS5SZW5kZXJlckFwaSB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IGRhdGE6IHdlYnZpZXdNZXNzYWdlcy5SZW5kZXJlck1ldGFkYXRhLFxuXHRcdCkgeyB9XG5cblx0XHRwdWJsaWMgcmVjZWl2ZU1lc3NhZ2UobWVzc2FnZTogdW5rbm93bikge1xuXHRcdFx0dGhpcy5fb25NZXNzYWdlRXZlbnQuZmlyZShtZXNzYWdlKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgYXN5bmMgcmVuZGVyT3V0cHV0SXRlbShpdGVtOiByZW5kZXJlckFwaS5PdXRwdXRJdGVtLCBlbGVtZW50OiBIVE1MRWxlbWVudCwgc2lnbmFsOiBBYm9ydFNpZ25hbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5sb2FkKCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGlmICghc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRzaG93UmVuZGVyRXJyb3IoYEVycm9yIGxvYWRpbmcgcmVuZGVyZXIgJyR7dGhpcy5kYXRhLmlkfSdgLCBlbGVtZW50LCBlIGluc3RhbmNlb2YgRXJyb3IgPyBbZV0gOiBbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuX2FwaSkge1xuXHRcdFx0XHRpZiAoIXNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0c2hvd1JlbmRlckVycm9yKGBSZW5kZXJlciAnJHt0aGlzLmRhdGEuaWR9JyBkb2VzIG5vdCBpbXBsZW1lbnQgcmVuZGVyT3V0cHV0SXRlbWAsIGVsZW1lbnQsIFtdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlclN0YXJ0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX2FwaS5yZW5kZXJPdXRwdXRJdGVtKGl0ZW0sIGVsZW1lbnQsIHNpZ25hbCk7XG5cdFx0XHRcdHRoaXMucG9zdERlYnVnTWVzc2FnZSgnUmVuZGVyZWQgb3V0cHV0IGl0ZW0nLCB7IGlkOiBpdGVtLmlkLCBkdXJhdGlvbjogYCR7cGVyZm9ybWFuY2Uubm93KCkgLSByZW5kZXJTdGFydH1tc2AgfSk7XG5cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0aWYgKHNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09IHJlbmRlckZhbGxiYWNrRXJyb3JOYW1lKSB7XG5cdFx0XHRcdFx0dGhyb3cgZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNob3dSZW5kZXJFcnJvcihgRXJyb3IgcmVuZGVyaW5nIG91dHB1dCBpdGVtIHVzaW5nICcke3RoaXMuZGF0YS5pZH0nYCwgZWxlbWVudCwgZSBpbnN0YW5jZW9mIEVycm9yID8gW2VdIDogW10pO1xuXHRcdFx0XHR0aGlzLnBvc3REZWJ1Z01lc3NhZ2UoJ1JlbmRlcmluZyBvdXRwdXQgaXRlbSBmYWlsZWQnLCB7IGlkOiBpdGVtLmlkLCBlcnJvcjogZSArICcnIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHB1YmxpYyBkaXNwb3NlT3V0cHV0SXRlbShpZD86IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0dGhpcy5fYXBpPy5kaXNwb3NlT3V0cHV0SXRlbT8uKGlkKTtcblx0XHR9XG5cblx0XHRwcml2YXRlIGNyZWF0ZVJlbmRlcmVyQ29udGV4dCgpOiBSZW5kZXJlckNvbnRleHQge1xuXHRcdFx0Y29uc3QgeyBpZCwgbWVzc2FnaW5nIH0gPSB0aGlzLmRhdGE7XG5cdFx0XHRjb25zdCBjb250ZXh0OiBSZW5kZXJlckNvbnRleHQgPSB7XG5cdFx0XHRcdHNldFN0YXRlOiBuZXdTdGF0ZSA9PiB2c2NvZGUuc2V0U3RhdGUoeyAuLi52c2NvZGUuZ2V0U3RhdGUoKSwgW2lkXTogbmV3U3RhdGUgfSksXG5cdFx0XHRcdGdldFN0YXRlOiA8VD4oKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhdGUgPSB2c2NvZGUuZ2V0U3RhdGUoKTtcblx0XHRcdFx0XHRyZXR1cm4gdHlwZW9mIHN0YXRlID09PSAnb2JqZWN0JyAmJiBzdGF0ZSA/IHN0YXRlW2lkXSBhcyBUIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRSZW5kZXJlcjogYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRjb25zdCByZW5kZXJlciA9IHJlbmRlcmVycy5nZXRSZW5kZXJlcihpZCk7XG5cdFx0XHRcdFx0aWYgKCFyZW5kZXJlcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHJlbmRlcmVyLl9hcGkpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZW5kZXJlci5fYXBpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVuZGVyZXIubG9hZCgpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR3b3Jrc3BhY2U6IHtcblx0XHRcdFx0XHRnZXQgaXNUcnVzdGVkKCkgeyByZXR1cm4gaXNXb3Jrc3BhY2VUcnVzdGVkOyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdFx0Z2V0IGxpbmVMaW1pdCgpIHsgcmV0dXJuIGN1cnJlbnRSZW5kZXJPcHRpb25zLmxpbmVMaW1pdDsgfSxcblx0XHRcdFx0XHRnZXQgb3V0cHV0U2Nyb2xsaW5nKCkgeyByZXR1cm4gY3VycmVudFJlbmRlck9wdGlvbnMub3V0cHV0U2Nyb2xsaW5nOyB9LFxuXHRcdFx0XHRcdGdldCBvdXRwdXRXb3JkV3JhcCgpIHsgcmV0dXJuIGN1cnJlbnRSZW5kZXJPcHRpb25zLm91dHB1dFdvcmRXcmFwOyB9LFxuXHRcdFx0XHRcdGdldCBsaW5raWZ5RmlsZVBhdGhzKCkgeyByZXR1cm4gY3VycmVudFJlbmRlck9wdGlvbnMubGlua2lmeUZpbGVQYXRoczsgfSxcblx0XHRcdFx0XHRnZXQgbWluaW1hbEVycm9yKCkgeyByZXR1cm4gY3VycmVudFJlbmRlck9wdGlvbnMubWluaW1hbEVycm9yOyB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXQgb25EaWRDaGFuZ2VTZXR0aW5ncygpIHsgcmV0dXJuIHNldHRpbmdDaGFuZ2UuZXZlbnQ7IH1cblx0XHRcdH07XG5cblx0XHRcdGlmIChtZXNzYWdpbmcpIHtcblx0XHRcdFx0Y29udGV4dC5vbkRpZFJlY2VpdmVNZXNzYWdlID0gdGhpcy5fb25NZXNzYWdlRXZlbnQuZXZlbnQ7XG5cdFx0XHRcdGNvbnRleHQucG9zdE1lc3NhZ2UgPSBtZXNzYWdlID0+IHBvc3ROb3RlYm9va01lc3NhZ2UoJ2N1c3RvbVJlbmRlcmVyTWVzc2FnZScsIHsgcmVuZGVyZXJJZDogaWQsIG1lc3NhZ2UgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgbG9hZCgpOiBQcm9taXNlPHJlbmRlcmVyQXBpLlJlbmRlcmVyQXBpIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHR0aGlzLl9sb2FkUHJvbWlzZSA/Pz0gdGhpcy5fbG9hZCgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xvYWRQcm9taXNlO1xuXHRcdH1cblxuXHRcdC8qKiBJbm5lciBmdW5jdGlvbiBjYWNoZWQgaW4gdGhlIF9sb2FkUHJvbWlzZSgpLiAqL1xuXHRcdHByaXZhdGUgYXN5bmMgX2xvYWQoKTogUHJvbWlzZTxyZW5kZXJlckFwaS5SZW5kZXJlckFwaSB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0dGhpcy5wb3N0RGVidWdNZXNzYWdlKCdTdGFydCBsb2FkaW5nIHJlbmRlcmVyJyk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIFByZWxvYWRzIG5lZWQgdG8gYmUgbG9hZGVkIGJlZm9yZSBsb2FkaW5nIHJlbmRlcmVycy5cblx0XHRcdFx0YXdhaXQga2VybmVsUHJlbG9hZHMud2FpdEZvckFsbEN1cnJlbnQoKTtcblxuXHRcdFx0XHRjb25zdCBpbXBvcnRTdGFydCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHRcdFx0XHRjb25zdCBtb2R1bGU6IFJlbmRlcmVyTW9kdWxlID0gYXdhaXQgX19pbXBvcnQodGhpcy5kYXRhLmVudHJ5cG9pbnQucGF0aCk7XG5cdFx0XHRcdHRoaXMucG9zdERlYnVnTWVzc2FnZSgnSW1wb3J0ZWQgcmVuZGVyZXInLCB7IGR1cmF0aW9uOiBgJHtwZXJmb3JtYW5jZS5ub3coKSAtIGltcG9ydFN0YXJ0fW1zYCB9KTtcblxuXHRcdFx0XHRpZiAoIW1vZHVsZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2FwaSA9IGF3YWl0IG1vZHVsZS5hY3RpdmF0ZSh0aGlzLmNyZWF0ZVJlbmRlcmVyQ29udGV4dCgpKTtcblx0XHRcdFx0dGhpcy5wb3N0RGVidWdNZXNzYWdlKCdBY3RpdmF0ZWQgcmVuZGVyZXInLCB7IGR1cmF0aW9uOiBgJHtwZXJmb3JtYW5jZS5ub3coKSAtIGltcG9ydFN0YXJ0fW1zYCB9KTtcblxuXHRcdFx0XHRjb25zdCBkZXBlbmRhbnRSZW5kZXJlcnMgPSBjdHgucmVuZGVyZXJEYXRhXG5cdFx0XHRcdFx0LmZpbHRlcihkID0+IGQuZW50cnlwb2ludC5leHRlbmRzID09PSB0aGlzLmRhdGEuaWQpO1xuXG5cdFx0XHRcdGlmIChkZXBlbmRhbnRSZW5kZXJlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5wb3N0RGVidWdNZXNzYWdlKCdBY3RpdmF0aW5nIGRlcGVuZGFudCByZW5kZXJlcnMnLCB7IGRlcGVuZGVudHM6IGRlcGVuZGFudFJlbmRlcmVycy5tYXAoeCA9PiB4LmlkKS5qb2luKCcsICcpIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTG9hZCBhbGwgcmVuZGVyZXJzIHRoYXQgZXh0ZW5kIHRoaXMgcmVuZGVyZXJcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoZGVwZW5kYW50UmVuZGVyZXJzLm1hcChhc3luYyBkID0+IHtcblx0XHRcdFx0XHRjb25zdCByZW5kZXJlciA9IHJlbmRlcmVycy5nZXRSZW5kZXJlcihkLmlkKTtcblx0XHRcdFx0XHRpZiAoIXJlbmRlcmVyKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIGV4dGVuZGluZyByZW5kZXJlcjogJHtkLmlkfWApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgcmVuZGVyZXIubG9hZCgpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdC8vIFNxdWFzaCBhbnkgZXJyb3JzIGV4dGVuZHMgZXJyb3JzLiBUaGV5IHdvbid0IHByZXZlbnQgdGhlIHJlbmRlcmVyXG5cdFx0XHRcdFx0XHQvLyBpdHNlbGYgZnJvbSB3b3JraW5nLCBzbyBqdXN0IGxvZyB0aGVtLlxuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlKTtcblx0XHRcdFx0XHRcdHRoaXMucG9zdERlYnVnTWVzc2FnZSgnQWN0aXZhdGluZyBkZXBlbmRhbnQgcmVuZGVyZXIgZmFpbGVkJywgeyBkZXBlbmRlbnQ6IGQuaWQsIGVycm9yOiBlICsgJycgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLl9hcGk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMucG9zdERlYnVnTWVzc2FnZSgnTG9hZGluZyByZW5kZXJlciBmYWlsZWQnKTtcblx0XHRcdFx0dGhyb3cgZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwcml2YXRlIHBvc3REZWJ1Z01lc3NhZ2UobXNnOiBzdHJpbmcsIGRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG5cdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JTG9nUmVuZGVyZXJEZWJ1Z01lc3NhZ2U+KCdsb2dSZW5kZXJlckRlYnVnTWVzc2FnZScsIHtcblx0XHRcdFx0bWVzc2FnZTogYFtyZW5kZXJlciAke3RoaXMuZGF0YS5pZH1dIC0gJHttc2d9YCxcblx0XHRcdFx0ZGF0YVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3Qga2VybmVsUHJlbG9hZHMgPSBuZXcgY2xhc3Mge1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJlbG9hZHMgPSBuZXcgTWFwPHN0cmluZyAvKiB1cmkgKi8sIFByb21pc2U8dW5rbm93bj4+KCk7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIGdpdmVuIHByZWxvYWQgaXMgYWN0aXZhdGVkLlxuXHRcdCAqL1xuXHRcdHB1YmxpYyB3YWl0Rm9yKHVyaTogc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVsb2Fkcy5nZXQodXJpKSB8fCBQcm9taXNlLnJlc29sdmUobmV3IEVycm9yKGBQcmVsb2FkIG5vdCByZWFkeTogJHt1cml9YCkpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIExvYWRzIGEgcHJlbG9hZC5cblx0XHQgKiBAcGFyYW0gdXJpIFVSSSB0byBsb2FkIGZyb21cblx0XHQgKiBAcGFyYW0gb3JpZ2luYWxVcmkgVVJJIHRvIHNob3cgaW4gYW4gZXJyb3IgbWVzc2FnZSBpZiB0aGUgcHJlbG9hZCBpcyBpbnZhbGlkLlxuXHRcdCAqL1xuXHRcdHB1YmxpYyBsb2FkKHVyaTogc3RyaW5nKSB7XG5cdFx0XHRjb25zdCBwcm9taXNlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRydW5LZXJuZWxQcmVsb2FkKHVyaSksXG5cdFx0XHRcdHRoaXMud2FpdEZvckFsbEN1cnJlbnQoKSxcblx0XHRcdF0pO1xuXG5cdFx0XHR0aGlzLnByZWxvYWRzLnNldCh1cmksIHByb21pc2UpO1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJucyBhIHByb21pc2UgdGhhdCB3YWl0cyBmb3IgYWxsIGN1cnJlbnRseS1yZWdpc3RlcmVkIHByZWxvYWRzIHRvXG5cdFx0ICogYWN0aXZhdGUgYmVmb3JlIHJlc29sdmluZy5cblx0XHQgKi9cblx0XHRwdWJsaWMgd2FpdEZvckFsbEN1cnJlbnQoKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoWy4uLnRoaXMucHJlbG9hZHMudmFsdWVzKCldLm1hcChwID0+IHAuY2F0Y2goZXJyID0+IGVycikpKTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3Qgb3V0cHV0UnVubmVyID0gbmV3IGNsYXNzIHtcblx0XHRwcml2YXRlIHJlYWRvbmx5IG91dHB1dHMgPSBuZXcgTWFwPHN0cmluZywgeyBhYm9ydDogQWJvcnRDb250cm9sbGVyOyBxdWV1ZTogUHJvbWlzZTx1bmtub3duPiB9PigpO1xuXG5cdFx0LyoqXG5cdFx0ICogUHVzaGVzIHRoZSBhY3Rpb24gb250byB0aGUgbGlzdCBvZiBhY3Rpb25zIGZvciB0aGUgZ2l2ZW4gb3V0cHV0IElELFxuXHRcdCAqIGVuc3VyaW5nIHRoYXQgaXQncyBydW4gaW4tb3JkZXIuXG5cdFx0ICovXG5cdFx0cHVibGljIGVucXVldWUob3V0cHV0SWQ6IHN0cmluZywgYWN0aW9uOiAoY2FuY2VsU2lnbmFsOiBBYm9ydFNpZ25hbCkgPT4gdW5rbm93bikge1xuXHRcdFx0dGhpcy5wZW5kaW5nT3V0cHV0Q3JlYXRpb25SZXF1ZXN0LmdldChvdXRwdXRJZCk/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucGVuZGluZ091dHB1dENyZWF0aW9uUmVxdWVzdC5kZWxldGUob3V0cHV0SWQpO1xuXG5cdFx0XHRjb25zdCByZWNvcmQgPSB0aGlzLm91dHB1dHMuZ2V0KG91dHB1dElkKTtcblx0XHRcdGlmICghcmVjb3JkKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0XHRcdHRoaXMub3V0cHV0cy5zZXQob3V0cHV0SWQsIHsgYWJvcnQ6IGNvbnRyb2xsZXIsIHF1ZXVlOiBuZXcgUHJvbWlzZShyID0+IHIoYWN0aW9uKGNvbnRyb2xsZXIuc2lnbmFsKSkpIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVjb3JkLnF1ZXVlID0gcmVjb3JkLnF1ZXVlLnRoZW4oYXN5bmMgciA9PiB7XG5cdFx0XHRcdFx0aWYgKCFyZWNvcmQuYWJvcnQuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRcdGF3YWl0IGFjdGlvbihyZWNvcmQuYWJvcnQuc2lnbmFsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByaXZhdGUgcGVuZGluZ091dHB1dENyZWF0aW9uUmVxdWVzdDogTWFwPHN0cmluZywgSURpc3Bvc2FibGU+ID0gbmV3IE1hcCgpO1xuXG5cdFx0cHVibGljIGVucXVldWVJZGxlKG91dHB1dElkOiBzdHJpbmcsIGFjdGlvbjogKGNhbmNlbFNpZ25hbDogQWJvcnRTaWduYWwpID0+IHVua25vd24pIHtcblx0XHRcdHRoaXMucGVuZGluZ091dHB1dENyZWF0aW9uUmVxdWVzdC5nZXQob3V0cHV0SWQpPy5kaXNwb3NlKCk7XG5cdFx0XHRvdXRwdXRSdW5uZXIucGVuZGluZ091dHB1dENyZWF0aW9uUmVxdWVzdC5zZXQob3V0cHV0SWQsIHJ1bldoZW5JZGxlKCgpID0+IHtcblx0XHRcdFx0b3V0cHV0UnVubmVyLmVucXVldWUob3V0cHV0SWQsIGFjdGlvbik7XG5cdFx0XHRcdG91dHB1dFJ1bm5lci5wZW5kaW5nT3V0cHV0Q3JlYXRpb25SZXF1ZXN0LmRlbGV0ZShvdXRwdXRJZCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VscyB0aGUgcmVuZGVyaW5nIG9mIGFsbCBvdXRwdXRzLlxuXHRcdCAqL1xuXHRcdHB1YmxpYyBjYW5jZWxBbGwoKSB7XG5cdFx0XHQvLyBEZWxldGUgYWxsIHBlbmRpbmcgaWRsZSByZXF1ZXN0c1xuXHRcdFx0dGhpcy5wZW5kaW5nT3V0cHV0Q3JlYXRpb25SZXF1ZXN0LmZvckVhY2gociA9PiByLmRpc3Bvc2UoKSk7XG5cdFx0XHR0aGlzLnBlbmRpbmdPdXRwdXRDcmVhdGlvblJlcXVlc3QuY2xlYXIoKTtcblxuXHRcdFx0Zm9yIChjb25zdCB7IGFib3J0IH0gb2YgdGhpcy5vdXRwdXRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGFib3J0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm91dHB1dHMuY2xlYXIoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWxzIGFueSBvbmdvaW5nIHJlbmRlcmluZyBvdXQgYW4gb3V0cHV0LlxuXHRcdCAqL1xuXHRcdHB1YmxpYyBjYW5jZWxPdXRwdXQob3V0cHV0SWQ6IHN0cmluZykge1xuXHRcdFx0Ly8gRGVsZXRlIHRoZSBwZW5kaW5nIGlkbGUgcmVxdWVzdCBpZiBpdCBleGlzdHNcblx0XHRcdHRoaXMucGVuZGluZ091dHB1dENyZWF0aW9uUmVxdWVzdC5nZXQob3V0cHV0SWQpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLnBlbmRpbmdPdXRwdXRDcmVhdGlvblJlcXVlc3QuZGVsZXRlKG91dHB1dElkKTtcblxuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gdGhpcy5vdXRwdXRzLmdldChvdXRwdXRJZCk7XG5cdFx0XHRpZiAob3V0cHV0KSB7XG5cdFx0XHRcdG91dHB1dC5hYm9ydC5hYm9ydCgpO1xuXHRcdFx0XHR0aGlzLm91dHB1dHMuZGVsZXRlKG91dHB1dElkKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0Y29uc3QgcmVuZGVyZXJzID0gbmV3IGNsYXNzIHtcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJlcnMgPSBuZXcgTWFwPC8qIGlkICovIHN0cmluZywgUmVuZGVyZXI+KCk7XG5cblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdGZvciAoY29uc3QgcmVuZGVyZXIgb2YgY3R4LnJlbmRlcmVyRGF0YSkge1xuXHRcdFx0XHR0aGlzLmFkZFJlbmRlcmVyKHJlbmRlcmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwdWJsaWMgZ2V0UmVuZGVyZXIoaWQ6IHN0cmluZyk6IFJlbmRlcmVyIHwgdW5kZWZpbmVkIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZW5kZXJlcnMuZ2V0KGlkKTtcblx0XHR9XG5cblx0XHRwcml2YXRlIHJlbmRlcmVyRXF1YWwoYTogd2Vidmlld01lc3NhZ2VzLlJlbmRlcmVyTWV0YWRhdGEsIGI6IHdlYnZpZXdNZXNzYWdlcy5SZW5kZXJlck1ldGFkYXRhKSB7XG5cdFx0XHRpZiAoYS5pZCAhPT0gYi5pZCB8fCBhLmVudHJ5cG9pbnQucGF0aCAhPT0gYi5lbnRyeXBvaW50LnBhdGggfHwgYS5lbnRyeXBvaW50LmV4dGVuZHMgIT09IGIuZW50cnlwb2ludC5leHRlbmRzIHx8IGEubWVzc2FnaW5nICE9PSBiLm1lc3NhZ2luZykge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhLm1pbWVUeXBlcy5sZW5ndGggIT09IGIubWltZVR5cGVzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYS5taW1lVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGEubWltZVR5cGVzW2ldICE9PSBiLm1pbWVUeXBlc1tpXSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRwdWJsaWMgdXBkYXRlUmVuZGVyZXJEYXRhKHJlbmRlcmVyRGF0YTogcmVhZG9ubHkgd2Vidmlld01lc3NhZ2VzLlJlbmRlcmVyTWV0YWRhdGFbXSkge1xuXHRcdFx0Y29uc3Qgb2xkS2V5cyA9IG5ldyBTZXQodGhpcy5fcmVuZGVyZXJzLmtleXMoKSk7XG5cdFx0XHRjb25zdCBuZXdLZXlzID0gbmV3IFNldChyZW5kZXJlckRhdGEubWFwKGQgPT4gZC5pZCkpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHJlbmRlcmVyIG9mIHJlbmRlcmVyRGF0YSkge1xuXHRcdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX3JlbmRlcmVycy5nZXQocmVuZGVyZXIuaWQpO1xuXHRcdFx0XHRpZiAoZXhpc3RpbmcgJiYgdGhpcy5yZW5kZXJlckVxdWFsKGV4aXN0aW5nLmRhdGEsIHJlbmRlcmVyKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5hZGRSZW5kZXJlcihyZW5kZXJlcik7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIG9sZEtleXMpIHtcblx0XHRcdFx0aWYgKCFuZXdLZXlzLmhhcyhrZXkpKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVuZGVyZXJzLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBhZGRSZW5kZXJlcihyZW5kZXJlcjogd2Vidmlld01lc3NhZ2VzLlJlbmRlcmVyTWV0YWRhdGEpIHtcblx0XHRcdHRoaXMuX3JlbmRlcmVycy5zZXQocmVuZGVyZXIuaWQsIG5ldyBSZW5kZXJlcihyZW5kZXJlcikpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBjbGVhckFsbCgpIHtcblx0XHRcdG91dHB1dFJ1bm5lci5jYW5jZWxBbGwoKTtcblx0XHRcdGZvciAoY29uc3QgcmVuZGVyZXIgb2YgdGhpcy5fcmVuZGVyZXJzLnZhbHVlcygpKSB7XG5cdFx0XHRcdHJlbmRlcmVyLmRpc3Bvc2VPdXRwdXRJdGVtKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHVibGljIGNsZWFyT3V0cHV0KHJlbmRlcmVySWQ6IHN0cmluZywgb3V0cHV0SWQ6IHN0cmluZykge1xuXHRcdFx0b3V0cHV0UnVubmVyLmNhbmNlbE91dHB1dChvdXRwdXRJZCk7XG5cdFx0XHR0aGlzLl9yZW5kZXJlcnMuZ2V0KHJlbmRlcmVySWQpPy5kaXNwb3NlT3V0cHV0SXRlbShvdXRwdXRJZCk7XG5cdFx0fVxuXG5cdFx0cHVibGljIGFzeW5jIHJlbmRlcihpdGVtOiBFeHRlbmRlZE91dHB1dEl0ZW0sIHByZWZlcnJlZFJlbmRlcmVySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZWxlbWVudDogSFRNTEVsZW1lbnQsIHNpZ25hbDogQWJvcnRTaWduYWwpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IHByaW1hcnlSZW5kZXJlciA9IHRoaXMuZmluZFJlbmRlcmVyKHByZWZlcnJlZFJlbmRlcmVySWQsIGl0ZW0pO1xuXHRcdFx0aWYgKCFwcmltYXJ5UmVuZGVyZXIpIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gKHdpbmRvdy5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1ub3RlYm9vay1jZWxsLXJlbmRlcmVyLW5vdC1mb3VuZC1lcnJvcicpIHx8ICcnKS5yZXBsYWNlKCckMCcsICgpID0+IGl0ZW0ubWltZSk7XG5cdFx0XHRcdHRoaXMuc2hvd1JlbmRlckVycm9yKGl0ZW0sIGVsZW1lbnQsIGVycm9yTWVzc2FnZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVHJ5IHByaW1hcnkgcmVuZGVyZXIgZmlyc3Rcblx0XHRcdGlmICghKGF3YWl0IHRoaXMuX2RvUmVuZGVyKGl0ZW0sIGVsZW1lbnQsIHByaW1hcnlSZW5kZXJlciwgc2lnbmFsKSkuY29udGludWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBQcmltYXJ5IHJlbmRlcmVyIGZhaWxlZCBpbiBhbiBleHBlY3RlZCB3YXkuIEZhbGxiYWNrIHRvIHJlbmRlciB0aGUgbmV4dCBtaW1lIHR5cGVzXG5cdFx0XHRmb3IgKGNvbnN0IGFkZGl0aW9uYWxJdGVtRGF0YSBvZiBpdGVtLl9hbGxPdXRwdXRJdGVtcykge1xuXHRcdFx0XHRpZiAoYWRkaXRpb25hbEl0ZW1EYXRhLm1pbWUgPT09IGl0ZW0ubWltZSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgYWRkaXRpb25hbEl0ZW0gPSBhd2FpdCBhZGRpdGlvbmFsSXRlbURhdGEuZ2V0SXRlbSgpO1xuXHRcdFx0XHRpZiAoc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYWRkaXRpb25hbEl0ZW0pIHtcblx0XHRcdFx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMuZmluZFJlbmRlcmVyKHVuZGVmaW5lZCwgYWRkaXRpb25hbEl0ZW0pO1xuXHRcdFx0XHRcdGlmIChyZW5kZXJlcikge1xuXHRcdFx0XHRcdFx0aWYgKCEoYXdhaXQgdGhpcy5fZG9SZW5kZXIoYWRkaXRpb25hbEl0ZW0sIGVsZW1lbnQsIHJlbmRlcmVyLCBzaWduYWwpKS5jb250aW51ZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47IC8vIFdlIHJlbmRlcmVkIHN1Y2Nlc3NmdWxseVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBBbGwgcmVuZGVyZXJzIGhhdmUgZmFpbGVkIGFuZCB0aGVyZSBpcyBub3RoaW5nIGxlZnQgdG8gZmFsbGJhY2sgdG9cblx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9ICh3aW5kb3cuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tbm90ZWJvb2stY2VsbC1yZW5kZXJlci1mYWxsYmFja3MtZXhoYXVzdGVkJykgfHwgJycpLnJlcGxhY2UoJyQwJywgKCkgPT4gaXRlbS5taW1lKTtcblx0XHRcdHRoaXMuc2hvd1JlbmRlckVycm9yKGl0ZW0sIGVsZW1lbnQsIGVycm9yTWVzc2FnZSk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBhc3luYyBfZG9SZW5kZXIoaXRlbTogcmVuZGVyZXJBcGkuT3V0cHV0SXRlbSwgZWxlbWVudDogSFRNTEVsZW1lbnQsIHJlbmRlcmVyOiBSZW5kZXJlciwgc2lnbmFsOiBBYm9ydFNpZ25hbCk6IFByb21pc2U8eyBjb250aW51ZTogYm9vbGVhbiB9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCByZW5kZXJlci5yZW5kZXJPdXRwdXRJdGVtKGl0ZW0sIGVsZW1lbnQsIHNpZ25hbCk7XG5cdFx0XHRcdHJldHVybiB7IGNvbnRpbnVlOiBmYWxzZSB9OyAvLyBXZSByZW5kZXJlZCBzdWNjZXNzZnVsbHlcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0aWYgKHNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgY29udGludWU6IGZhbHNlIH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIGUubmFtZSA9PT0gcmVuZGVyRmFsbGJhY2tFcnJvck5hbWUpIHtcblx0XHRcdFx0XHRyZXR1cm4geyBjb250aW51ZTogdHJ1ZSB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IGU7IC8vIEJhaWwgYW5kIGxldCBjYWxsZXJzIGhhbmRsZSB1bmtub3duIGVycm9yc1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBmaW5kUmVuZGVyZXIocHJlZmVycmVkUmVuZGVyZXJJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBpbmZvOiByZW5kZXJlckFwaS5PdXRwdXRJdGVtKSB7XG5cdFx0XHRsZXQgcmVuZGVyZXI6IFJlbmRlcmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAodHlwZW9mIHByZWZlcnJlZFJlbmRlcmVySWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJlbmRlcmVyID0gQXJyYXkuZnJvbSh0aGlzLl9yZW5kZXJlcnMudmFsdWVzKCkpXG5cdFx0XHRcdFx0LmZpbmQoKHJlbmRlcmVyKSA9PiByZW5kZXJlci5kYXRhLmlkID09PSBwcmVmZXJyZWRSZW5kZXJlcklkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVycyA9IEFycmF5LmZyb20odGhpcy5fcmVuZGVyZXJzLnZhbHVlcygpKVxuXHRcdFx0XHRcdC5maWx0ZXIoKHJlbmRlcmVyKSA9PiByZW5kZXJlci5kYXRhLm1pbWVUeXBlcy5pbmNsdWRlcyhpbmZvLm1pbWUpICYmICFyZW5kZXJlci5kYXRhLmVudHJ5cG9pbnQuZXh0ZW5kcyk7XG5cblx0XHRcdFx0aWYgKHJlbmRlcmVycy5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBEZS1wcmlvcml0aXplIGJ1aWx0LWluIHJlbmRlcmVyc1xuXHRcdFx0XHRcdHJlbmRlcmVycy5zb3J0KChhLCBiKSA9PiArYS5kYXRhLmlzQnVpbHRpbiAtICtiLmRhdGEuaXNCdWlsdGluKTtcblxuXHRcdFx0XHRcdC8vIFVzZSBmaXJzdCByZW5kZXJlciB3ZSBmaW5kIGluIHNvcnRlZCBsaXN0XG5cdFx0XHRcdFx0cmVuZGVyZXIgPSByZW5kZXJlcnNbMF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZW5kZXJlcjtcblx0XHR9XG5cblx0XHRwcml2YXRlIHNob3dSZW5kZXJFcnJvcihpbmZvOiByZW5kZXJlckFwaS5PdXRwdXRJdGVtLCBlbGVtZW50OiBIVE1MRWxlbWVudCwgZXJyb3JNZXNzYWdlOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGVycm9yQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0XHRcdGNvbnN0IGVycm9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRlcnJvci5jbGFzc05hbWUgPSAnbm8tcmVuZGVyZXItZXJyb3InO1xuXHRcdFx0ZXJyb3IuaW5uZXJUZXh0ID0gZXJyb3JNZXNzYWdlO1xuXG5cdFx0XHRjb25zdCBjZWxsVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0Y2VsbFRleHQuaW5uZXJUZXh0ID0gaW5mby50ZXh0KCk7XG5cblx0XHRcdGVycm9yQ29udGFpbmVyLmFwcGVuZENoaWxkKGVycm9yKTtcblx0XHRcdGVycm9yQ29udGFpbmVyLmFwcGVuZENoaWxkKGNlbGxUZXh0KTtcblxuXHRcdFx0ZWxlbWVudC5pbm5lclRleHQgPSAnJztcblx0XHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoZXJyb3JDb250YWluZXIpO1xuXHRcdH1cblx0fSgpO1xuXG5cdGNvbnN0IHZpZXdNb2RlbCA9IG5ldyBjbGFzcyBWaWV3TW9kZWwge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWFya3VwQ2VsbHMgPSBuZXcgTWFwPHN0cmluZywgTWFya3VwQ2VsbD4oKTtcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vdXRwdXRDZWxscyA9IG5ldyBNYXA8c3RyaW5nLCBPdXRwdXRDZWxsPigpO1xuXG5cdFx0cHVibGljIGNsZWFyQWxsKCkge1xuXHRcdFx0Zm9yIChjb25zdCBjZWxsIG9mIHRoaXMuX21hcmt1cENlbGxzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGNlbGwuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbWFya3VwQ2VsbHMuY2xlYXIoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBvdXRwdXQgb2YgdGhpcy5fb3V0cHV0Q2VsbHMudmFsdWVzKCkpIHtcblx0XHRcdFx0b3V0cHV0LmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX291dHB1dENlbGxzLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBhc3luYyBjcmVhdGVNYXJrdXBDZWxsKGluaXQ6IHdlYnZpZXdNZXNzYWdlcy5JTWFya3VwQ2VsbEluaXRpYWxpemF0aW9uLCB0b3A6IG51bWJlciwgdmlzaWJsZTogYm9vbGVhbik6IFByb21pc2U8TWFya3VwQ2VsbD4ge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9tYXJrdXBDZWxscy5nZXQoaW5pdC5jZWxsSWQpO1xuXHRcdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFRyeWluZyB0byBjcmVhdGUgbWFya3VwIHRoYXQgYWxyZWFkeSBleGlzdHM6ICR7aW5pdC5jZWxsSWR9YCk7XG5cdFx0XHRcdHJldHVybiBleGlzdGluZztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2VsbCA9IG5ldyBNYXJrdXBDZWxsKGluaXQuY2VsbElkLCBpbml0Lm1pbWUsIGluaXQuY29udGVudCwgdG9wLCBpbml0Lm1ldGFkYXRhKTtcblx0XHRcdGNlbGwuZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gdmlzaWJsZSA/ICcnIDogJ2hpZGRlbic7XG5cdFx0XHR0aGlzLl9tYXJrdXBDZWxscy5zZXQoaW5pdC5jZWxsSWQsIGNlbGwpO1xuXG5cdFx0XHRhd2FpdCBjZWxsLnJlYWR5O1xuXHRcdFx0cmV0dXJuIGNlbGw7XG5cdFx0fVxuXG5cdFx0cHVibGljIGFzeW5jIGVuc3VyZU1hcmt1cENlbGwoaW5mbzogd2Vidmlld01lc3NhZ2VzLklNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGxldCBjZWxsID0gdGhpcy5fbWFya3VwQ2VsbHMuZ2V0KGluZm8uY2VsbElkKTtcblx0XHRcdGlmIChjZWxsKSB7XG5cdFx0XHRcdGNlbGwuZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gaW5mby52aXNpYmxlID8gJycgOiAnaGlkZGVuJztcblx0XHRcdFx0YXdhaXQgY2VsbC51cGRhdGVDb250ZW50QW5kUmVuZGVyKGluZm8uY29udGVudCwgaW5mby5tZXRhZGF0YSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjZWxsID0gYXdhaXQgdGhpcy5jcmVhdGVNYXJrdXBDZWxsKGluZm8sIGluZm8ub2Zmc2V0LCBpbmZvLnZpc2libGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHB1YmxpYyBkZWxldGVNYXJrdXBDZWxsKGlkOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmdldEV4cGVjdGVkTWFya3VwQ2VsbChpZCk7XG5cdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRjZWxsLnJlbW92ZSgpO1xuXHRcdFx0XHRjZWxsLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fbWFya3VwQ2VsbHMuZGVsZXRlKGlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwdWJsaWMgYXN5bmMgdXBkYXRlTWFya3VwQ29udGVudChpZDogc3RyaW5nLCBuZXdDb250ZW50OiBzdHJpbmcsIG1ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuZ2V0RXhwZWN0ZWRNYXJrdXBDZWxsKGlkKTtcblx0XHRcdGF3YWl0IGNlbGw/LnVwZGF0ZUNvbnRlbnRBbmRSZW5kZXIobmV3Q29udGVudCwgbWV0YWRhdGEpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBzaG93TWFya3VwQ2VsbChpZDogc3RyaW5nLCB0b3A6IG51bWJlciwgbmV3Q29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkLCBtZXRhZGF0YTogTm90ZWJvb2tDZWxsTWV0YWRhdGEgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmdldEV4cGVjdGVkTWFya3VwQ2VsbChpZCk7XG5cdFx0XHRjZWxsPy5zaG93KHRvcCwgbmV3Q29udGVudCwgbWV0YWRhdGEpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBoaWRlTWFya3VwQ2VsbChpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5nZXRFeHBlY3RlZE1hcmt1cENlbGwoaWQpO1xuXHRcdFx0Y2VsbD8uaGlkZSgpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyB1bmhpZGVNYXJrdXBDZWxsKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmdldEV4cGVjdGVkTWFya3VwQ2VsbChpZCk7XG5cdFx0XHRjZWxsPy51bmhpZGUoKTtcblx0XHR9XG5cblx0XHRwcml2YXRlIGdldEV4cGVjdGVkTWFya3VwQ2VsbChpZDogc3RyaW5nKTogTWFya3VwQ2VsbCB8IHVuZGVmaW5lZCB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fbWFya3VwQ2VsbHMuZ2V0KGlkKTtcblx0XHRcdGlmICghY2VsbCkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgQ291bGQgbm90IGZpbmQgbWFya3VwIGNlbGwgJyR7aWR9J2ApO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNlbGw7XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZVNlbGVjdGVkQ2VsbHMoc2VsZWN0ZWRDZWxsSWRzOiByZWFkb25seSBzdHJpbmdbXSkge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRDZWxsU2V0ID0gbmV3IFNldDxzdHJpbmc+KHNlbGVjdGVkQ2VsbElkcyk7XG5cdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5fbWFya3VwQ2VsbHMudmFsdWVzKCkpIHtcblx0XHRcdFx0Y2VsbC5zZXRTZWxlY3RlZChzZWxlY3RlZENlbGxTZXQuaGFzKGNlbGwuaWQpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwdWJsaWMgdG9nZ2xlRHJhZ0Ryb3BFbmFibGVkKGRyYWdBbmREcm9wRW5hYmxlZDogYm9vbGVhbikge1xuXHRcdFx0Zm9yIChjb25zdCBjZWxsIG9mIHRoaXMuX21hcmt1cENlbGxzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGNlbGwudG9nZ2xlRHJhZ0Ryb3BFbmFibGVkKGRyYWdBbmREcm9wRW5hYmxlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZU1hcmt1cFNjcm9sbHMobWFya3VwQ2VsbHM6IHJlYWRvbmx5IHdlYnZpZXdNZXNzYWdlcy5JTWFya3VwQ2VsbFNjcm9sbFRvcHNbXSkge1xuXHRcdFx0Zm9yIChjb25zdCB7IGlkLCB0b3AgfSBvZiBtYXJrdXBDZWxscykge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fbWFya3VwQ2VsbHMuZ2V0KGlkKTtcblx0XHRcdFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0XHRjZWxsLmVsZW1lbnQuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHB1YmxpYyBhc3luYyByZW5kZXJPdXRwdXRDZWxsKGRhdGE6IHdlYnZpZXdNZXNzYWdlcy5JQ3JlYXRpb25SZXF1ZXN0TWVzc2FnZSwgc2lnbmFsOiBBYm9ydFNpZ25hbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3QgcHJlbG9hZEVycm9ycyA9IGF3YWl0IFByb21pc2UuYWxsPHVuZGVmaW5lZCB8IEVycm9yPihcblx0XHRcdFx0ZGF0YS5yZXF1aXJlZFByZWxvYWRzLm1hcChwID0+IGtlcm5lbFByZWxvYWRzLndhaXRGb3IocC51cmkpLnRoZW4oKCkgPT4gdW5kZWZpbmVkLCBlcnIgPT4gZXJyKSlcblx0XHRcdCk7XG5cdFx0XHRpZiAoc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjZWxsT3V0cHV0ID0gdGhpcy5lbnN1cmVPdXRwdXRDZWxsKGRhdGEuY2VsbElkLCBkYXRhLmNlbGxUb3AsIGZhbHNlKTtcblx0XHRcdHJldHVybiBjZWxsT3V0cHV0LnJlbmRlck91dHB1dEVsZW1lbnQoZGF0YSwgcHJlbG9hZEVycm9ycywgc2lnbmFsKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgZW5zdXJlT3V0cHV0Q2VsbChjZWxsSWQ6IHN0cmluZywgY2VsbFRvcDogbnVtYmVyLCBza2lwQ2VsbFRvcFVwZGF0ZUlmRXhpc3Q6IGJvb2xlYW4pOiBPdXRwdXRDZWxsIHtcblx0XHRcdGxldCBjZWxsID0gdGhpcy5fb3V0cHV0Q2VsbHMuZ2V0KGNlbGxJZCk7XG5cdFx0XHRjb25zdCBleGlzdGVkID0gISFjZWxsO1xuXHRcdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRcdGNlbGwgPSBuZXcgT3V0cHV0Q2VsbChjZWxsSWQpO1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRDZWxscy5zZXQoY2VsbElkLCBjZWxsKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4aXN0ZWQgJiYgc2tpcENlbGxUb3BVcGRhdGVJZkV4aXN0KSB7XG5cdFx0XHRcdHJldHVybiBjZWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjZWxsLmVsZW1lbnQuc3R5bGUudG9wID0gY2VsbFRvcCArICdweCc7XG5cdFx0XHRyZXR1cm4gY2VsbDtcblx0XHR9XG5cblx0XHRwdWJsaWMgY2xlYXJPdXRwdXQoY2VsbElkOiBzdHJpbmcsIG91dHB1dElkOiBzdHJpbmcsIHJlbmRlcmVySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX291dHB1dENlbGxzLmdldChjZWxsSWQpO1xuXHRcdFx0Y2VsbD8uY2xlYXJPdXRwdXQob3V0cHV0SWQsIHJlbmRlcmVySWQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBzaG93T3V0cHV0KGNlbGxJZDogc3RyaW5nLCBvdXRwdXRJZDogc3RyaW5nLCB0b3A6IG51bWJlcikge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX291dHB1dENlbGxzLmdldChjZWxsSWQpO1xuXHRcdFx0Y2VsbD8uc2hvdyhvdXRwdXRJZCwgdG9wKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgdXBkYXRlQW5kUmVyZW5kZXIoY2VsbElkOiBzdHJpbmcsIG91dHB1dElkOiBzdHJpbmcsIGNvbnRlbnQ6IHdlYnZpZXdNZXNzYWdlcy5JQ3JlYXRpb25Db250ZW50KSB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fb3V0cHV0Q2VsbHMuZ2V0KGNlbGxJZCk7XG5cdFx0XHRjZWxsPy51cGRhdGVDb250ZW50QW5kUmVyZW5kZXIob3V0cHV0SWQsIGNvbnRlbnQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBoaWRlT3V0cHV0KGNlbGxJZDogc3RyaW5nKSB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fb3V0cHV0Q2VsbHMuZ2V0KGNlbGxJZCk7XG5cdFx0XHRjZWxsPy5oaWRlKCk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZU91dHB1dEhlaWdodChjZWxsSWQ6IHN0cmluZywgb3V0cHV0SWQ6IHN0cmluZywgaGVpZ2h0OiBudW1iZXIpIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9vdXRwdXRDZWxscy5nZXQoY2VsbElkKTtcblx0XHRcdGNlbGw/LnVwZGF0ZU91dHB1dEhlaWdodChvdXRwdXRJZCwgaGVpZ2h0KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgdXBkYXRlT3V0cHV0c1Njcm9sbCh1cGRhdGVzOiB3ZWJ2aWV3TWVzc2FnZXMuSUNvbnRlbnRXaWRnZXRUb3BSZXF1ZXN0W10pIHtcblx0XHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiB1cGRhdGVzKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9vdXRwdXRDZWxscy5nZXQocmVxdWVzdC5jZWxsSWQpO1xuXHRcdFx0XHRjZWxsPy51cGRhdGVTY3JvbGwocmVxdWVzdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCk7XG5cblx0Y2xhc3MgTWFya2Rvd25Db2RlQmxvY2sge1xuXHRcdHByaXZhdGUgc3RhdGljIHBlbmRpbmdDb2RlQmxvY2tzVG9IaWdobGlnaHQgPSBuZXcgTWFwPHN0cmluZywgSFRNTEVsZW1lbnQ+KCk7XG5cblx0XHRwdWJsaWMgc3RhdGljIGhpZ2hsaWdodENvZGVCbG9jayhpZDogc3RyaW5nLCBodG1sOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGVsID0gTWFya2Rvd25Db2RlQmxvY2sucGVuZGluZ0NvZGVCbG9ja3NUb0hpZ2hsaWdodC5nZXQoaWQpO1xuXHRcdFx0aWYgKCFlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0cnVzdGVkSHRtbCA9IHR0UG9saWN5Py5jcmVhdGVIVE1MKGh0bWwpID8/IGh0bWw7XG5cdFx0XHRlbC5pbm5lckhUTUwgPSB0cnVzdGVkSHRtbCBhcyBzdHJpbmc7IC8vIENvZGVRTCBbU00wMzcxMl0gVGhlIHJlbmRlcmVkIGNvbnRlbnQgY29tZXMgZnJvbSBWUyBDb2RlJ3MgdG9rZW5pemVyIGFuZCBpcyBjb25zaWRlcmVkIHNhZmVcblx0XHRcdGNvbnN0IHJvb3QgPSBlbC5nZXRSb290Tm9kZSgpO1xuXHRcdFx0aWYgKHJvb3QgaW5zdGFuY2VvZiBTaGFkb3dSb290KSB7XG5cdFx0XHRcdGlmICghcm9vdC5hZG9wdGVkU3R5bGVTaGVldHMuaW5jbHVkZXModG9rZW5pemF0aW9uU3R5bGUpKSB7XG5cdFx0XHRcdFx0cm9vdC5hZG9wdGVkU3R5bGVTaGVldHMucHVzaCh0b2tlbml6YXRpb25TdHlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRwdWJsaWMgc3RhdGljIHJlcXVlc3RIaWdobGlnaHRDb2RlQmxvY2socm9vdDogSFRNTEVsZW1lbnQgfCBTaGFkb3dSb290KSB7XG5cdFx0XHRjb25zdCBjb2RlQmxvY2tzOiBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhbmc6IHN0cmluZzsgaWQ6IHN0cmluZyB9PiA9IFtdO1xuXHRcdFx0bGV0IGkgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBlbCBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy52c2NvZGUtY29kZS1ibG9jaycpKSB7XG5cdFx0XHRcdGNvbnN0IGxhbmcgPSBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdnNjb2RlLWNvZGUtYmxvY2stbGFuZycpO1xuXHRcdFx0XHRpZiAoZWwudGV4dENvbnRlbnQgJiYgbGFuZykge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gYCR7RGF0ZS5ub3coKX0tJHtpKyt9YDtcblx0XHRcdFx0XHRjb2RlQmxvY2tzLnB1c2goeyB2YWx1ZTogZWwudGV4dENvbnRlbnQsIGxhbmc6IGxhbmcsIGlkIH0pO1xuXHRcdFx0XHRcdE1hcmtkb3duQ29kZUJsb2NrLnBlbmRpbmdDb2RlQmxvY2tzVG9IaWdobGlnaHQuc2V0KGlkLCBlbCBhcyBIVE1MRWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNvZGVCbG9ja3M7XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgTWFya3VwQ2VsbCB7XG5cblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVhZHk6IFByb21pc2U8dm9pZD47XG5cblx0XHRwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcblx0XHRwdWJsaWMgcmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IG91dHB1dEl0ZW06IEV4dGVuZGVkT3V0cHV0SXRlbTtcblxuXHRcdC8vLyBJbnRlcm5hbCBmaWVsZCB0aGF0IGhvbGRzIHRleHQgY29udGVudFxuXHRcdHByaXZhdGUgX2NvbnRlbnQ6IHsgcmVhZG9ubHkgdmFsdWU6IHN0cmluZzsgcmVhZG9ubHkgdmVyc2lvbjogbnVtYmVyOyByZWFkb25seSBtZXRhZGF0YTogTm90ZWJvb2tDZWxsTWV0YWRhdGEgfTtcblxuXHRcdHByaXZhdGUgX2lzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHRwcml2YXRlIHJlbmRlclRhc2tBYm9ydD86IEFib3J0Q29udHJvbGxlcjtcblxuXHRcdGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIG1pbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB0b3A6IG51bWJlciwgbWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhKSB7XG5cdFx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHRcdHRoaXMuaWQgPSBpZDtcblx0XHRcdHRoaXMuX2NvbnRlbnQgPSB7IHZhbHVlOiBjb250ZW50LCB2ZXJzaW9uOiAwLCBtZXRhZGF0YTogbWV0YWRhdGEgfTtcblxuXHRcdFx0Y29uc3QgeyBwcm9taXNlLCByZXNvbHZlLCByZWplY3QgfSA9IHByb21pc2VXaXRoUmVzb2x2ZXJzPHZvaWQ+KCk7XG5cdFx0XHR0aGlzLnJlYWR5ID0gcHJvbWlzZTtcblxuXHRcdFx0bGV0IGNhY2hlZERhdGE6IHsgcmVhZG9ubHkgdmVyc2lvbjogbnVtYmVyOyByZWFkb25seSB2YWx1ZTogVWludDhBcnJheSB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5vdXRwdXRJdGVtID0gT2JqZWN0LmZyZWV6ZTxFeHRlbmRlZE91dHB1dEl0ZW0+KHtcblx0XHRcdFx0aWQsXG5cdFx0XHRcdG1pbWUsXG5cblx0XHRcdFx0Z2V0IG1ldGFkYXRhKCk6IE5vdGVib29rQ2VsbE1ldGFkYXRhIHtcblx0XHRcdFx0XHRyZXR1cm4gc2VsZi5fY29udGVudC5tZXRhZGF0YTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHR0ZXh0OiAoKTogc3RyaW5nID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fY29udGVudC52YWx1ZTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRqc29uOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRkYXRhOiAoKTogVWludDhBcnJheSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNhY2hlZERhdGE/LnZlcnNpb24gPT09IHRoaXMuX2NvbnRlbnQudmVyc2lvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNhY2hlZERhdGEudmFsdWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRleHRFbmNvZGVyLmVuY29kZSh0aGlzLl9jb250ZW50LnZhbHVlKTtcblx0XHRcdFx0XHRjYWNoZWREYXRhID0geyB2ZXJzaW9uOiB0aGlzLl9jb250ZW50LnZlcnNpb24sIHZhbHVlOiBkYXRhIH07XG5cdFx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHRcdH0sXG5cblx0XHRcdFx0YmxvYigpOiBCbG9iIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEJsb2IoW3RoaXMuZGF0YSgpXSwgeyB0eXBlOiB0aGlzLm1pbWUgfSk7XG5cdFx0XHRcdH0sXG5cblx0XHRcdFx0X2FsbE91dHB1dEl0ZW1zOiBbe1xuXHRcdFx0XHRcdG1pbWUsXG5cdFx0XHRcdFx0Z2V0SXRlbTogYXN5bmMgKCkgPT4gdGhpcy5vdXRwdXRJdGVtLFxuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHJvb3QgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRhaW5lcicpITtcblx0XHRcdGNvbnN0IG1hcmt1cENlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdG1hcmt1cENlbGwuY2xhc3NOYW1lID0gJ21hcmt1cCc7XG5cdFx0XHRtYXJrdXBDZWxsLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRcdG1hcmt1cENlbGwuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cblx0XHRcdHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmlkID0gdGhpcy5pZDtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdwcmV2aWV3Jyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnRvcCA9IHRvcCArICdweCc7XG5cdFx0XHR0aGlzLnRvZ2dsZURyYWdEcm9wRW5hYmxlZChjdXJyZW50T3B0aW9ucy5kcmFnQW5kRHJvcEVuYWJsZWQpO1xuXHRcdFx0bWFya3VwQ2VsbC5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuXHRcdFx0cm9vdC5hcHBlbmRDaGlsZChtYXJrdXBDZWxsKTtcblxuXHRcdFx0dGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZUNvbnRlbnRBbmRSZW5kZXIodGhpcy5fY29udGVudC52YWx1ZSwgdGhpcy5fY29udGVudC5tZXRhZGF0YSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5lbGVtZW50LCB0aGlzLmlkLCBmYWxzZSwgdGhpcy5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSwgKCkgPT4gcmVqZWN0KCkpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBkaXNwb3NlKCkge1xuXHRcdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0XHR0aGlzLnJlbmRlclRhc2tBYm9ydD8uYWJvcnQoKTtcblx0XHRcdHRoaXMucmVuZGVyVGFza0Fib3J0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZGJsY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklUb2dnbGVNYXJrdXBQcmV2aWV3TWVzc2FnZT4oJ3RvZ2dsZU1hcmt1cFByZXZpZXcnLCB7IGNlbGxJZDogdGhpcy5pZCB9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcblx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSUNsaWNrTWFya3VwQ2VsbE1lc3NhZ2U+KCdjbGlja01hcmt1cENlbGwnLCB7XG5cdFx0XHRcdFx0Y2VsbElkOiB0aGlzLmlkLFxuXHRcdFx0XHRcdGFsdEtleTogZS5hbHRLZXksXG5cdFx0XHRcdFx0Y3RybEtleTogZS5jdHJsS2V5LFxuXHRcdFx0XHRcdG1ldGFLZXk6IGUubWV0YUtleSxcblx0XHRcdFx0XHRzaGlmdEtleTogZS5zaGlmdEtleSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklDb250ZXh0TWVudU1hcmt1cENlbGxNZXNzYWdlPignY29udGV4dE1lbnVNYXJrdXBDZWxsJywge1xuXHRcdFx0XHRcdGNlbGxJZDogdGhpcy5pZCxcblx0XHRcdFx0XHRjbGllbnRYOiBlLmNsaWVudFgsXG5cdFx0XHRcdFx0Y2xpZW50WTogZS5jbGllbnRZLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VlbnRlcicsICgpID0+IHtcblx0XHRcdFx0cG9zdE5vdGVib29rTWVzc2FnZTx3ZWJ2aWV3TWVzc2FnZXMuSU1vdXNlRW50ZXJNYXJrdXBDZWxsTWVzc2FnZT4oJ21vdXNlRW50ZXJNYXJrdXBDZWxsJywgeyBjZWxsSWQ6IHRoaXMuaWQgfSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCAoKSA9PiB7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklNb3VzZUxlYXZlTWFya3VwQ2VsbE1lc3NhZ2U+KCdtb3VzZUxlYXZlTWFya3VwQ2VsbCcsIHsgY2VsbElkOiB0aGlzLmlkIH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBlID0+IHtcblx0XHRcdFx0bWFya3VwQ2VsbERyYWdNYW5hZ2VyLnN0YXJ0RHJhZyhlLCB0aGlzLmlkKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIGUgPT4ge1xuXHRcdFx0XHRtYXJrdXBDZWxsRHJhZ01hbmFnZXIudXBkYXRlRHJhZyhlLCB0aGlzLmlkKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGUgPT4ge1xuXHRcdFx0XHRtYXJrdXBDZWxsRHJhZ01hbmFnZXIuZW5kRHJhZyhlLCB0aGlzLmlkKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBhc3luYyB1cGRhdGVDb250ZW50QW5kUmVuZGVyKG5ld0NvbnRlbnQ6IHN0cmluZywgbWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHR0aGlzLl9jb250ZW50ID0geyB2YWx1ZTogbmV3Q29udGVudCwgdmVyc2lvbjogdGhpcy5fY29udGVudC52ZXJzaW9uICsgMSwgbWV0YWRhdGEgfTtcblxuXHRcdFx0dGhpcy5yZW5kZXJUYXNrQWJvcnQ/LmFib3J0KCk7XG5cblx0XHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0XHR0aGlzLnJlbmRlclRhc2tBYm9ydCA9IGNvbnRyb2xsZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCByZW5kZXJlcnMucmVuZGVyKHRoaXMub3V0cHV0SXRlbSwgdW5kZWZpbmVkLCB0aGlzLmVsZW1lbnQsIHRoaXMucmVuZGVyVGFza0Fib3J0LnNpZ25hbCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRpZiAodGhpcy5yZW5kZXJUYXNrQWJvcnQgPT09IGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlclRhc2tBYm9ydCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByb290ID0gKHRoaXMuZWxlbWVudC5zaGFkb3dSb290ID8/IHRoaXMuZWxlbWVudCk7XG5cdFx0XHRjb25zdCBodG1sID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIHJvb3QuY2hpbGRyZW4pIHtcblx0XHRcdFx0c3dpdGNoIChjaGlsZC50YWdOYW1lKSB7XG5cdFx0XHRcdFx0Y2FzZSAnTElOSyc6XG5cdFx0XHRcdFx0Y2FzZSAnU0NSSVBUJzpcblx0XHRcdFx0XHRjYXNlICdTVFlMRSc6XG5cdFx0XHRcdFx0XHQvLyBub3Qgd29ydGggc2VuZGluZyBvdmVyIHNpbmNlIGl0IHdpbGwgYmUgc3RyaXBwZWQgYmVmb3JlIHJlbmRlcmluZ1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0aHRtbC5wdXNoKGNoaWxkLm91dGVySFRNTCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb2RlQmxvY2tzOiBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhbmc6IHN0cmluZzsgaWQ6IHN0cmluZyB9PiA9IE1hcmtkb3duQ29kZUJsb2NrLnJlcXVlc3RIaWdobGlnaHRDb2RlQmxvY2socm9vdCk7XG5cblx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklSZW5kZXJlZE1hcmt1cE1lc3NhZ2U+KCdyZW5kZXJlZE1hcmt1cCcsIHtcblx0XHRcdFx0Y2VsbElkOiB0aGlzLmlkLFxuXHRcdFx0XHRodG1sOiBodG1sLmpvaW4oJycpLFxuXHRcdFx0XHRjb2RlQmxvY2tzXG5cdFx0XHR9KTtcblxuXHRcdFx0ZGltZW5zaW9uVXBkYXRlci51cGRhdGVIZWlnaHQodGhpcy5pZCwgdGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCwge1xuXHRcdFx0XHRpc091dHB1dDogZmFsc2Vcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBzaG93KHRvcDogbnVtYmVyLCBuZXdDb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQsIG1ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnJztcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuXHRcdFx0aWYgKHR5cGVvZiBuZXdDb250ZW50ID09PSAnc3RyaW5nJyB8fCBtZXRhZGF0YSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNvbnRlbnRBbmRSZW5kZXIobmV3Q29udGVudCA/PyB0aGlzLl9jb250ZW50LnZhbHVlLCBtZXRhZGF0YSA/PyB0aGlzLl9jb250ZW50Lm1ldGFkYXRhKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlTWFya3VwRGltZW5zaW9ucygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHB1YmxpYyBoaWRlKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHR9XG5cblx0XHRwdWJsaWMgdW5oaWRlKCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnJztcblx0XHRcdHRoaXMudXBkYXRlTWFya3VwRGltZW5zaW9ucygpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyByZW1vdmUoKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBhc3luYyB1cGRhdGVNYXJrdXBEaW1lbnNpb25zKCkge1xuXHRcdFx0ZGltZW5zaW9uVXBkYXRlci51cGRhdGVIZWlnaHQodGhpcy5pZCwgdGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCwge1xuXHRcdFx0XHRpc091dHB1dDogZmFsc2Vcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBzZXRTZWxlY3RlZChzZWxlY3RlZDogYm9vbGVhbikge1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3NlbGVjdGVkJywgc2VsZWN0ZWQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyB0b2dnbGVEcmFnRHJvcEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdFx0aWYgKGVuYWJsZWQpIHtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RyYWdnYWJsZScpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnYWJsZScpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkcmFnZ2FibGUnKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjbGFzcyBPdXRwdXRDZWxsIHtcblx0XHRwdWJsaWMgcmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBvdXRwdXRFbGVtZW50cyA9IG5ldyBNYXA8LypvdXRwdXRJZCovIHN0cmluZywgT3V0cHV0Q29udGFpbmVyPigpO1xuXG5cdFx0Y29uc3RydWN0b3IoY2VsbElkOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGFpbmVyJykhO1xuXG5cdFx0XHRjb25zdCB1cHBlcldyYXBwZXJFbGVtZW50ID0gY3JlYXRlRm9jdXNTaW5rKGNlbGxJZCk7XG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodXBwZXJXcmFwcGVyRWxlbWVudCk7XG5cblx0XHRcdHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5vdXRsaW5lID0gJzAnO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuaWQgPSBjZWxsSWQ7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY2VsbF9jb250YWluZXInKTtcblxuXHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuZWxlbWVudCk7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSB0aGlzLmVsZW1lbnQ7XG5cblx0XHRcdGNvbnN0IGxvd2VyV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVGb2N1c1NpbmsoY2VsbElkLCB0cnVlKTtcblx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChsb3dlcldyYXBwZXJFbGVtZW50KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHRcdGZvciAoY29uc3Qgb3V0cHV0IG9mIHRoaXMub3V0cHV0RWxlbWVudHMudmFsdWVzKCkpIHtcblx0XHRcdFx0b3V0cHV0LmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMub3V0cHV0RWxlbWVudHMuY2xlYXIoKTtcblx0XHR9XG5cblx0XHRwcml2YXRlIGNyZWF0ZU91dHB1dEVsZW1lbnQoZGF0YTogd2Vidmlld01lc3NhZ2VzLklDcmVhdGlvblJlcXVlc3RNZXNzYWdlKTogT3V0cHV0RWxlbWVudCB7XG5cdFx0XHRsZXQgb3V0cHV0Q29udGFpbmVyID0gdGhpcy5vdXRwdXRFbGVtZW50cy5nZXQoZGF0YS5vdXRwdXRJZCk7XG5cdFx0XHRpZiAoIW91dHB1dENvbnRhaW5lcikge1xuXHRcdFx0XHRvdXRwdXRDb250YWluZXIgPSBuZXcgT3V0cHV0Q29udGFpbmVyKGRhdGEub3V0cHV0SWQpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQob3V0cHV0Q29udGFpbmVyLmVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLm91dHB1dEVsZW1lbnRzLnNldChkYXRhLm91dHB1dElkLCBvdXRwdXRDb250YWluZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gb3V0cHV0Q29udGFpbmVyLmNyZWF0ZU91dHB1dEVsZW1lbnQoZGF0YS5vdXRwdXRJZCwgZGF0YS5vdXRwdXRPZmZzZXQsIGRhdGEubGVmdCwgZGF0YS5jZWxsSWQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBhc3luYyByZW5kZXJPdXRwdXRFbGVtZW50KGRhdGE6IHdlYnZpZXdNZXNzYWdlcy5JQ3JlYXRpb25SZXF1ZXN0TWVzc2FnZSwgcHJlbG9hZEVycm9yczogUmVhZG9ubHlBcnJheTxFcnJvciB8IHVuZGVmaW5lZD4sIHNpZ25hbDogQWJvcnRTaWduYWwpIHtcblx0XHRcdGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRjb25zdCBvdXRwdXRFbGVtZW50IC8qKiBvdXRwdXROb2RlICovID0gdGhpcy5jcmVhdGVPdXRwdXRFbGVtZW50KGRhdGEpO1xuXHRcdFx0YXdhaXQgb3V0cHV0RWxlbWVudC5yZW5kZXIoZGF0YS5jb250ZW50LCBkYXRhLnJlbmRlcmVySWQsIHByZWxvYWRFcnJvcnMsIHNpZ25hbCk7XG5cblx0XHRcdC8vIGRvbid0IGhpZGUgdW50aWwgYWZ0ZXIgdGhpcyBzdGVwIHNvIHRoYXQgdGhlIGhlaWdodCBpcyByaWdodFxuXHRcdFx0b3V0cHV0RWxlbWVudC8qKiBvdXRwdXROb2RlICovLmVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9IGRhdGEuaW5pdGlhbGx5SGlkZGVuID8gJ2hpZGRlbicgOiAnJztcblxuXHRcdFx0aWYgKCEhZGF0YS5leGVjdXRpb25JZCAmJiAhIWRhdGEucmVuZGVyZXJJZCkge1xuXHRcdFx0XHRsZXQgb3V0cHV0U2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoZGF0YS5jb250ZW50LnR5cGUgPT09IDEgLyogZXh0ZW5zaW9uICovKSB7XG5cdFx0XHRcdFx0b3V0cHV0U2l6ZSA9IGRhdGEuY29udGVudC5vdXRwdXQudmFsdWVCeXRlcy5sZW5ndGg7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBPbmx5IHNlbmQgcGVyZm9ybWFuY2UgbWVzc2FnZXMgZm9yIG5vbi1lbXB0eSBvdXRwdXRzIHVwIHRvIGEgY2VydGFpbiBzaXplXG5cdFx0XHRcdGlmIChvdXRwdXRTaXplICE9PSB1bmRlZmluZWQgJiYgb3V0cHV0U2l6ZSA+IDAgJiYgb3V0cHV0U2l6ZSA8IDEwMCAqIDEwMjQpIHtcblx0XHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JUGVyZm9ybWFuY2VNZXNzYWdlPignbm90ZWJvb2tQZXJmb3JtYW5jZU1lc3NhZ2UnLCB7XG5cdFx0XHRcdFx0XHRjZWxsSWQ6IGRhdGEuY2VsbElkLFxuXHRcdFx0XHRcdFx0ZXhlY3V0aW9uSWQ6IGRhdGEuZXhlY3V0aW9uSWQsXG5cdFx0XHRcdFx0XHRkdXJhdGlvbjogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSxcblx0XHRcdFx0XHRcdHJlbmRlcmVySWQ6IGRhdGEucmVuZGVyZXJJZCxcblx0XHRcdFx0XHRcdG91dHB1dFNpemVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHB1YmxpYyBjbGVhck91dHB1dChvdXRwdXRJZDogc3RyaW5nLCByZW5kZXJlcklkOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IG91dHB1dCA9IHRoaXMub3V0cHV0RWxlbWVudHMuZ2V0KG91dHB1dElkKTtcblx0XHRcdG91dHB1dD8uY2xlYXIocmVuZGVyZXJJZCk7XG5cdFx0XHRvdXRwdXQ/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMub3V0cHV0RWxlbWVudHMuZGVsZXRlKG91dHB1dElkKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgc2hvdyhvdXRwdXRJZDogc3RyaW5nLCB0b3A6IG51bWJlcikge1xuXHRcdFx0Y29uc3Qgb3V0cHV0Q29udGFpbmVyID0gdGhpcy5vdXRwdXRFbGVtZW50cy5nZXQob3V0cHV0SWQpO1xuXHRcdFx0aWYgKCFvdXRwdXRDb250YWluZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICcnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG5cdFx0fVxuXG5cdFx0cHVibGljIGhpZGUoKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXHRcdH1cblxuXHRcdHB1YmxpYyB1cGRhdGVDb250ZW50QW5kUmVyZW5kZXIob3V0cHV0SWQ6IHN0cmluZywgY29udGVudDogd2Vidmlld01lc3NhZ2VzLklDcmVhdGlvbkNvbnRlbnQpIHtcblx0XHRcdHRoaXMub3V0cHV0RWxlbWVudHMuZ2V0KG91dHB1dElkKT8udXBkYXRlQ29udGVudEFuZFJlbmRlcihjb250ZW50KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgdXBkYXRlT3V0cHV0SGVpZ2h0KG91dHB1dElkOiBzdHJpbmcsIGhlaWdodDogbnVtYmVyKSB7XG5cdFx0XHR0aGlzLm91dHB1dEVsZW1lbnRzLmdldChvdXRwdXRJZCk/LnVwZGF0ZUhlaWdodChoZWlnaHQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyB1cGRhdGVTY3JvbGwocmVxdWVzdDogd2Vidmlld01lc3NhZ2VzLklDb250ZW50V2lkZ2V0VG9wUmVxdWVzdCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnRvcCA9IGAke3JlcXVlc3QuY2VsbFRvcH1weGA7XG5cblx0XHRcdGNvbnN0IG91dHB1dEVsZW1lbnQgPSB0aGlzLm91dHB1dEVsZW1lbnRzLmdldChyZXF1ZXN0Lm91dHB1dElkKTtcblx0XHRcdGlmIChvdXRwdXRFbGVtZW50KSB7XG5cdFx0XHRcdG91dHB1dEVsZW1lbnQudXBkYXRlU2Nyb2xsKHJlcXVlc3Qub3V0cHV0T2Zmc2V0KTtcblxuXHRcdFx0XHRpZiAocmVxdWVzdC5mb3JjZURpc3BsYXkgJiYgb3V0cHV0RWxlbWVudC5vdXRwdXROb2RlKSB7XG5cdFx0XHRcdFx0Ly8gVE9ETyBAcmVib3JuaXggQG1qYnZ6LCB0aGVyZSBpcyBhIG1pc2FsaWdubWVudCBoZXJlLlxuXHRcdFx0XHRcdC8vIFdlIHNldCBvdXRwdXQgdmlzaWJpbGl0eSBvbiBjZWxsIGNvbnRhaW5lciwgb3RoZXIgdGhhbiBvdXRwdXQgY29udGFpbmVyIG9yIG91dHB1dCBub2RlIGl0c2VsZi5cblx0XHRcdFx0XHRvdXRwdXRFbGVtZW50Lm91dHB1dE5vZGUuZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlcXVlc3QuZm9yY2VEaXNwbGF5KSB7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gJyc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgT3V0cHV0Q29udGFpbmVyIHtcblxuXHRcdHB1YmxpYyByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRcdHByaXZhdGUgX291dHB1dE5vZGU/OiBPdXRwdXRFbGVtZW50O1xuXG5cdFx0Z2V0IG91dHB1dE5vZGUoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb3V0cHV0Tm9kZTtcblx0XHR9XG5cblx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0SWQ6IHN0cmluZyxcblx0XHQpIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ291dHB1dF9jb250YWluZXInKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdnNjb2RlLWNvbnRleHQnLCBKU09OLnN0cmluZ2lmeSh7ICdwcmV2ZW50RGVmYXVsdENvbnRleHRNZW51SXRlbXMnOiB0cnVlIH0pKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcblx0XHR9XG5cblx0XHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHRcdHRoaXMuX291dHB1dE5vZGU/LmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgY2xlYXIocmVuZGVyZXJJZDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRpZiAocmVuZGVyZXJJZCkge1xuXHRcdFx0XHRyZW5kZXJlcnMuY2xlYXJPdXRwdXQocmVuZGVyZXJJZCwgdGhpcy5vdXRwdXRJZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZUhlaWdodChoZWlnaHQ6IG51bWJlcikge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLm1heEhlaWdodCA9IGAke2hlaWdodH1weGA7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHR9XG5cblx0XHRwdWJsaWMgdXBkYXRlU2Nyb2xsKG91dHB1dE9mZnNldDogbnVtYmVyKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUudG9wID0gYCR7b3V0cHV0T2Zmc2V0fXB4YDtcblx0XHR9XG5cblx0XHRwdWJsaWMgY3JlYXRlT3V0cHV0RWxlbWVudChvdXRwdXRJZDogc3RyaW5nLCBvdXRwdXRPZmZzZXQ6IG51bWJlciwgbGVmdDogbnVtYmVyLCBjZWxsSWQ6IHN0cmluZyk6IE91dHB1dEVsZW1lbnQge1xuXHRcdFx0dGhpcy5lbGVtZW50LmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLm1heEhlaWdodCA9ICcwcHgnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnRvcCA9IGAke291dHB1dE9mZnNldH1weGA7XG5cblx0XHRcdHRoaXMuX291dHB1dE5vZGU/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX291dHB1dE5vZGUgPSBuZXcgT3V0cHV0RWxlbWVudChvdXRwdXRJZCwgbGVmdCwgY2VsbElkKTtcblx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9vdXRwdXROb2RlLmVsZW1lbnQpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX291dHB1dE5vZGU7XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZUNvbnRlbnRBbmRSZW5kZXIoY29udGVudDogd2Vidmlld01lc3NhZ2VzLklDcmVhdGlvbkNvbnRlbnQpIHtcblx0XHRcdHRoaXMuX291dHB1dE5vZGU/LnVwZGF0ZUFuZFJlcmVuZGVyKGNvbnRlbnQpO1xuXHRcdH1cblx0fVxuXG5cdHZzY29kZS5wb3N0TWVzc2FnZSh7XG5cdFx0X192c2NvZGVfbm90ZWJvb2tfbWVzc2FnZTogdHJ1ZSxcblx0XHR0eXBlOiAnaW5pdGlhbGl6ZWQnXG5cdH0pO1xuXG5cdGZvciAoY29uc3QgcHJlbG9hZCBvZiBjdHguc3RhdGljUHJlbG9hZHNEYXRhKSB7XG5cdFx0a2VybmVsUHJlbG9hZHMubG9hZChwcmVsb2FkLmVudHJ5cG9pbnQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcG9zdE5vdGVib29rTWVzc2FnZTxUIGV4dGVuZHMgd2Vidmlld01lc3NhZ2VzLkZyb21XZWJ2aWV3TWVzc2FnZT4oXG5cdFx0dHlwZTogVFsndHlwZSddLFxuXHRcdHByb3BlcnRpZXM6IE9taXQ8VCwgJ19fdnNjb2RlX25vdGVib29rX21lc3NhZ2UnIHwgJ3R5cGUnPlxuXHQpIHtcblx0XHR2c2NvZGUucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0X192c2NvZGVfbm90ZWJvb2tfbWVzc2FnZTogdHJ1ZSxcblx0XHRcdHR5cGUsXG5cdFx0XHQuLi5wcm9wZXJ0aWVzXG5cdFx0fSk7XG5cdH1cblxuXHRjbGFzcyBPdXRwdXRFbGVtZW50IHtcblx0XHRwdWJsaWMgcmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdFx0cHJpdmF0ZSBfY29udGVudD86IHtcblx0XHRcdHJlYWRvbmx5IHByZWZlcnJlZFJlbmRlcmVySWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdHJlYWRvbmx5IHByZWxvYWRFcnJvcnM6IFJlYWRvbmx5QXJyYXk8RXJyb3IgfCB1bmRlZmluZWQ+O1xuXHRcdH07XG5cdFx0cHJpdmF0ZSBoYXNSZXNpemVPYnNlcnZlciA9IGZhbHNlO1xuXG5cdFx0cHJpdmF0ZSByZW5kZXJUYXNrQWJvcnQ/OiBBYm9ydENvbnRyb2xsZXI7XG5cblx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0SWQ6IHN0cmluZyxcblx0XHRcdGxlZnQ6IG51bWJlcixcblx0XHRcdHB1YmxpYyByZWFkb25seSBjZWxsSWQ6IHN0cmluZ1xuXHRcdCkge1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuaWQgPSBvdXRwdXRJZDtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdvdXRwdXQnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUudG9wID0gYDBweGA7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUubGVmdCA9IGxlZnQgKyAncHgnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBgJHtjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmd9cHggJHtjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmd9cHggJHtjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmd9cHggJHtjdHguc3R5bGUub3V0cHV0Tm9kZUxlZnRQYWRkaW5nfWA7XG5cblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4ge1xuXHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JTW91c2VFbnRlck1lc3NhZ2U+KCdtb3VzZWVudGVyJywgeyBpZDogb3V0cHV0SWQgfSk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4ge1xuXHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JTW91c2VMZWF2ZU1lc3NhZ2U+KCdtb3VzZWxlYXZlJywgeyBpZDogb3V0cHV0SWQgfSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHRcdHRoaXMucmVuZGVyVGFza0Fib3J0Py5hYm9ydCgpO1xuXHRcdFx0dGhpcy5yZW5kZXJUYXNrQWJvcnQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cHVibGljIGFzeW5jIHJlbmRlcihjb250ZW50OiB3ZWJ2aWV3TWVzc2FnZXMuSUNyZWF0aW9uQ29udGVudCwgcHJlZmVycmVkUmVuZGVyZXJJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBwcmVsb2FkRXJyb3JzOiBSZWFkb25seUFycmF5PEVycm9yIHwgdW5kZWZpbmVkPiwgc2lnbmFsPzogQWJvcnRTaWduYWwpIHtcblx0XHRcdHRoaXMucmVuZGVyVGFza0Fib3J0Py5hYm9ydCgpO1xuXHRcdFx0dGhpcy5yZW5kZXJUYXNrQWJvcnQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdHRoaXMuX2NvbnRlbnQgPSB7IHByZWZlcnJlZFJlbmRlcmVySWQsIHByZWxvYWRFcnJvcnMgfTtcblx0XHRcdGlmIChjb250ZW50LnR5cGUgPT09IDAgLyogUmVuZGVyT3V0cHV0VHlwZS5IdG1sICovKSB7XG5cdFx0XHRcdGNvbnN0IHRydXN0ZWRIdG1sID0gdHRQb2xpY3k/LmNyZWF0ZUhUTUwoY29udGVudC5odG1sQ29udGVudCkgPz8gY29udGVudC5odG1sQ29udGVudDtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmlubmVySFRNTCA9IHRydXN0ZWRIdG1sIGFzIHN0cmluZzsgIC8vIENvZGVRTCBbU00wMzcxMl0gVGhlIGNvbnRlbnQgY29tZXMgZnJvbSByZW5kZXJlciBleHRlbnNpb25zLCBub3QgZnJvbSBkaXJlY3QgdXNlciBpbnB1dC5cblx0XHRcdH0gZWxzZSBpZiAocHJlbG9hZEVycm9ycy5zb21lKGUgPT4gZSBpbnN0YW5jZW9mIEVycm9yKSkge1xuXHRcdFx0XHRjb25zdCBlcnJvcnMgPSBwcmVsb2FkRXJyb3JzLmZpbHRlcigoZSk6IGUgaXMgRXJyb3IgPT4gZSBpbnN0YW5jZW9mIEVycm9yKTtcblx0XHRcdFx0c2hvd1JlbmRlckVycm9yKGBFcnJvciBsb2FkaW5nIHByZWxvYWRzYCwgdGhpcy5lbGVtZW50LCBlcnJvcnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IGNyZWF0ZU91dHB1dEl0ZW0odGhpcy5vdXRwdXRJZCwgY29udGVudC5vdXRwdXQubWltZSwgY29udGVudC5tZXRhZGF0YSwgY29udGVudC5vdXRwdXQudmFsdWVCeXRlcywgY29udGVudC5hbGxPdXRwdXRzLCBjb250ZW50Lm91dHB1dC5hcHBlbmRlZCk7XG5cblx0XHRcdFx0Y29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJUYXNrQWJvcnQgPSBjb250cm9sbGVyO1xuXG5cdFx0XHRcdC8vIEFib3J0IHJlbmRlcmluZyBpZiBjYWxsZXIgYWJvcnRzXG5cdFx0XHRcdHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiBjb250cm9sbGVyLmFib3J0KCkpO1xuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgcmVuZGVyZXJzLnJlbmRlcihpdGVtLCBwcmVmZXJyZWRSZW5kZXJlcklkLCB0aGlzLmVsZW1lbnQsIGNvbnRyb2xsZXIuc2lnbmFsKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRpZiAodGhpcy5yZW5kZXJUYXNrQWJvcnQgPT09IGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0XHRcdHRoaXMucmVuZGVyVGFza0Fib3J0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaGFzUmVzaXplT2JzZXJ2ZXIpIHtcblx0XHRcdFx0dGhpcy5oYXNSZXNpemVPYnNlcnZlciA9IHRydWU7XG5cdFx0XHRcdHJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5lbGVtZW50LCB0aGlzLm91dHB1dElkLCB0cnVlLCB0aGlzLmNlbGxJZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9mZnNldEhlaWdodCA9IHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQ7XG5cdFx0XHRjb25zdCBjcHMgPSBkb2N1bWVudC5kZWZhdWx0VmlldyEuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpO1xuXHRcdFx0Y29uc3QgdmVydGljYWxQYWRkaW5nID0gcGFyc2VGbG9hdChjcHMucGFkZGluZ1RvcCkgKyBwYXJzZUZsb2F0KGNwcy5wYWRkaW5nQm90dG9tKTtcblx0XHRcdGNvbnN0IGNvbnRlbnRIZWlnaHQgPSBvZmZzZXRIZWlnaHQgLSB2ZXJ0aWNhbFBhZGRpbmc7XG5cdFx0XHRpZiAoZWxlbWVudEhhc0NvbnRlbnQoY29udGVudEhlaWdodCkgJiYgY3BzLnBhZGRpbmcgPT09ICcwcHgnKSB7XG5cdFx0XHRcdC8vIHdlIHNldCBwYWRkaW5nIHRvIHplcm8gaWYgdGhlIG91dHB1dCBoYXMgbm8gY29udGVudCAodGhlbiB3ZSBjYW4gaGF2ZSBhIHplcm8taGVpZ2h0IG91dHB1dCBET00gbm9kZSlcblx0XHRcdFx0Ly8gdGh1cyB3ZSBuZWVkIHRvIGVuc3VyZSB0aGUgcGFkZGluZyBpcyBhY2NvdW50ZWQgd2hlbiB1cGRhdGluZyB0aGUgaW5pdCBoZWlnaHQgb2YgdGhlIG91dHB1dFxuXHRcdFx0XHRkaW1lbnNpb25VcGRhdGVyLnVwZGF0ZUhlaWdodCh0aGlzLm91dHB1dElkLCBvZmZzZXRIZWlnaHQgKyBjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmcgKiAyLCB7XG5cdFx0XHRcdFx0aXNPdXRwdXQ6IHRydWUsXG5cdFx0XHRcdFx0aW5pdDogdHJ1ZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUucGFkZGluZyA9IGAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlUGFkZGluZ31weCAke2N0eC5zdHlsZS5vdXRwdXROb2RlTGVmdFBhZGRpbmd9YDtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudEhhc0NvbnRlbnQoY29udGVudEhlaWdodCkpIHtcblx0XHRcdFx0ZGltZW5zaW9uVXBkYXRlci51cGRhdGVIZWlnaHQodGhpcy5vdXRwdXRJZCwgdGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCwge1xuXHRcdFx0XHRcdGlzT3V0cHV0OiB0cnVlLFxuXHRcdFx0XHRcdGluaXQ6IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gYDAgJHtjdHguc3R5bGUub3V0cHV0Tm9kZVBhZGRpbmd9cHggMCAke2N0eC5zdHlsZS5vdXRwdXROb2RlTGVmdFBhZGRpbmd9YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHdlIGhhdmUgYSB6ZXJvLWhlaWdodCBvdXRwdXQgRE9NIG5vZGVcblx0XHRcdFx0ZGltZW5zaW9uVXBkYXRlci51cGRhdGVIZWlnaHQodGhpcy5vdXRwdXRJZCwgMCwge1xuXHRcdFx0XHRcdGlzT3V0cHV0OiB0cnVlLFxuXHRcdFx0XHRcdGluaXQ6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByb290ID0gdGhpcy5lbGVtZW50LnNoYWRvd1Jvb3QgPz8gdGhpcy5lbGVtZW50O1xuXHRcdFx0Y29uc3QgY29kZUJsb2NrczogQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYW5nOiBzdHJpbmc7IGlkOiBzdHJpbmcgfT4gPSBNYXJrZG93bkNvZGVCbG9jay5yZXF1ZXN0SGlnaGxpZ2h0Q29kZUJsb2NrKHJvb3QpO1xuXG5cdFx0XHRpZiAoY29kZUJsb2Nrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklSZW5kZXJlZENlbGxPdXRwdXRNZXNzYWdlPigncmVuZGVyZWRDZWxsT3V0cHV0Jywge1xuXHRcdFx0XHRcdGNvZGVCbG9ja3Ncblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cHVibGljIHVwZGF0ZUFuZFJlcmVuZGVyKGNvbnRlbnQ6IHdlYnZpZXdNZXNzYWdlcy5JQ3JlYXRpb25Db250ZW50KSB7XG5cdFx0XHRpZiAodGhpcy5fY29udGVudCkge1xuXHRcdFx0XHR0aGlzLnJlbmRlcihjb250ZW50LCB0aGlzLl9jb250ZW50LnByZWZlcnJlZFJlbmRlcmVySWQsIHRoaXMuX2NvbnRlbnQucHJlbG9hZEVycm9ycyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgbWFya3VwQ2VsbERyYWdNYW5hZ2VyID0gbmV3IGNsYXNzIE1hcmt1cENlbGxEcmFnTWFuYWdlciB7XG5cblx0XHRwcml2YXRlIGN1cnJlbnREcmFnOiB7IGNlbGxJZDogc3RyaW5nOyBjbGllbnRZOiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblxuXHRcdC8vIFRyYW5zcGFyZW50IG92ZXJsYXkgdGhhdCBwcmV2ZW50cyBlbGVtZW50cyBmcm9tIGluc2lkZSB0aGUgd2VidmlldyBmcm9tIGVhdGluZ1xuXHRcdC8vIGRyYWcgZXZlbnRzLlxuXHRcdHByaXZhdGUgZHJhZ092ZXJsYXk/OiBIVE1MRWxlbWVudDtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0d2luZG93LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgZSA9PiB7XG5cdFx0XHRcdC8vIEFsbG93IGRyb3BwaW5nIGRyYWdnZWQgbWFya3VwIGNlbGxzXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR3aW5kb3cuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGUgPT4ge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0Y29uc3QgZHJhZyA9IHRoaXMuY3VycmVudERyYWc7XG5cdFx0XHRcdGlmICghZHJhZykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuY3VycmVudERyYWcgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHBvc3ROb3RlYm9va01lc3NhZ2U8d2Vidmlld01lc3NhZ2VzLklDZWxsRHJvcE1lc3NhZ2U+KCdjZWxsLWRyb3AnLCB7XG5cdFx0XHRcdFx0Y2VsbElkOiBkcmFnLmNlbGxJZCxcblx0XHRcdFx0XHRjdHJsS2V5OiBlLmN0cmxLZXksXG5cdFx0XHRcdFx0YWx0S2V5OiBlLmFsdEtleSxcblx0XHRcdFx0XHRkcmFnT2Zmc2V0WTogZS5jbGllbnRZLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHN0YXJ0RHJhZyhlOiBEcmFnRXZlbnQsIGNlbGxJZDogc3RyaW5nKSB7XG5cdFx0XHRpZiAoIWUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFjdXJyZW50T3B0aW9ucy5kcmFnQW5kRHJvcEVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmN1cnJlbnREcmFnID0geyBjZWxsSWQsIGNsaWVudFk6IGUuY2xpZW50WSB9O1xuXG5cdFx0XHRjb25zdCBvdmVybGF5WkluZGV4ID0gOTk5OTtcblx0XHRcdGlmICghdGhpcy5kcmFnT3ZlcmxheSkge1xuXHRcdFx0XHR0aGlzLmRyYWdPdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdHRoaXMuZHJhZ092ZXJsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0XHR0aGlzLmRyYWdPdmVybGF5LnN0eWxlLnRvcCA9ICcwJztcblx0XHRcdFx0dGhpcy5kcmFnT3ZlcmxheS5zdHlsZS5sZWZ0ID0gJzAnO1xuXHRcdFx0XHR0aGlzLmRyYWdPdmVybGF5LnN0eWxlLnpJbmRleCA9IGAke292ZXJsYXlaSW5kZXh9YDtcblx0XHRcdFx0dGhpcy5kcmFnT3ZlcmxheS5zdHlsZS53aWR0aCA9ICcxMDAlJztcblx0XHRcdFx0dGhpcy5kcmFnT3ZlcmxheS5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cdFx0XHRcdHRoaXMuZHJhZ092ZXJsYXkuc3R5bGUuYmFja2dyb3VuZCA9ICd0cmFuc3BhcmVudCc7XG5cdFx0XHRcdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZHJhZ092ZXJsYXkpO1xuXHRcdFx0fVxuXHRcdFx0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5zdHlsZS56SW5kZXggPSBgJHtvdmVybGF5WkluZGV4ICsgMX1gO1xuXHRcdFx0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuXG5cdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JQ2VsbERyYWdTdGFydE1lc3NhZ2U+KCdjZWxsLWRyYWctc3RhcnQnLCB7XG5cdFx0XHRcdGNlbGxJZDogY2VsbElkLFxuXHRcdFx0XHRkcmFnT2Zmc2V0WTogZS5jbGllbnRZLFxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIENvbnRpbnVvdXNseSBzZW5kIHVwZGF0ZXMgd2hpbGUgZHJhZ2dpbmcgaW5zdGVhZCBvZiByZWx5aW5nIG9uIGB1cGRhdGVEcmFnYC5cblx0XHRcdC8vIFRoaXMgbGV0cyB1cyBzY3JvbGwgdGhlIGxpc3QgYmFzZWQgb24gZHJhZyBwb3NpdGlvbi5cblx0XHRcdGNvbnN0IHRyeVNlbmREcmFnVXBkYXRlID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5jdXJyZW50RHJhZz8uY2VsbElkICE9PSBjZWxsSWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JQ2VsbERyYWdNZXNzYWdlPignY2VsbC1kcmFnJywge1xuXHRcdFx0XHRcdGNlbGxJZDogY2VsbElkLFxuXHRcdFx0XHRcdGRyYWdPZmZzZXRZOiB0aGlzLmN1cnJlbnREcmFnLmNsaWVudFksXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRyeVNlbmREcmFnVXBkYXRlKTtcblx0XHRcdH07XG5cdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRyeVNlbmREcmFnVXBkYXRlKTtcblx0XHR9XG5cblx0XHR1cGRhdGVEcmFnKGU6IERyYWdFdmVudCwgY2VsbElkOiBzdHJpbmcpIHtcblx0XHRcdGlmIChjZWxsSWQgIT09IHRoaXMuY3VycmVudERyYWc/LmNlbGxJZCkge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnREcmFnID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJhZyA9IHsgY2VsbElkLCBjbGllbnRZOiBlLmNsaWVudFkgfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbmREcmFnKGU6IERyYWdFdmVudCwgY2VsbElkOiBzdHJpbmcpIHtcblx0XHRcdHRoaXMuY3VycmVudERyYWcgPSB1bmRlZmluZWQ7XG5cdFx0XHQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG5cdFx0XHRwb3N0Tm90ZWJvb2tNZXNzYWdlPHdlYnZpZXdNZXNzYWdlcy5JQ2VsbERyYWdFbmRNZXNzYWdlPignY2VsbC1kcmFnLWVuZCcsIHtcblx0XHRcdFx0Y2VsbElkOiBjZWxsSWRcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5kcmFnT3ZlcmxheSkge1xuXHRcdFx0XHR0aGlzLmRyYWdPdmVybGF5LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLmRyYWdPdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLnpJbmRleCA9ICcnO1xuXHRcdH1cblx0fSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlbG9hZHNTY3JpcHRTdHIoc3R5bGVWYWx1ZXM6IFByZWxvYWRTdHlsZXMsIG9wdGlvbnM6IFByZWxvYWRPcHRpb25zLCByZW5kZXJPcHRpb25zOiBSZW5kZXJPcHRpb25zLCByZW5kZXJlcnM6IHJlYWRvbmx5IHdlYnZpZXdNZXNzYWdlcy5SZW5kZXJlck1ldGFkYXRhW10sIHByZWxvYWRzOiByZWFkb25seSB3ZWJ2aWV3TWVzc2FnZXMuU3RhdGljUHJlbG9hZE1ldGFkYXRhW10sIGlzV29ya3NwYWNlVHJ1c3RlZDogYm9vbGVhbiwgbm9uY2U6IHN0cmluZykge1xuXHRjb25zdCBjdHg6IFByZWxvYWRDb250ZXh0ID0ge1xuXHRcdHN0eWxlOiBzdHlsZVZhbHVlcyxcblx0XHRvcHRpb25zLFxuXHRcdHJlbmRlck9wdGlvbnMsXG5cdFx0cmVuZGVyZXJEYXRhOiByZW5kZXJlcnMsXG5cdFx0c3RhdGljUHJlbG9hZHNEYXRhOiBwcmVsb2Fkcyxcblx0XHRpc1dvcmtzcGFjZVRydXN0ZWQsXG5cdFx0bm9uY2UsXG5cdH07XG5cdC8vIFRTIHdpbGwgdHJ5IGNvbXBpbGluZyBgaW1wb3J0KClgIGluIHdlYnZpZXdQcmVsb2Fkcywgc28gdXNlIGEgaGVscGVyIGZ1bmN0aW9uIGluc3RlYWRcblx0Ly8gb2YgdXNpbmcgYGltcG9ydCguLi4pYCBkaXJlY3RseVxuXHRyZXR1cm4gYFxuXHRcdGNvbnN0IF9faW1wb3J0ID0gKHgpID0+IGltcG9ydCh4KTtcblx0XHQoJHt3ZWJ2aWV3UHJlbG9hZHN9KShcblx0XHRcdEpTT04ucGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KFwiJHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoY3R4KSl9XCIpKVxuXHRcdClcXG4vLyMgc291cmNlVVJMPW5vdGVib29rV2Vidmlld1ByZWxvYWRzLmpzXFxuYDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQTBGQSxlQUFlLGdCQUFnQixLQUFxQjtBQVFuRCxRQUFNLFlBQVksVUFBVTtBQUM1QixRQUFNLFdBQVksVUFBVSxRQUFRLFFBQVEsS0FBSztBQUNqRCxRQUFNLGNBQWMsSUFBSSxZQUFZO0FBQ3BDLFFBQU0sY0FBYyxJQUFJLFlBQVk7QUFFcEMsV0FBUyx1QkFBOEg7QUFDdEksUUFBSTtBQUNKLFFBQUk7QUFDSixVQUFNLFVBQVUsSUFBSSxRQUFXLENBQUMsS0FBSyxRQUFRO0FBQzVDLGdCQUFVO0FBQ1YsZUFBUztBQUFBLElBQ1YsQ0FBQztBQUNELFdBQU8sRUFBRSxTQUFTLFNBQW1CLE9BQWdCO0FBQUEsRUFDdEQ7QUFFQSxNQUFJLGlCQUFpQixJQUFJO0FBQ3pCLFFBQU0scUJBQXFCLElBQUk7QUFDL0IsTUFBSSx1QkFBdUIsSUFBSTtBQUMvQixRQUFNLGdCQUE0QyxjQUE2QjtBQUUvRSxRQUFNLG1CQUFtQixXQUFXO0FBQ3BDLFFBQU0sU0FBUyxpQkFBaUI7QUFDaEMsU0FBUSxXQUFtQjtBQUUzQixRQUFNLG9CQUFvQixJQUFJLGNBQWM7QUFDNUMsb0JBQWtCLFlBQVksSUFBSSxNQUFNLGVBQWU7QUFFdkQsUUFBTSxjQUEwRixPQUFPLHdCQUF3QixjQUFjLE9BQU8sdUJBQXVCLGFBQ3hLLENBQUMsV0FBVztBQUNiLGVBQVcsTUFBTTtBQUNoQixVQUFJLFVBQVU7QUFDYjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLE1BQU0sS0FBSyxJQUFJLElBQUk7QUFDekIsYUFBTyxPQUFPLE9BQU87QUFBQSxRQUNwQixZQUFZO0FBQUEsUUFDWixnQkFBZ0I7QUFD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QSxJQUVBLFdBQVcsR0FBYyxRQUFnQjtBQUN4QyxVQUFJLFdBQVcsS0FBSyxhQUFhLFFBQVE7QUFDeEMsYUFBSyxjQUFjO0FBQUEsTUFDcEIsT0FBTztBQUNOLGFBQUssY0FBYyxFQUFFLFFBQVEsU0FBUyxFQUFFLFFBQVE7QUFBQSxNQUNqRDtBQUFBLElBQ0Q7QUFBQSxJQUVBLFFBQVEsR0FBYyxRQUFnQjtBQUNyQyxXQUFLLGNBQWM7QUFDbkIsTUFBQyxFQUFFLE9BQXVCLFVBQVUsT0FBTyxVQUFVO0FBQ3JELDBCQUF5RCxpQkFBaUI7QUFBQSxRQUN6RTtBQUFBLE1BQ0QsQ0FBQztBQUVELFVBQUksS0FBSyxhQUFhO0FBQ3JCLGFBQUssWUFBWSxPQUFPO0FBQ3hCLGFBQUssY0FBYztBQUFBLE1BQ3BCO0FBRUEsTUFBQyxFQUFFLE9BQXVCLE1BQU0sU0FBUztBQUFBLElBQzFDO0FBQUEsRUFDRCxFQUFFO0FBQ0g7QUFFTyxTQUFTLGtCQUFrQixhQUE0QixTQUF5QixlQUE4QixXQUF3RCxVQUE0RCxvQkFBNkIsT0FBZTtBQUNwUixRQUFNLE1BQXNCO0FBQUEsSUFDM0IsT0FBTztBQUFBLElBQ1A7QUFBQSxJQUNBO0FBQUEsSUFDQSxjQUFjO0FBQUEsSUFDZCxvQkFBb0I7QUFBQSxJQUNwQjtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBR0EsU0FBTztBQUFBO0FBQUEsS0FFSCxlQUFlO0FBQUEsb0NBQ2dCLG1CQUFtQixLQUFLLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFFM0U7IiwKICAibmFtZXMiOiBbInJhbmdlIiwgIm5vZGVzIiwgInRhZ05hbWUiLCAiYXR0cmlidXRlcyIsICJpZCIsICJtaW1lIiwgIm1ldGFkYXRhIiwgInZhbHVlQnl0ZXMiLCAiYXBwZW5kZWQiLCAiaXRlbSIsICJmaW5kIiwgImVycm9yTWVzc2FnZSIsICJyZW5kZXJlciIsICJyZW5kZXJlcnMiXQp9Cg==
