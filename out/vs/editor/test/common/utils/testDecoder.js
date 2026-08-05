import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { randomInt } from "../../../../base/common/numbers.js";
import { assertDefined } from "../../../../base/common/types.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
class TestDecoder extends Disposable {
  constructor(stream, decoder) {
    super();
    this.stream = stream;
    this.decoder = decoder;
    this._register(this.decoder);
  }
  /**
   * Write provided {@linkcode inputData} data to the input byte stream
   * asynchronously in the background in small random-length chunks.
   *
   * @param inputData Input data to send.
   */
  sendData(inputData) {
    if (Array.isArray(inputData)) {
      inputData = inputData.join("\n");
    }
    let inputDataBytes = VSBuffer.fromString(inputData);
    const interval = setInterval(() => {
      if (inputDataBytes.byteLength <= 0) {
        clearInterval(interval);
        this.stream.end();
        return;
      }
      const dataToSend = inputDataBytes.slice(0, randomInt(inputDataBytes.byteLength));
      this.stream.write(dataToSend);
      inputDataBytes = inputDataBytes.slice(dataToSend.byteLength);
    }, randomInt(5));
    return this;
  }
  /**
   * Run the test sending the `inputData` data to the stream and asserting
   * that the decoder produces the `expectedTokens` sequence of tokens.
   *
   * @param inputData Input data of the input byte stream.
   * @param expectedTokens List of expected tokens the test token must produce.
   * @param tokensConsumeMethod *Optional* method of consuming the decoder stream.
   *       					  Defaults to a random method (see {@linkcode randomTokensConsumeMethod}).
   */
  async run(inputData, expectedTokens, tokensConsumeMethod = this.randomTokensConsumeMethod()) {
    try {
      this.sendData(inputData);
      const receivedTokens = [];
      switch (tokensConsumeMethod) {
        // test the `async iterator` code path
        case "async-generator": {
          for await (const token of this.decoder) {
            if (token === null) {
              break;
            }
            receivedTokens.push(token);
          }
          break;
        }
        // test the `.consumeAll()` method code path
        case "consume-all-method": {
          receivedTokens.push(...await this.decoder.consumeAll());
          break;
        }
        // test the `.onData()` event consume flow
        case "on-data-event": {
          this.decoder.onData((token) => {
            receivedTokens.push(token);
          });
          this.decoder.start();
          await this.decoder.settled;
          break;
        }
        // ensure that the switch block is exhaustive
        default: {
          throw new Error(`Unknown consume method '${tokensConsumeMethod}'.`);
        }
      }
      this.validateReceivedTokens(
        receivedTokens,
        expectedTokens
      );
    } catch (error) {
      assertDefined(
        error,
        `An non-nullable error must be thrown.`
      );
      assert(
        error instanceof Error,
        `An error error instance must be thrown.`
      );
      error.message = `[${tokensConsumeMethod}] ${error.message}`;
      throw error;
    }
  }
  /**
   * Randomly generate a tokens consume method type for the test.
   */
  randomTokensConsumeMethod() {
    const testConsumeMethodIndex = randomInt(2);
    switch (testConsumeMethodIndex) {
      // test the `async iterator` code path
      case 0: {
        return "async-generator";
      }
      // test the `.consumeAll()` method code path
      case 1: {
        return "consume-all-method";
      }
      // test the `.onData()` event consume flow
      case 2: {
        return "on-data-event";
      }
      // ensure that the switch block is exhaustive
      default: {
        throw new Error(`Unknown consume method index '${testConsumeMethodIndex}'.`);
      }
    }
  }
  /**
   * Validate that received tokens list is equal to the expected one.
   */
  validateReceivedTokens(receivedTokens, expectedTokens) {
    for (let i = 0; i < expectedTokens.length; i++) {
      const expectedToken = expectedTokens[i];
      const receivedToken = receivedTokens[i];
      assertDefined(
        receivedToken,
        `Expected token '${i}' to be '${expectedToken}', got 'undefined'.`
      );
      assert(
        receivedToken.equals(expectedToken),
        `Expected token '${i}' to be '${expectedToken}', got '${receivedToken}'.`
      );
    }
    if (receivedTokens.length === expectedTokens.length) {
      return;
    }
    assert(
      receivedTokens.length > expectedTokens.length,
      "Must have received more tokens than expected."
    );
    const index = expectedTokens.length;
    throw new Error(
      [
        `Expected no '${index}' token present, got '${receivedTokens[index]}'.`,
        `(received ${receivedTokens.length} tokens in total)`
      ].join(" ")
    );
  }
}
export {
  TestDecoder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vdXRpbHMvdGVzdERlY29kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyByYW5kb21JbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IEJhc2VUb2tlbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RlY3MvYmFzZVRva2VuLmpzJztcbmltcG9ydCB7IGFzc2VydERlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFdyaXRlYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBCYXNlRGVjb2RlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGVjcy9iYXNlRGVjb2Rlci5qcyc7XG5cbi8qKlxuICogS2luZCBvZiBkZWNvZGVyIHRva2VucyBjb25zdW1lIG1ldGhvZHMgYXJlIGRpZmZlcmVudCB3YXlzXG4gKiBjb25zdW1lIHRva2VucyB0aGF0IGEgZGVjb2RlciBwcm9kdWNlcyBvdXQgb2YgYSBieXRlIHN0cmVhbS5cbiAqL1xuZXhwb3J0IHR5cGUgVFRva2Vuc0NvbnN1bWVNZXRob2QgPSAnYXN5bmMtZ2VuZXJhdG9yJyB8ICdjb25zdW1lLWFsbC1tZXRob2QnIHwgJ29uLWRhdGEtZXZlbnQnO1xuXG4vKipcbiAqIEEgcmV1c2FibGUgdGVzdCB1dGlsaXR5IHRoYXQgYXNzZXJ0cyB0aGF0IHRoZSBnaXZlbiBkZWNvZGVyXG4gKiBwcm9kdWNlcyB0aGUgZXhwZWN0ZWQgYGV4cGVjdGVkVG9rZW5zYCBzZXF1ZW5jZSBvZiB0b2tlbnMuXG4gKlxuICogIyMgRXhhbXBsZXNcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVTdHJlYW08VlNCdWZmZXI+KG51bGwpO1xuICogY29uc3QgZGVjb2RlciA9IHRlc3REaXNwb3NhYmxlcy5hZGQobmV3IExpbmVzRGVjb2RlcihzdHJlYW0pKTtcbiAqXG4gKiAvLyBjcmVhdGUgYSBuZXcgdGVzdCB1dGlsaXR5IGluc3RhbmNlXG4gKiBjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChuZXcgVGVzdERlY29kZXIoc3RyZWFtLCBkZWNvZGVyKSk7XG4gKlxuICogLy8gcnVuIHRoZSB0ZXN0XG4gKiBhd2FpdCB0ZXN0LnJ1bihcbiAqICAgJyBoZWxsbyB3b3JsZFxcbicsXG4gKiAgIFtcbiAqIFx0ICAgbmV3IExpbmUoMSwgJyBoZWxsbyB3b3JsZCcpLFxuICogXHQgICBuZXcgTmV3TGluZShuZXcgUmFuZ2UoMSwgMTMsIDEsIDE0KSksXG4gKiAgIF0sXG4gKiApO1xuICovXG5leHBvcnQgY2xhc3MgVGVzdERlY29kZXI8VCBleHRlbmRzIEJhc2VUb2tlbiwgRCBleHRlbmRzIEJhc2VEZWNvZGVyPFQ+PiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0cmVhbTogV3JpdGVhYmxlU3RyZWFtPFZTQnVmZmVyPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGVjb2RlcjogRCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVjb2Rlcik7XG5cdH1cblxuXHQvKipcblx0ICogV3JpdGUgcHJvdmlkZWQge0BsaW5rY29kZSBpbnB1dERhdGF9IGRhdGEgdG8gdGhlIGlucHV0IGJ5dGUgc3RyZWFtXG5cdCAqIGFzeW5jaHJvbm91c2x5IGluIHRoZSBiYWNrZ3JvdW5kIGluIHNtYWxsIHJhbmRvbS1sZW5ndGggY2h1bmtzLlxuXHQgKlxuXHQgKiBAcGFyYW0gaW5wdXREYXRhIElucHV0IGRhdGEgdG8gc2VuZC5cblx0ICovXG5cdHB1YmxpYyBzZW5kRGF0YShcblx0XHRpbnB1dERhdGE6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHQpOiB0aGlzIHtcblx0XHQvLyBpZiBpbnB1dCBkYXRhIHdhcyBwYXNzZWQgYXMgYW4gYXJyYXkgb2YgbGluZXMsXG5cdFx0Ly8gam9pbiB0aGVtIGludG8gYSBzaW5nbGUgc3RyaW5nIHdpdGggbmV3bGluZXNcblx0XHRpZiAoQXJyYXkuaXNBcnJheShpbnB1dERhdGEpKSB7XG5cdFx0XHRpbnB1dERhdGEgPSBpbnB1dERhdGEuam9pbignXFxuJyk7XG5cdFx0fVxuXG5cdFx0Ly8gd3JpdGUgdGhlIGlucHV0IGRhdGEgdG8gdGhlIHN0cmVhbSBpbiBtdWx0aXBsZSByYW5kb20tbGVuZ3RoXG5cdFx0Ly8gY2h1bmtzIHRvIHNpbXVsYXRlIHJlYWwgaW5wdXQgc3RyZWFtIGRhdGEgZmxvd3Ncblx0XHRsZXQgaW5wdXREYXRhQnl0ZXMgPSBWU0J1ZmZlci5mcm9tU3RyaW5nKGlucHV0RGF0YSk7XG5cdFx0Y29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRpZiAoaW5wdXREYXRhQnl0ZXMuYnl0ZUxlbmd0aCA8PSAwKSB7XG5cdFx0XHRcdGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuXHRcdFx0XHR0aGlzLnN0cmVhbS5lbmQoKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRhdGFUb1NlbmQgPSBpbnB1dERhdGFCeXRlcy5zbGljZSgwLCByYW5kb21JbnQoaW5wdXREYXRhQnl0ZXMuYnl0ZUxlbmd0aCkpO1xuXHRcdFx0dGhpcy5zdHJlYW0ud3JpdGUoZGF0YVRvU2VuZCk7XG5cdFx0XHRpbnB1dERhdGFCeXRlcyA9IGlucHV0RGF0YUJ5dGVzLnNsaWNlKGRhdGFUb1NlbmQuYnl0ZUxlbmd0aCk7XG5cdFx0fSwgcmFuZG9tSW50KDUpKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJ1biB0aGUgdGVzdCBzZW5kaW5nIHRoZSBgaW5wdXREYXRhYCBkYXRhIHRvIHRoZSBzdHJlYW0gYW5kIGFzc2VydGluZ1xuXHQgKiB0aGF0IHRoZSBkZWNvZGVyIHByb2R1Y2VzIHRoZSBgZXhwZWN0ZWRUb2tlbnNgIHNlcXVlbmNlIG9mIHRva2Vucy5cblx0ICpcblx0ICogQHBhcmFtIGlucHV0RGF0YSBJbnB1dCBkYXRhIG9mIHRoZSBpbnB1dCBieXRlIHN0cmVhbS5cblx0ICogQHBhcmFtIGV4cGVjdGVkVG9rZW5zIExpc3Qgb2YgZXhwZWN0ZWQgdG9rZW5zIHRoZSB0ZXN0IHRva2VuIG11c3QgcHJvZHVjZS5cblx0ICogQHBhcmFtIHRva2Vuc0NvbnN1bWVNZXRob2QgKk9wdGlvbmFsKiBtZXRob2Qgb2YgY29uc3VtaW5nIHRoZSBkZWNvZGVyIHN0cmVhbS5cblx0ICogICAgICAgXHRcdFx0XHRcdCAgRGVmYXVsdHMgdG8gYSByYW5kb20gbWV0aG9kIChzZWUge0BsaW5rY29kZSByYW5kb21Ub2tlbnNDb25zdW1lTWV0aG9kfSkuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgcnVuKFxuXHRcdGlucHV0RGF0YTogc3RyaW5nIHwgc3RyaW5nW10sXG5cdFx0ZXhwZWN0ZWRUb2tlbnM6IHJlYWRvbmx5IFRbXSxcblx0XHR0b2tlbnNDb25zdW1lTWV0aG9kOiBUVG9rZW5zQ29uc3VtZU1ldGhvZCA9IHRoaXMucmFuZG9tVG9rZW5zQ29uc3VtZU1ldGhvZCgpLFxuXHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Ly8gaW5pdGlhdGUgdGhlIGRhdGEgc2VuZGluZyBmbG93XG5cdFx0XHR0aGlzLnNlbmREYXRhKGlucHV0RGF0YSk7XG5cblx0XHRcdC8vIGNvbnN1bWUgdGhlIGRlY29kZXIgdG9rZW5zIGJhc2VkIG9uIHNwZWNpZmllZFxuXHRcdFx0Ly8gKG9yIHJhbmRvbWx5IGdlbmVyYXRlZCkgdG9rZW5zIGNvbnN1bWUgbWV0aG9kXG5cdFx0XHRjb25zdCByZWNlaXZlZFRva2VuczogVFtdID0gW107XG5cdFx0XHRzd2l0Y2ggKHRva2Vuc0NvbnN1bWVNZXRob2QpIHtcblx0XHRcdFx0Ly8gdGVzdCB0aGUgYGFzeW5jIGl0ZXJhdG9yYCBjb2RlIHBhdGhcblx0XHRcdFx0Y2FzZSAnYXN5bmMtZ2VuZXJhdG9yJzoge1xuXHRcdFx0XHRcdGZvciBhd2FpdCAoY29uc3QgdG9rZW4gb2YgdGhpcy5kZWNvZGVyKSB7XG5cdFx0XHRcdFx0XHRpZiAodG9rZW4gPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJlY2VpdmVkVG9rZW5zLnB1c2godG9rZW4pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIHRlc3QgdGhlIGAuY29uc3VtZUFsbCgpYCBtZXRob2QgY29kZSBwYXRoXG5cdFx0XHRcdGNhc2UgJ2NvbnN1bWUtYWxsLW1ldGhvZCc6IHtcblx0XHRcdFx0XHRyZWNlaXZlZFRva2Vucy5wdXNoKC4uLihhd2FpdCB0aGlzLmRlY29kZXIuY29uc3VtZUFsbCgpKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gdGVzdCB0aGUgYC5vbkRhdGEoKWAgZXZlbnQgY29uc3VtZSBmbG93XG5cdFx0XHRcdGNhc2UgJ29uLWRhdGEtZXZlbnQnOiB7XG5cdFx0XHRcdFx0dGhpcy5kZWNvZGVyLm9uRGF0YSgodG9rZW4pID0+IHtcblx0XHRcdFx0XHRcdHJlY2VpdmVkVG9rZW5zLnB1c2godG9rZW4pO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dGhpcy5kZWNvZGVyLnN0YXJ0KCk7XG5cblx0XHRcdFx0XHQvLyBpbiB0aGlzIGNhc2Ugd2UgYWxzbyB0ZXN0IHRoZSBgc2V0dGxlZGAgcHJvbWlzZSBvZiB0aGUgZGVjb2RlclxuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZGVjb2Rlci5zZXR0bGVkO1xuXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gZW5zdXJlIHRoYXQgdGhlIHN3aXRjaCBibG9jayBpcyBleGhhdXN0aXZlXG5cdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gY29uc3VtZSBtZXRob2QgJyR7dG9rZW5zQ29uc3VtZU1ldGhvZH0nLmApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHZhbGlkYXRlIHRoZSByZWNlaXZlZCB0b2tlbnNcblx0XHRcdHRoaXMudmFsaWRhdGVSZWNlaXZlZFRva2Vucyhcblx0XHRcdFx0cmVjZWl2ZWRUb2tlbnMsXG5cdFx0XHRcdGV4cGVjdGVkVG9rZW5zLFxuXHRcdFx0KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdFx0ZXJyb3IsXG5cdFx0XHRcdGBBbiBub24tbnVsbGFibGUgZXJyb3IgbXVzdCBiZSB0aHJvd24uYCxcblx0XHRcdCk7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGVycm9yIGluc3RhbmNlb2YgRXJyb3IsXG5cdFx0XHRcdGBBbiBlcnJvciBlcnJvciBpbnN0YW5jZSBtdXN0IGJlIHRocm93bi5gLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gYWRkIHRoZSB0b2tlbnMgY29uc3VtZSBtZXRob2QgdG8gdGhlIGVycm9yIG1lc3NhZ2Ugc28gd2Vcblx0XHRcdC8vIHdvdWxkIGtub3cgd2hpY2ggbWV0aG9kIG9mIGNvbnN1bWluZyB0aGUgdG9rZW5zIGZhaWxlZCBleGFjdGx5XG5cdFx0XHRlcnJvci5tZXNzYWdlID0gYFske3Rva2Vuc0NvbnN1bWVNZXRob2R9XSAke2Vycm9yLm1lc3NhZ2V9YDtcblxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJhbmRvbWx5IGdlbmVyYXRlIGEgdG9rZW5zIGNvbnN1bWUgbWV0aG9kIHR5cGUgZm9yIHRoZSB0ZXN0LlxuXHQgKi9cblx0cHJpdmF0ZSByYW5kb21Ub2tlbnNDb25zdW1lTWV0aG9kKCk6IFRUb2tlbnNDb25zdW1lTWV0aG9kIHtcblx0XHRjb25zdCB0ZXN0Q29uc3VtZU1ldGhvZEluZGV4ID0gcmFuZG9tSW50KDIpO1xuXG5cdFx0c3dpdGNoICh0ZXN0Q29uc3VtZU1ldGhvZEluZGV4KSB7XG5cdFx0XHQvLyB0ZXN0IHRoZSBgYXN5bmMgaXRlcmF0b3JgIGNvZGUgcGF0aFxuXHRcdFx0Y2FzZSAwOiB7XG5cdFx0XHRcdHJldHVybiAnYXN5bmMtZ2VuZXJhdG9yJztcblx0XHRcdH1cblx0XHRcdC8vIHRlc3QgdGhlIGAuY29uc3VtZUFsbCgpYCBtZXRob2QgY29kZSBwYXRoXG5cdFx0XHRjYXNlIDE6IHtcblx0XHRcdFx0cmV0dXJuICdjb25zdW1lLWFsbC1tZXRob2QnO1xuXHRcdFx0fVxuXHRcdFx0Ly8gdGVzdCB0aGUgYC5vbkRhdGEoKWAgZXZlbnQgY29uc3VtZSBmbG93XG5cdFx0XHRjYXNlIDI6IHtcblx0XHRcdFx0cmV0dXJuICdvbi1kYXRhLWV2ZW50Jztcblx0XHRcdH1cblx0XHRcdC8vIGVuc3VyZSB0aGF0IHRoZSBzd2l0Y2ggYmxvY2sgaXMgZXhoYXVzdGl2ZVxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gY29uc3VtZSBtZXRob2QgaW5kZXggJyR7dGVzdENvbnN1bWVNZXRob2RJbmRleH0nLmApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBWYWxpZGF0ZSB0aGF0IHJlY2VpdmVkIHRva2VucyBsaXN0IGlzIGVxdWFsIHRvIHRoZSBleHBlY3RlZCBvbmUuXG5cdCAqL1xuXHRwcml2YXRlIHZhbGlkYXRlUmVjZWl2ZWRUb2tlbnMoXG5cdFx0cmVjZWl2ZWRUb2tlbnM6IHJlYWRvbmx5IFRbXSxcblx0XHRleHBlY3RlZFRva2VuczogcmVhZG9ubHkgVFtdLFxuXHQpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGV4cGVjdGVkVG9rZW5zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBleHBlY3RlZFRva2VuID0gZXhwZWN0ZWRUb2tlbnNbaV07XG5cdFx0XHRjb25zdCByZWNlaXZlZFRva2VuID0gcmVjZWl2ZWRUb2tlbnNbaV07XG5cblx0XHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRcdHJlY2VpdmVkVG9rZW4sXG5cdFx0XHRcdGBFeHBlY3RlZCB0b2tlbiAnJHtpfScgdG8gYmUgJyR7ZXhwZWN0ZWRUb2tlbn0nLCBnb3QgJ3VuZGVmaW5lZCcuYCxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0cmVjZWl2ZWRUb2tlbi5lcXVhbHMoZXhwZWN0ZWRUb2tlbiksXG5cdFx0XHRcdGBFeHBlY3RlZCB0b2tlbiAnJHtpfScgdG8gYmUgJyR7ZXhwZWN0ZWRUb2tlbn0nLCBnb3QgJyR7cmVjZWl2ZWRUb2tlbn0nLmAsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmIChyZWNlaXZlZFRva2Vucy5sZW5ndGggPT09IGV4cGVjdGVkVG9rZW5zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHNhbml0eSBjaGVjayAtIGlmIHJlY2VpdmVkL2V4cGVjdGVkIGxpc3QgbGVuZ3RocyBhcmUgbm90IGVxdWFsLCB0aGUgcmVjZWl2ZWRcblx0XHQvLyBsaXN0IG11c3QgYmUgbG9uZ2VyIHRoYW4gdGhlIGV4cGVjdGVkIG9uZSwgYmVjYXVzZSB0aGUgb3RoZXIgd2F5IGFyb3VuZCBjYXNlXG5cdFx0Ly8gbXVzdCBoYXZlIGJlZW4gY2F1Z2h0IGJ5IHRoZSBjb21wYXJpc29uIGxvb3AgYWJvdmVcblx0XHRhc3NlcnQoXG5cdFx0XHRyZWNlaXZlZFRva2Vucy5sZW5ndGggPiBleHBlY3RlZFRva2Vucy5sZW5ndGgsXG5cdFx0XHQnTXVzdCBoYXZlIHJlY2VpdmVkIG1vcmUgdG9rZW5zIHRoYW4gZXhwZWN0ZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgaW5kZXggPSBleHBlY3RlZFRva2Vucy5sZW5ndGg7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFxuXHRcdFx0W1xuXHRcdFx0XHRgRXhwZWN0ZWQgbm8gJyR7aW5kZXh9JyB0b2tlbiBwcmVzZW50LCBnb3QgJyR7cmVjZWl2ZWRUb2tlbnNbaW5kZXhdfScuYCxcblx0XHRcdFx0YChyZWNlaXZlZCAke3JlY2VpdmVkVG9rZW5zLmxlbmd0aH0gdG9rZW5zIGluIHRvdGFsKWAsXG5cdFx0XHRdLmpvaW4oJyAnKSxcblx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0I7QUFnQ3BCLE1BQU0sb0JBQW1FLFdBQVc7QUFBQSxFQUMxRixZQUNrQixRQUNELFNBQ2Y7QUFDRCxVQUFNO0FBSFc7QUFDRDtBQUloQixTQUFLLFVBQVUsS0FBSyxPQUFPO0FBQUEsRUFDNUI7QUFB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
